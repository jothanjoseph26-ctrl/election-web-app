import { supabase } from '@/integrations/supabase/client';

export interface FraudDetectionRule {
  id: string;
  name: string;
  description: string;
  type: 'duplicate_payment' | 'amount_anomaly' | 'frequency_anomaly' | 'velocity_check' | 'location_anomaly' | 'time_pattern' | 'agent_risk';
  enabled: boolean;
  threshold: number;
  weight: number;
  conditions: Record<string, any>;
}

export interface FraudAlert {
  id: string;
  payment_id: string;
  rule_id: string;
  risk_score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  details: Record<string, any>;
  detected_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  resolution_notes?: string;
  // Joined fields
  payment?: {
    amount: number;
    agent_id: string;
    agent?: {
      full_name: string;
      phone_number: string;
      ward_name: string;
    };
  };
  rule?: FraudDetectionRule;
}

export class FraudDetectionService {
  // Predefined fraud detection rules
  private static readonly DEFAULT_RULES: Omit<FraudDetectionRule, 'id'>[] = [
    {
      name: 'Duplicate Payment Check',
      description: 'Detect duplicate payments to same agent within time window',
      type: 'duplicate_payment',
      enabled: true,
      threshold: 30, // minutes
      weight: 8,
      conditions: {
        timeWindow: 30, // minutes
        amountMatch: true,
        exactMatch: false
      }
    },
    {
      name: 'Amount Anomaly Detection',
      description: 'Flag unusually high or low payment amounts',
      type: 'amount_anomaly',
      enabled: true,
      threshold: 3, // standard deviations
      weight: 7,
      conditions: {
        multiplier: 2.5, // amount > average * multiplier
        minAmount: 50000, // ₦50,000
        lookbackDays: 30
      }
    },
    {
      name: 'High Frequency Detection',
      description: 'Detect excessive payment frequency to same agent',
      type: 'frequency_anomaly',
      enabled: true,
      threshold: 5, // payments per day
      weight: 6,
      conditions: {
        maxPerDay: 5,
        maxPerWeek: 15,
        lookbackDays: 7
      }
    },
    {
      name: 'Payment Velocity Check',
      description: 'Detect rapid succession of payments',
      type: 'velocity_check',
      enabled: true,
      threshold: 3, // payments within time window
      weight: 9,
      conditions: {
        timeWindow: 60, // minutes
        maxCount: 3,
        checkAgents: true
      }
    },
    {
      name: 'Agent Risk Profile',
      description: 'Check agent against risk factors',
      type: 'agent_risk',
      enabled: true,
      threshold: 50, // risk score threshold
      weight: 5,
      conditions: {
        newAgentThreshold: 30, // days
        failedPaymentThreshold: 3,
        verificationIssuesThreshold: 2
      }
    },
    {
      name: 'Unusual Payment Time Pattern',
      description: 'Flag payments outside normal hours',
      type: 'time_pattern',
      enabled: true,
      threshold: 22, // hour after which payments are unusual
      weight: 4,
      conditions: {
        startHour: 22, // 10 PM
        endHour: 6, // 6 AM
        weekendMultiplier: 1.5
      }
    }
  ];

  // Initialize default rules
  static async initializeRules(): Promise<void> {
    try {
      const { data: existingRules } = await supabase
        .from('fraud_detection_rules')
        .select('*');

      if (existingRules && existingRules.length > 0) {
        console.log('Fraud detection rules already initialized');
        return;
      }

      // Insert default rules
      const { error } = await supabase
        .from('fraud_detection_rules')
        .insert(this.DEFAULT_RULES);

      if (error) throw error;

      console.log('Fraud detection rules initialized successfully');
    } catch (error) {
      console.error('Failed to initialize fraud detection rules:', error);
    }
  }

  // Analyze payment for fraud
  static async analyzePayment(paymentId: string): Promise<{
    riskScore: number;
    alerts: Array<{
      rule: FraudDetectionRule;
      riskScore: number;
      severity: string;
      details: Record<string, any>;
    }>;
  }> {
    try {
      // Get payment with agent details
      const { data: payment } = await supabase
        .from('payment_records')
        .select(`
          *,
          agents!inner (
            full_name,
            phone_number,
            ward_name,
            ward_number,
            verification_status,
            created_at
          )
        `)
        .eq('id', paymentId)
        .single();

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Get enabled fraud detection rules
      const { data: rules } = await supabase
        .from('fraud_detection_rules')
        .select('*')
        .eq('enabled', true);

      if (!rules) {
        return { riskScore: 0, alerts: [] };
      }

      const alerts = [];
      let totalRiskScore = 0;

      // Run each rule
      for (const rule of rules) {
        const ruleResult = await this.runRule(rule, payment);
        if (ruleResult.riskScore > 0) {
          alerts.push({
            rule,
            riskScore: ruleResult.riskScore,
            severity: ruleResult.severity,
            details: ruleResult.details
          });
          totalRiskScore += ruleResult.riskScore;
        }
      }

      // Calculate overall severity
      const severity = this.calculateSeverity(totalRiskScore);

      // Create fraud alerts if needed
      if (alerts.length > 0) {
        for (const alert of alerts) {
          await this.createFraudAlert(paymentId, rule, alert.riskScore, alert.severity, alert.details);
        }
      }

      return { riskScore: totalRiskScore, alerts };
    } catch (error) {
      console.error('Fraud detection analysis failed:', error);
      return { riskScore: 0, alerts: [] };
    }
  }

  // Run individual fraud detection rule
  private static async runRule(rule: FraudDetectionRule, payment: any): Promise<{
    riskScore: number;
    severity: string;
    details: Record<string, any>;
  }> {
    switch (rule.type) {
      case 'duplicate_payment':
        return await this.checkDuplicatePayment(rule, payment);
      case 'amount_anomaly':
        return await this.checkAmountAnomaly(rule, payment);
      case 'frequency_anomaly':
        return await this.checkFrequencyAnomaly(rule, payment);
      case 'velocity_check':
        return await this.checkVelocityRule(rule, payment);
      case 'agent_risk':
        return await this.checkAgentRisk(rule, payment);
      case 'time_pattern':
        return await this.checkTimePattern(rule, payment);
      default:
        return { riskScore: 0, severity: 'low', details: {} };
    }
  }

  // Duplicate payment detection
  private static async checkDuplicatePayment(rule: FraudDetectionRule, payment: any): Promise<{
    riskScore: number;
    severity: string;
    details: Record<string, any>;
  }> {
    const { data: duplicates } = await supabase
      .from('payment_records')
      .select('*')
      .eq('agent_id', payment.agent_id)
      .gte('created_at', new Date(Date.now() - rule.conditions.timeWindow * 60 * 1000).toISOString())
      .neq('id', payment.id);

    if (!duplicates || duplicates.length === 0) {
      return { riskScore: 0, severity: 'low', details: { duplicateCount: 0 } };
    }

    const similarPayments = duplicates.filter(d => 
      Math.abs(d.amount - payment.amount) <= (d.amount * 0.1) // Within 10% amount
    );

    if (similarPayments.length > 0) {
      return {
        riskScore: rule.weight * similarPayments.length,
        severity: similarPayments.length > 1 ? 'high' : 'medium',
        details: {
          duplicateCount: similarPayments.length,
          timeWindow: rule.conditions.timeWindow,
          similarPayments: similarPayments.map(d => ({
            id: d.id,
            amount: d.amount,
            created_at: d.created_at
          }))
        }
      };
    }

    return { riskScore: 0, severity: 'low', details: { duplicateCount: 0 } };
  }

  // Amount anomaly detection
  private static async checkAmountAnomaly(rule: FraudDetectionRule, payment: any): Promise<{
    riskScore: number;
    severity: string;
    details: Record<string, any>;
  }> {
    // Get agent's payment history
    const { data: agentPayments } = await supabase
      .from('payment_records')
      .select('amount, created_at')
      .eq('agent_id', payment.agent_id)
      .eq('status', 'delivered')
      .gte('created_at', new Date(Date.now() - rule.conditions.lookbackDays * 24 * 60 * 60 * 1000).toISOString());

    if (!agentPayments || agentPayments.length < 3) {
      // Not enough data for statistical analysis
      if (payment.amount > rule.conditions.minAmount) {
        return {
          riskScore: rule.weight * 2,
          severity: 'medium',
          details: {
            reason: 'High amount with insufficient history',
            amount: payment.amount,
            threshold: rule.conditions.minAmount
          }
        };
      }
      return { riskScore: 0, severity: 'low', details: {} };
    }

    const amounts = agentPayments.map(p => p.amount);
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const standardDeviation = Math.sqrt(
      amounts.reduce((sum, amount) => sum + Math.pow(amount - average, 2), 0) / amounts.length
    );

    const zScore = Math.abs(payment.amount - average) / standardDeviation;
    
    if (zScore > rule.threshold || payment.amount > average * rule.conditions.multiplier) {
      return {
        riskScore: rule.weight * Math.max(zScore, 2),
        severity: zScore > 4 ? 'high' : 'medium',
        details: {
          reason: 'Amount anomaly detected',
          amount: payment.amount,
          average: average,
          zScore: zScore,
          threshold: rule.threshold
        }
      };
    }

    return { riskScore: 0, severity: 'low', details: {} };
  }

  // Frequency anomaly detection
  private static async checkFrequencyAnomaly(rule: FraudDetectionRule, payment: any): Promise<{
    riskScore: number;
    severity: string;
    details: Record<string, any>;
  }> {
    // Count payments to this agent in recent periods
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: dayPayments } = await supabase
      .from('payment_records')
      .select('id, amount, created_at')
      .eq('agent_id', payment.agent_id)
      .gte('created_at', dayStart.toISOString());

    const { data: weekPayments } = await supabase
      .from('payment_records')
      .select('id, amount, created_at')
      .eq('agent_id', payment.agent_id)
      .gte('created_at', weekStart.toISOString());

    const dayCount = dayPayments?.length || 0;
    const weekCount = weekPayments?.length || 0;

    if (dayCount > rule.conditions.maxPerDay || weekCount > rule.conditions.maxPerWeek) {
      return {
        riskScore: rule.weight * Math.max(dayCount - rule.conditions.maxPerDay, weekCount - rule.conditions.maxPerWeek),
        severity: 'high',
        details: {
          reason: 'High payment frequency',
          dayCount,
          weekCount,
          dayLimit: rule.conditions.maxPerDay,
          weekLimit: rule.conditions.maxPerWeek
        }
      };
    }

    return { riskScore: 0, severity: 'low', details: { dayCount, weekCount } };
  }

  // Velocity check
  private static async checkVelocityRule(rule: FraudDetectionRule, payment: any): Promise<{
    riskScore: number;
    severity: string;
    details: Record<string, any>;
  }> {
    const { data: recentPayments } = await supabase
      .from('payment_records')
      .select('id, amount, created_at')
      .eq('agent_id', payment.agent_id)
      .gte('created_at', new Date(Date.now() - rule.conditions.timeWindow * 60 * 1000).toISOString());

    if (!recentPayments || recentPayments.length <= 1) {
      return { riskScore: 0, severity: 'low', details: {} };
    }

    const count = recentPayments.length;
    if (count > rule.conditions.maxCount) {
      return {
        riskScore: rule.weight * (count - 1),
        severity: count > 5 ? 'critical' : 'high',
        details: {
          reason: 'High payment velocity',
          count,
          timeWindow: rule.conditions.timeWindow,
          limit: rule.conditions.maxCount
        }
      };
    }

    return { riskScore: 0, severity: 'low', details: {} };
  }

  // Agent risk profile check
  private static async checkAgentRisk(rule: FraudDetectionRule, payment: any): Promise<{
    riskScore: number;
    severity: string;
    details: Record<string, any>;
  }> {
    const agent = payment.agent;
    if (!agent) {
      return { riskScore: 0, severity: 'low', details: {} };
    }

    let riskScore = 0;
    const riskFactors: any = {};

    // New agent check
    const agentAge = Date.now() - new Date(agent.created_at).getTime();
    const daysSinceCreation = agentAge / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < rule.conditions.newAgentThreshold) {
      riskScore += rule.weight;
      riskFactors.newAgent = {
        days: daysSinceCreation,
        threshold: rule.conditions.newAgentThreshold
      };
    }

    // Verification status check
    if (agent.verification_status !== 'verified') {
      riskScore += rule.weight * 2;
      riskFactors.verificationStatus = agent.verification_status;
    }

    // Check failed payment attempts
    const { data: failedPayments } = await supabase
      .from('payment_records')
      .select('id, created_at')
      .eq('agent_id', payment.agent_id)
      .eq('status', 'failed');

    if (failedPayments && failedPayments.length >= rule.conditions.failedPaymentThreshold) {
      riskScore += rule.weight * 3;
      riskFactors.failedPayments = failedPayments.length;
    }

    const severity = riskScore > 30 ? 'high' : riskScore > 15 ? 'medium' : 'low';

    return {
      riskScore,
      severity,
      details: {
        reason: 'Agent risk factors detected',
        ...riskFactors
      }
    };
  }

  // Time pattern check
  private static async checkTimePattern(rule: FraudDetectionRule, payment: any): Promise<{
    riskScore: number;
    severity: string;
    details: Record<string, any>;
  }> {
    const paymentHour = new Date(payment.created_at).getHours();
    const paymentDay = new Date(payment.created_at).getDay();

    // Check for unusual hours
    if (paymentHour >= rule.conditions.startHour || paymentHour <= rule.conditions.endHour) {
      let multiplier = 1;
      
      // Higher risk for weekend
      if (paymentDay === 0 || paymentDay === 6) { // Sunday or Saturday
        multiplier = rule.conditions.weekendMultiplier;
      }

      return {
        riskScore: rule.weight * multiplier,
        severity: multiplier > 1 ? 'medium' : 'low',
        details: {
          reason: 'Unusual payment time',
          hour: paymentHour,
          day: paymentDay,
          timeWindow: `${rule.conditions.endHour}:00 - ${rule.conditions.startHour}:00`,
          multiplier
        }
      };
    }

    return { riskScore: 0, severity: 'low', details: {} };
  }

  // Calculate severity based on risk score
  private static calculateSeverity(riskScore: number): string {
    if (riskScore >= 50) return 'critical';
    if (riskScore >= 30) return 'high';
    if (riskScore >= 15) return 'medium';
    return 'low';
  }

  // Create fraud alert
  private static async createFraudAlert(
    paymentId: string,
    rule: FraudDetectionRule,
    riskScore: number,
    severity: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await supabase
        .from('fraud_alerts')
        .insert({
          payment_id: paymentId,
          rule_id: rule.id,
          risk_score: riskScore,
          severity: severity,
          status: 'open',
          details: details,
        });

      // Log the alert creation
      await supabase
        .from('audit_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'FRAUD_ALERT',
          resource_type: 'payment',
          resource_id: paymentId,
          details: {
            rule_name: rule.name,
            severity,
            risk_score: riskScore,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to create fraud alert:', error);
    }
  }

  // Get fraud alerts
  static async getFraudAlerts(filters: {
    status?: string;
    severity?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  } = {}): Promise<{ data: FraudAlert[]; error?: any }> {
    let query = supabase
      .from('fraud_alerts')
      .select(`
        *,
        payment_records (
          amount,
          agent_id,
          agents!inner (
            full_name,
            phone_number,
            ward_name
          )
        ),
        fraud_detection_rules (
          name,
          description,
          type
        )
      `)
      .order('detected_at', { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters.dateFrom) {
      query = query.gte('detected_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('detected_at', filters.dateTo);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    return { data: data as FraudAlert[], error };
  }

  // Update fraud alert status
  static async updateAlertStatus(
    alertId: string,
    status: string,
    resolutionNotes?: string
  ): Promise<{ error?: any }> {
    try {
      const { error } = await supabase
        .from('fraud_alerts')
        .update({
          status,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          resolution_notes: resolutionNotes,
        })
        .eq('id', alertId);

      if (error) throw error;

      return {};
    } catch (error) {
      return { error };
    }
  }

  // Get fraud analytics
  static async getFraudAnalytics(): Promise<{
    totalAlerts: number;
    openAlerts: number;
    resolvedAlerts: number;
    bySeverity: Record<string, number>;
    byRule: Record<string, number>;
    trends: Array<{ date: string; count: number }>;
  }> {
    const { data: alerts } = await this.getFraudAlerts({ limit: 1000 });

    if (!alerts) {
      return {
        totalAlerts: 0,
        openAlerts: 0,
        resolvedAlerts: 0,
        bySeverity: {},
        byRule: {},
        trends: []
      };
    }

    const analytics = {
      totalAlerts: alerts.length,
      openAlerts: alerts.filter(a => a.status === 'open').length,
      resolvedAlerts: alerts.filter(a => a.status === 'resolved').length,
      bySeverity: {} as Record<string, number>,
      byRule: {} as Record<string, number>,
      trends: [] as Array<{ date: string; count: number }>
    };

    // Count by severity
    alerts.forEach(alert => {
      analytics.bySeverity[alert.severity] = (analytics.bySeverity[alert.severity] || 0) + 1;
      analytics.byRule[alert.rule?.name || 'unknown'] = (analytics.byRule[alert.rule?.name || 'unknown'] || 0) + 1;
    });

    // Calculate trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyAlerts: Record<string, number> = {};

    alerts
      .filter(alert => new Date(alert.detected_at) >= thirtyDaysAgo)
      .forEach(alert => {
        const date = alert.detected_at.split('T')[0];
        dailyAlerts[date] = (dailyAlerts[date] || 0) + 1;
      });

    analytics.trends = Object.entries(dailyAlerts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return analytics;
  }
}