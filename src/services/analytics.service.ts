import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface WardAnalytics {
  wardNumber: string;
  wardName: string;
  reportsCount: number;
  turnoutPercentage: number;
  incidentsCount: number;
  lastReportTime: string;
  agentCount: number;
  activeAgentCount: number;
}

export interface RealTimeMetrics {
  totalReports: number;
  todayReports: number;
  activeAgents: number;
  totalAgents: number;
  urgentReports: number;
  averageResponseTime: number;
  wardCoverage: number;
  reportsByType: Record<string, number>;
  reportsByHour: AnalyticsData[];
  topPerformingWards: WardAnalytics[];
  highRiskWards: WardAnalytics[];
  recentTrends: AnalyticsData[];
}

export class AnalyticsService {
  // Real-time dashboard metrics
  static async getRealTimeMetrics(timeRange: '1h' | '6h' | '24h' | '7d' = '24h'): Promise<RealTimeMetrics> {
    const now = new Date();
    const startTime = this.getTimeRangeStart(now, timeRange);
    
    const [agentsData, reportsData, recentReports] = await Promise.all([
      this.getAgentMetrics(startTime),
      this.getReportsMetrics(startTime),
      this.getRecentReports(24) // Last 24 hours for trends
    ]);

    const totalAgents = agentsData.total;
    const activeAgents = agentsData.active;
    const totalReports = reportsData.total;
    const todayReports = reportsData.today;
    const urgentReports = reportsData.urgent;
    const averageResponseTime = reportsData.avgResponseTime;
    const wardCoverage = totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 0;

    const reportsByType = this.groupReportsByType(reportsData.reports);
    const reportsByHour = this.groupReportsByHour(reportsData.reports);
    const recentTrends = this.calculateTrends(recentReports);
    
    const topPerformingWards = await this.getTopWards('performance', 5);
    const highRiskWards = await this.getTopWards('risk', 5);

    return {
      totalReports,
      todayReports,
      activeAgents,
      totalAgents,
      urgentReports,
      averageResponseTime,
      wardCoverage,
      reportsByType,
      reportsByHour,
      topPerformingWards,
      highRiskWards,
      recentTrends
    };
  }

  private static getTimeRangeStart(now: Date, range: string): Date {
    const start = new Date(now);
    switch (range) {
      case '1h':
        start.setHours(start.getHours() - 1);
        break;
      case '6h':
        start.setHours(start.getHours() - 6);
        break;
      case '24h':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
    }
    return start;
  }

  private static async getAgentMetrics(startTime: Date): Promise<{ total: number; active: number }> {
    const { data: agents } = await supabase
      .from('agents')
      .select('id, last_report_at, verification_status');

    if (!agents) return { total: 0, active: 0 };

    const total = agents.filter(a => a.verification_status === 'verified').length;
    const active = agents.filter(a => 
      a.verification_status === 'verified' && 
      a.last_report_at && 
      new Date(a.last_report_at) >= startTime
    ).length;

    return { total, active };
  }

  private static async getReportsMetrics(startTime: Date): Promise<{
    total: number;
    today: number;
    urgent: number;
    avgResponseTime: number;
    reports: any[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: reports } = await supabase
      .from('reports')
      .select('*')
      .gte('created_at', startTime);

    if (!reports) return { total: 0, today: 0, urgent: 0, avgResponseTime: 0, reports: [] };

    const total = reports.length;
    const todayReports = reports.filter(r => new Date(r.created_at) >= today).length;
    const urgentReports = reports.filter(r => 
      ['emergency', 'incident'].includes(r.report_type)
    ).length;

    // Calculate average response time (time from report to first action)
    const responseTimes = reports
      .filter(r => r.report_type === 'emergency')
      .map(r => {
        // This would be calculated based on when action was taken
        // For now, using a placeholder calculation
        return Math.floor(Math.random() * 30) + 5; // 5-35 minutes
      });
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    return { total, today: todayReports, urgent: urgentReports, avgResponseTime, reports };
  }

  private static async getRecentReports(hours: number): Promise<any[]> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const { data: reports } = await supabase
      .from('reports')
      .select('created_at, report_type')
      .gte('created_at', startTime)
      .order('created_at', { ascending: true });

    return reports || [];
  }

  private static groupReportsByType(reports: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    reports.forEach(report => {
      grouped[report.report_type] = (grouped[report.report_type] || 0) + 1;
    });
    return grouped;
  }

  private static groupReportsByHour(reports: any[]): AnalyticsData[] {
    const hours: Record<string, number> = {};
    
    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0');
      hours[hour] = 0;
    }

    reports.forEach(report => {
      const hour = new Date(report.created_at).getHours().toString().padStart(2, '0');
      hours[hour]++;
    });

    return Object.entries(hours).map(([hour, count]) => ({
      timestamp: `${hour}:00`,
      value: count,
      label: `${hour}:00`
    }));
  }

  private static calculateTrends(reports: any[]): AnalyticsData[] {
    const hourlyData: Record<string, number> = {};
    
    reports.forEach(report => {
      const hour = new Date(report.created_at).getHours();
      const timeSlot = `${hour}:00`;
      hourlyData[timeSlot] = (hourlyData[timeSlot] || 0) + 1;
    });

    return Object.entries(hourlyData)
      .map(([time, count]) => ({
        timestamp: time,
        value: count,
        label: time
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private static async getTopWards(type: 'performance' | 'risk', limit: number = 5): Promise<WardAnalytics[]> {
    // Get ward-level analytics
    const { data: wardData } = await supabase
      .from('reports')
      .select(`
        ward_number,
        count(*) as reports_count,
        agents!inner(
          ward_name,
          full_name
        )
      `)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      .not('ward_number', 'is', null)
      .group('ward_number, agents.ward_name, agents.full_name');

    if (!wardData) return [];

    const wardsWithMetrics: WardAnalytics[] = [];

    for (const ward of wardData) {
      const { data: agentsInWard } = await supabase
        .from('agents')
        .select('id, verification_status, last_report_at')
        .eq('ward_number', ward.ward_number);

      const totalAgents = agentsInWard?.filter(a => a.verification_status === 'verified').length || 0;
      const activeAgents = agentsInWard?.filter(a => 
        a.verification_status === 'verified' && 
        a.last_report_at && 
        new Date(a.last_report_at) >= new Date(Date.now() - 6 * 60 * 60 * 1000) // Active in last 6 hours
      ).length || 0;

      // Calculate incident rate
      const incidents = parseInt(ward.reports_count);
      const performanceScore = totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 0;
      const riskScore = incidents > 0 ? Math.min((incidents / Math.max(activeAgents, 1)) * 100, 100) : 0;

      const analytics: WardAnalytics = {
        wardNumber: ward.ward_number,
        wardName: ward.agents?.ward_name || `Ward ${ward.ward_number}`,
        reportsCount: incidents,
        turnoutPercentage: performanceScore, // Using performance as proxy for turnout reporting
        incidentsCount: incidents,
        lastReportTime: new Date().toISOString(),
        agentCount: totalAgents,
        activeAgentCount: activeAgents
      };

      wardsWithMetrics.push(analytics);
    }

    // Sort by performance or risk
    return wardsWithMetrics
      .sort((a, b) => {
        if (type === 'performance') {
          return b.turnoutPercentage - a.turnoutPercentage;
        } else {
          return b.incidentsCount - a.incidentsCount;
        }
      })
      .slice(0, limit);
  }

  // Ward-specific analytics
  static async getWardAnalytics(wardNumber: string, timeRange: '24h' | '7d' | '30d' = '24h'): Promise<WardAnalytics> {
    const startTime = this.getTimeRangeStart(new Date(), timeRange);

    const { data: reports } = await supabase
      .from('reports')
      .select('*')
      .eq('ward_number', wardNumber)
      .gte('created_at', startTime);

    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .eq('ward_number', wardNumber)
      .eq('verification_status', 'verified');

    const totalAgents = agents?.length || 0;
    const activeAgents = agents?.filter(a => 
      a.last_report_at && 
      new Date(a.last_report_at) >= startTime
    ).length || 0;

    const incidentsCount = reports?.filter(r => 
      ['emergency', 'incident'].includes(r.report_type)
    ).length || 0;

    return {
      wardNumber,
      wardName: agents?.[0]?.ward_name || `Ward ${wardNumber}`,
      reportsCount: reports?.length || 0,
      turnoutPercentage: totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 0,
      incidentsCount,
      lastReportTime: reports?.[0]?.created_at || new Date().toISOString(),
      agentCount: totalAgents,
      activeAgentCount: activeAgents
    };
  }

  // Historical trends
  static async getHistoricalTrends(days: number = 30): Promise<AnalyticsData[]> {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);

    const { data: reports } = await supabase
      .from('reports')
      .select('created_at, report_type')
      .gte('created_at', startTime)
      .order('created_at', { ascending: true });

    if (!reports) return [];

    const dailyData: Record<string, { total: number; byType: Record<string, number> }> = {};

    reports.forEach(report => {
      const day = new Date(report.created_at).toISOString().split('T')[0];
      if (!dailyData[day]) {
        dailyData[day] = { total: 0, byType: {} };
      }
      dailyData[day].total++;
      dailyData[day].byType[report.report_type] = (dailyData[day].byType[report.report_type] || 0) + 1;
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      timestamp: date,
      value: data.total,
      label: new Date(date).toLocaleDateString()
    }));
  }

  // Predictive analytics
  static async getPredictions(wardNumber?: string): Promise<{
    expectedReports: number;
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    // Simple predictive model based on historical patterns
    const { data: historicalData } = await supabase
      .from('reports')
      .select('created_at, report_type, ward_number')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .filter(wardNumber ? eq => eq('ward_number', wardNumber) : undefined);

    const totalReports = historicalData?.length || 0;
    const dailyAverage = totalReports / 7;
    const emergencyReports = historicalData?.filter(r => r.report_type === 'emergency').length || 0;
    const incidentReports = historicalData?.filter(r => r.report_type === 'incident').length || 0;

    const expectedReports = Math.ceil(dailyAverage * 1.2); // 20% increase expectation
    const riskLevel = (emergencyReports + incidentReports) > totalReports * 0.3 ? 'high' : 
                    (emergencyReports + incidentReports) > totalReports * 0.1 ? 'medium' : 'low';

    const recommendations = [];
    if (riskLevel === 'high') {
      recommendations.push('Increase monitoring in high-risk areas');
      recommendations.push('Prepare emergency response teams');
    }
    if (dailyAverage > 10) {
      recommendations.push('Consider deploying additional agents');
    }

    return {
      expectedReports,
      riskLevel,
      recommendations
    };
  }
}