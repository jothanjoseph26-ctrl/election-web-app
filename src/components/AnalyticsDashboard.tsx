import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  FileText, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  TrendingUp,
  Activity,
  RefreshCw,
  Download
} from 'lucide-react';
import { AnalyticsService, type RealTimeMetrics, type AnalyticsData } from '@/services/analytics.service';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

interface AnalyticsDashboardProps {
  className?: string;
}

export function AnalyticsDashboard({ className }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  const loadMetrics = async () => {
    try {
      const data = await AnalyticsService.getRealTimeMetrics(timeRange);
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
  };

  useEffect(() => {
    setLoading(true);
    loadMetrics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load analytics data</p>
        <Button onClick={loadMetrics} className="mt-4">Retry</Button>
      </div>
    );
  }

  const pieData = Object.entries(metrics.reportsByType).map(([type, count]) => ({
    name: type.replace('_', ' '),
    value: count
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Election Analytics</h1>
          <p className="text-muted-foreground">Real-time election monitoring insights</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="icon">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalReports.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.todayReports} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeAgents}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalAgents} total ({metrics.wardCoverage.toFixed(1)}% coverage)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent Reports</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{metrics.urgentReports}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalReports > 0 ? ((metrics.urgentReports / metrics.totalReports) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageResponseTime > 0 ? `${metrics.averageResponseTime.toFixed(1)}m` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports by Hour */}
        <Card>
          <CardHeader>
            <CardTitle>Reports Timeline</CardTitle>
            <CardDescription>Reports over the selected time period</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.reportsByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={{ fill: '#2563eb' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Reports by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Report Types</CardTitle>
            <CardDescription>Distribution of report categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ward Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Wards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Top Performing Wards
            </CardTitle>
            <CardDescription>Best reporting coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.topPerformingWards.map((ward, index) => (
                <div key={ward.wardNumber} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{ward.wardName}</p>
                      <p className="text-sm text-muted-foreground">
                        {ward.activeAgentCount}/{ward.agentCount} agents active
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{ward.reportsCount} reports</p>
                    <p className="text-sm text-green-600">{ward.turnoutPercentage.toFixed(1)}% active</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* High Risk Wards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              High Priority Wards
            </CardTitle>
            <CardDescription>Requires immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.highRiskWards.map((ward, index) => (
                <div key={ward.wardNumber} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-800 text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{ward.wardName}</p>
                      <p className="text-sm text-muted-foreground">
                        {ward.activeAgentCount}/{ward.agentCount} agents active
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive">
                      {ward.incidentsCount} incidents
                    </Badge>
                    <p className="text-sm text-red-600 mt-1">
                      {ward.turnoutPercentage.toFixed(1)}% active
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Trends
          </CardTitle>
          <CardDescription>Hourly report patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.reportsByHour}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}