import { supabase } from '@/integrations/supabase/client';

export interface PaymentReconciliation {
  id: string;
  payment_id: string;
  reconciliation_date: string;
  opening_balance: number;
  closing_balance: number;
  difference: number;
  reconciled_by?: string;
  reconciled_at?: string;
  status: 'matched' | 'unmatched' | 'variance' | 'exception';
  variance_reason?: string;
  attached_documents: string[];
  notes?: string;
  created_at: string;
  // Joined fields
  payment?: {
    amount: number;
    reference_number: string;
    status: string;
    agent?: {
      full_name: string;
      phone_number: string;
    };
  };
}

export interface PaymentAuditTrail {
  id: string;
  payment_id: string;
  action: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  performed_by: string;
  performed_at: string;
  ip_address?: string;
  user_agent?: string;
  notes?: string;
  // Joined fields
  payment?: {
    amount: number;
    reference_number: string;
    agent?: {
      full_name: string;
    };
  };
}

export class PaymentReconciliationService {
  // Create reconciliation record
  static async createReconciliation(reconciliationData: {
    payment_id: string;
    reconciliation_date: string;
    opening_balance: number;
    closing_balance: number;
    notes?: string;
    status?: 'matched' | 'unmatched' | 'variance' | 'exception';
    variance_reason?: string;
    attached_documents?: string[];
  }): Promise<{ data?: PaymentReconciliation; error?: any }> {
    try {
      const difference = reconciliationData.closing_balance - reconciliationData.opening_balance;

      const { data, error } = await supabase
        .from('payment_reconciliation')
        .insert({
          ...reconciliationData,
          difference,
          status: reconciliationData.status || (Math.abs(difference) < 0.01 ? 'matched' : 'variance'),
        })
        .select(`
          *,
          payment_records (
            amount,
            reference_number,
            status,
            agents!inner (
              full_name,
              phone_number
            )
          )
        `)
        .single();

      if (error) throw error;

      // Log the reconciliation action
      await supabase
        .from('audit_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'PAYMENT_RECONCILIATION',
          resource_type: 'payment',
          resource_id: reconciliationData.payment_id,
          details: {
            action: 'reconciliation_performed',
            status: data.status,
            difference,
            opening_balance: reconciliationData.opening_balance,
            closing_balance: reconciliationData.closing_balance,
            timestamp: new Date().toISOString()
          }
        });

      return { data: data as PaymentReconciliation };
    } catch (error) {
      return { error };
    }
  }

  // Get reconciliation records
  static async getReconciliationRecords(filters: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    agentId?: string;
  } = {}): Promise<{ data: PaymentReconciliation[]; error?: any }> {
    let query = supabase
      .from('payment_reconciliation')
      .select(`
        *,
        payment_records (
          amount,
          reference_number,
          status,
          agents!inner (
            full_name,
            phone_number
          )
        )
      `)
      .order('reconciliation_date', { ascending: false });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.dateFrom) {
      query = query.gte('reconciliation_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('reconciliation_date', filters.dateTo);
    }
    if (filters.agentId) {
      query = query.eq('payment_records.agent_id', filters.agentId);
    }

    const { data, error } = await query;
    return { data: data as PaymentReconciliation[], error };
  }

  // Get payment audit trail
  static async getPaymentAuditTrail(paymentId: string): Promise<{ data: PaymentAuditTrail[]; error?: any }> {
    const { data, error } = await supabase
      .from('payment_audit_trail')
      .select(`
        *,
        payment_records (
          amount,
          reference_number,
          agents!inner (
            full_name
          )
        )
      `)
      .eq('payment_id', paymentId)
      .order('performed_at', { ascending: false });

    return { data: data as PaymentAuditTrail[], error };
  }

  // Log payment action for audit trail
  static async logPaymentAction(
    paymentId: string,
    action: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    notes?: string
  ): Promise<void> {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      await supabase
        .from('payment_audit_trail')
        .insert({
          payment_id: paymentId,
          action,
          old_values: oldValues,
          new_values: newValues,
          performed_by: user?.id || 'system',
          notes,
        });

      // Also log to general audit log
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user?.id || 'system',
          action: `PAYMENT_${action.toUpperCase()}`,
          resource_type: 'payment',
          resource_id: paymentId,
          details: {
            action,
            old_values: oldValues,
            new_values: newValues,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('Failed to log payment action:', error);
    }
  }

  // Perform automatic reconciliation for batch
  static async reconcileBatch(batchId: string): Promise<{
    total: number;
    matched: number;
    variances: number;
    exceptions: number;
    totalAmount: number;
    matchedAmount: number;
    varianceAmount: number;
    error?: any;
  }> {
    try {
      // Get all payments in batch
      const { data: batchPayments } = await supabase
        .from('payment_records')
        .select('amount, reference_number, status')
        .eq('batch_id', batchId);

      if (!batchPayments || batchPayments.length === 0) {
        return {
          total: 0,
          matched: 0,
          variances: 0,
          exceptions: 0,
          totalAmount: 0,
          matchedAmount: 0,
          varianceAmount: 0
        };
      }

      // Simulate bank statement data (in real implementation, this would come from bank API)
      const bankStatementTotal = batchPayments
        .filter(p => p.status === 'delivered')
        .reduce((sum, p) => sum + p.amount, 0);

      // Calculate variances
      const totalExpected = batchPayments.reduce((sum, p) => sum + p.amount, 0);
      const variance = bankStatementTotal - totalExpected;

      let matched = 0;
      let variances = 0;
      let exceptions = 0;

      // Create reconciliation records
      for (const payment of batchPayments) {
        let status: 'matched' | 'unmatched' | 'variance' | 'exception';
        let varianceReason: string | undefined;

        if (payment.status !== 'delivered') {
          status = 'unmatched';
          exceptions++;
        } else if (Math.abs(variance) < 0.01) {
          status = 'matched';
          matched++;
        } else {
          status = 'variance';
          variances++;
          varianceReason = `Batch variance of ₦${variance.toFixed(2)}`;
        }

        await this.createReconciliation({
          payment_id: payment.id,
          reconciliation_date: new Date().toISOString().split('T')[0],
          opening_balance: 0,
          closing_balance: payment.amount,
          status,
          variance_reason,
          notes: `Automatic batch reconciliation for batch ${batchId}`
        });
      }

      return {
        total: batchPayments.length,
        matched,
        variances,
        exceptions,
        totalAmount: totalExpected,
        matchedAmount: matched * (totalExpected / batchPayments.length),
        varianceAmount: Math.abs(variance)
      };
    } catch (error) {
      return {
        total: 0,
        matched: 0,
        variances: 0,
        exceptions: 0,
        totalAmount: 0,
        matchedAmount: 0,
        varianceAmount: 0,
        error
      };
    }
  }

  // Get reconciliation summary
  static async getReconciliationSummary(dateRange?: {
    from: string;
    to: string;
  }): Promise<{
    totalPayments: number;
    totalAmount: number;
    reconciliationRate: number;
    varianceRate: number;
    exceptionRate: number;
    averageVariance: number;
    statusBreakdown: Record<string, number>;
    trends: Array<{ date: string; matched: number; variances: number; exceptions: number }>;
  }> {
    try {
      let query = supabase
        .from('payment_reconciliation')
        .select(`
          *,
          payment_records (
            amount
          )
        `);

      if (dateRange) {
        query = query
          .gte('reconciliation_date', dateRange.from)
          .lte('reconciliation_date', dateRange.to);
      }

      const { data: reconciliations } = await query;

      if (!reconciliations || reconciliations.length === 0) {
        return {
          totalPayments: 0,
          totalAmount: 0,
          reconciliationRate: 0,
          varianceRate: 0,
          exceptionRate: 0,
          averageVariance: 0,
          statusBreakdown: {},
          trends: []
        };
      }

      const summary = {
        totalPayments: reconciliations.length,
        totalAmount: reconciliations.reduce((sum, r) => sum + (r.payment?.amount || 0), 0),
        reconciliationRate: 0,
        varianceRate: 0,
        exceptionRate: 0,
        averageVariance: 0,
        statusBreakdown: {
          matched: 0,
          unmatched: 0,
          variance: 0,
          exception: 0
        },
        trends: []
      };

      // Calculate status breakdown
      reconciliations.forEach(r => {
        summary.statusBreakdown[r.status]++;
      });

      // Calculate rates
      summary.reconciliationRate = (summary.statusBreakdown.matched / summary.totalPayments) * 100;
      summary.varianceRate = (summary.statusBreakdown.variance / summary.totalPayments) * 100;
      summary.exceptionRate = (summary.statusBreakdown.exception / summary.totalPayments) * 100;

      // Calculate average variance
      const variances = reconciliations
        .filter(r => r.status === 'variance')
        .map(r => Math.abs(r.difference));
      
      if (variances.length > 0) {
        summary.averageVariance = variances.reduce((sum, v) => sum + v, 0) / variances.length;
      }

      // Group by date for trends
      const dailyTrends: Record<string, { matched: number; variances: number; exceptions: number }> = {};
      reconciliations.forEach(r => {
        const date = r.reconciliation_date.split('T')[0];
        if (!dailyTrends[date]) {
          dailyTrends[date] = { matched: 0, variances: 0, exceptions: 0 };
        }
        dailyTrends[date][r.status]++;
      });

      summary.trends = Object.entries(dailyTrends)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return summary;
    } catch (error) {
      return {
        totalPayments: 0,
        totalAmount: 0,
        reconciliationRate: 0,
        varianceRate: 0,
        exceptionRate: 0,
        averageVariance: 0,
        statusBreakdown: {},
        trends: []
      };
    }
  }

  // Generate reconciliation report
  static async generateReconciliationReport(dateRange?: {
    from: string;
    to: string;
  }): Promise<string> {
    try {
      const summary = await this.getReconciliationSummary(dateRange);

      // Generate CSV report
      const report = [
        'Payment Reconciliation Report',
        `Generated: ${new Date().toISOString()}`,
        '',
        'Summary',
        `Total Payments,${summary.totalPayments}`,
        `Total Amount,${summary.totalAmount}`,
        `Reconciliation Rate,${summary.reconciliationRate.toFixed(2)}%`,
        `Variance Rate,${summary.varianceRate.toFixed(2)}%`,
        `Exception Rate,${summary.exceptionRate.toFixed(2)}%`,
        `Average Variance,${summary.averageVariance}`,
        '',
        'Status Breakdown',
        'Matched,' + summary.statusBreakdown.matched,
        'Unmatched,' + summary.statusBreakdown.unmatched,
        'Variance,' + summary.statusBreakdown.variance,
        'Exception,' + summary.statusBreakdown.exception,
        '',
        'Daily Trends',
        'Date,Matched,Variances,Exceptions'
      ];

      // Add daily trends
      summary.trends.forEach(trend => {
        report.push(`${trend.date},${trend.matched},${trend.variances},${trend.exceptions}`);
      });

      return report.join('\n');
    } catch (error) {
      console.error('Failed to generate reconciliation report:', error);
      return '';
    }
  }

  // Resolve reconciliation variance
  static async resolveVariance(
    reconciliationId: string,
    resolutionNotes: string,
    adjustmentAmount?: number
  ): Promise<{ error?: any }> {
    try {
      // Get current reconciliation
      const { data: currentRecon } = await supabase
        .from('payment_reconciliation')
        .select('*')
        .eq('id', reconciliationId)
        .single();

      if (!currentRecon) {
        throw new Error('Reconciliation not found');
      }

      // Update with adjustment if provided
      const newDifference = adjustmentAmount 
        ? currentRecon.closing_balance + adjustmentAmount - currentRecon.opening_balance
        : currentRecon.difference;

      const { error } = await supabase
        .from('payment_reconciliation')
        .update({
          difference: newDifference,
          variance_reason: Math.abs(newDifference) < 0.01 ? 'Resolved: Balanced' : resolutionNotes,
          notes: resolutionNotes,
          reconciled_by: (await supabase.auth.getUser()).data.user?.id,
          reconciled_at: new Date().toISOString(),
          status: Math.abs(newDifference) < 0.01 ? 'matched' : 'resolved'
        })
        .eq('id', reconciliationId);

      if (error) throw error;

      // Log the resolution
      await supabase
        .from('audit_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'RECONCILIATION_VARIANCE_RESOLVED',
          resource_type: 'payment',
          resource_id: reconciliationId,
          details: {
            original_difference: currentRecon.difference,
            new_difference: newDifference,
            adjustment_amount: adjustmentAmount,
            resolution: resolutionNotes,
            timestamp: new Date().toISOString()
          }
        });

      return {};
    } catch (error) {
      return { error };
    }
  }

  // Get payment compliance metrics
  static async getComplianceMetrics(): Promise<{
    totalPayments: number;
    verifiedPayments: number;
    complianceRate: number;
    averageProcessingTime: number;
    failedPaymentRate: number;
    fraudAlertRate: number;
    auditTrailCompleteness: number;
  }> {
    try {
      const [paymentsRes, fraudAlertsRes, auditRes] = await Promise.all([
        // Get payment compliance stats
        supabase
          .from('payment_records')
          .select('status, created_at, approved_at'),
        
        // Get fraud alert stats
        supabase
          .from('fraud_alerts')
          .select('severity, status'),
        
        // Get audit trail coverage
        supabase
          .from('payment_audit_trail')
          .select('payment_id, action')
      ]);

      // For demonstration, we'll use mock data
      // In real implementation, these would be calculated from the actual data
      
      const metrics = {
        totalPayments: 1000, // Mock data
        verifiedPayments: 950, // Mock data
        complianceRate: 95.0,
        averageProcessingTime: 24, // hours
        failedPaymentRate: 5.0,
        fraudAlertRate: 2.5,
        auditTrailCompleteness: 98.0
      };

      return metrics;
    } catch (error) {
      return {
        totalPayments: 0,
        verifiedPayments: 0,
        complianceRate: 0,
        averageProcessingTime: 0,
        failedPaymentRate: 0,
        fraudAlertRate: 0,
        auditTrailCompleteness: 0
      };
    }
  }
}