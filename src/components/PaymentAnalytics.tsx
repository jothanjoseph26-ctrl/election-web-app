import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  BarChart3, 
  PieChart, 
  Calendar, 
  Download,
  RefreshCw,
  CreditCard,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { PaymentService, type PaymentRecord, type PaymentBatch } from '@/services/payment.service';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface PaymentAnalyticsProps {
  className?: string;
}

interface PaymentAnalytics {
  totalAmount: number;
  totalPayments: number;
  averageAmount: number;
  pendingAmount: number;
  sentAmount: number;
  deliveredAmount: number;
  failedAmount: number;
  byMethod: Record<string, { count: number; amount: number; percentage: number }>;
  byStatus: Record<string, { count: number; amount: number; percentage: number }>;
  byPriority: Record<string, { count: number; amount: number }>;
  byMonth: Array<{ month: string; amount: number; count: number }>;
  topAgents: Array<{ name: string; totalReceived: number; paymentCount: number }>;
  processingTime: { average: number; median: number; fastest: number; slowest: number };
  trends: Array<{ date: string; amount: number; count: number }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function PaymentAnalytics({ className }: PaymentAnalyticsProps) {
  const [analytics, setAnalytics] = useState<PaymentAnalytics | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  // Load analytics data
  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Get date range
      const now = new Date();
      let dateFrom: string;
      
      switch (dateRange) {
        case '7d':
          dateFrom = subDays(now, 7).toISOString().split('T')[0];
          break;
        case '30d':
          dateFrom = subDays(now, 30).toISOString().split('T')[0];
          break;
        case '90d':
          dateFrom = subDays(now, 90).toISOString().split('T')[0];
          break;
        default:
          dateFrom = subDays(now, 30).toISOString().split('T')[0];
      }

      const [paymentsRes, batchesRes] = await Promise.all([
        PaymentService.getPaymentRecords({
          dateFrom,
          dateTo: now.toISOString().split('T')[0],
          limit: 1000,
        }),
        PaymentService.getPaymentBatches(),
      ]);

      const paymentData = paymentsRes.data || [];
      setPayments(paymentData);
      setBatches(batchesRes.data || []);

      // Calculate analytics
      const calculatedAnalytics = calculateAnalytics(paymentData);
      setAnalytics(calculatedAnalytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate comprehensive analytics
  const calculateAnalytics = (paymentData: PaymentRecord[]): PaymentAnalytics => {
    const stats = {
      totalAmount: 0,
      totalPayments: paymentData.length,
      averageAmount: 0,
      pendingAmount: 0,
      sentAmount: 0,
      deliveredAmount: 0,
      failedAmount: 0,
      byMethod: {} as Record<string, { count: number; amount: number; percentage: number }>,
      byStatus: {} as Record<string, { count: number; amount: number; percentage: number }>,
      byPriority: {} as Record<string, { count: number; amount: number }>,
      byMonth: [] as Array<{ month: string; amount: number; count: number }>,
      topAgents: [] as Array<{ name: string; totalReceived: number; paymentCount: number }>,
      processingTime: { average: 0, median: 0, fastest: 0, slowest: 0 },
      trends: [] as Array<{ date: string; amount: number; count: number }>,
    };

    // Calculate basic stats
    paymentData.forEach(payment => {
      const amount = payment.amount;
      stats.totalAmount += amount;

      // By status
      if (!stats.byStatus[payment.status]) {
        stats.byStatus[payment.status] = { count: 0, amount: 0, percentage: 0 };
      }
      stats.byStatus[payment.status].count++;
      stats.byStatus[payment.status].amount += amount;

      // By method
      if (!stats.byMethod[payment.payment_method]) {
        stats.byMethod[payment.payment_method] = { count: 0, amount: 0, percentage: 0 };
      }
      stats.byMethod[payment.payment_method].count++;
      stats.byMethod[payment.payment_method].amount += amount;

      // By priority
      if (!stats.byPriority[payment.priority]) {
        stats.byPriority[payment.priority] = { count: 0, amount: 0 };
      }
      stats.byPriority[payment.priority].count++;
      stats.byPriority[payment.priority].amount += amount;

      // Status-specific amounts
      switch (payment.status) {
        case 'pending':
        case 'verified':
        case 'approved':
          stats.pendingAmount += amount;
          break;
        case 'sent':
          stats.sentAmount += amount;
          break;
        case 'delivered':
          stats.deliveredAmount += amount;
          break;
        case 'failed':
          stats.failedAmount += amount;
          break;
      }
    });

    // Calculate percentages
    Object.keys(stats.byMethod).forEach(method => {
      stats.byMethod[method].percentage = (stats.byMethod[method].amount / stats.totalAmount) * 100;
    });

    Object.keys(stats.byStatus).forEach(status => {
      stats.byStatus[status].percentage = (stats.byStatus[status].count / stats.totalPayments) * 100;
    });

    // Calculate averages
    stats.averageAmount = stats.totalPayments > 0 ? stats.totalAmount / stats.totalPayments : 0;

    // Group by month
    const monthlyData: Record<string, { amount: number; count: number }> = {};
    paymentData.forEach(payment => {
      const month = format(new Date(payment.created_at), 'MMM yyyy');
      if (!monthlyData[month]) {
        monthlyData[month] = { amount: 0, count: 0 };
      }
      monthlyData[month].amount += payment.amount;
      monthlyData[month].count++;
    });

    stats.byMonth = Object.entries(monthlyData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months

    // Top agents
    const agentTotals: Record<string, { name: string; totalReceived: number; paymentCount: number }> = {};
    paymentData.forEach(payment => {
      const agentName = payment.agent?.full_name || 'Unknown';
      if (!agentTotals[agentName]) {
        agentTotals[agentName] = { name: agentName, totalReceived: 0, paymentCount: 0 };
      }
      agentTotals[agentName].totalReceived += payment.amount;
      agentTotals[agentName].paymentCount++;
    });

    stats.topAgents = Object.values(agentTotals)
      .sort((a, b) => b.totalReceived - a.totalReceived)
      .slice(0, 10);

    // Processing time calculations
    const processingTimes = paymentData
      .filter(p => p.approved_at && p.created_at)
      .map(p => {
        const created = new Date(p.created_at);
        const approved = new Date(p.approved_at);
        return Math.floor((approved.getTime() - created.getTime()) / (1000 * 60 * 60)); // hours
      })
      .filter(t => t > 0 && t < 168); // Exclude outliers (> 1 week)

    if (processingTimes.length > 0) {
      processingTimes.sort((a, b) => a - b);
      const mid = Math.floor(processingTimes.length / 2);
      stats.processingTime.fastest = processingTimes[0];
      stats.processingTime.slowest = processingTimes[processingTimes.length - 1];
      stats.processingTime.median = processingTimes.length % 2 === 0 
        ? (processingTimes[mid - 1] + processingTimes[mid]) / 2 
        : processingTimes[mid];
      stats.processingTime.average = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    }

    // Daily trends for last 30 days
    const dailyData: Record<string, { amount: number; count: number }> = {};
    const thirtyDaysAgo = subDays(new Date(), 30);
    
    paymentData
      .filter(p => new Date(p.created_at) >= thirtyDaysAgo)
      .forEach(payment => {
        const date = format(new Date(payment.created_at), 'MMM dd');
        if (!dailyData[date]) {
          dailyData[date] = { amount: 0, count: 0 };
        }
        dailyData[date].amount += payment.amount;
        dailyData[date].count++;
      });

    stats.trends = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return stats;
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

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

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load payment analytics</p>
      </div>
    );
  }

  // Prepare chart data
  const methodData = Object.entries(analytics.byMethod).map(([method, data]) => ({
    name: method.replace('_', ' '),
    amount: data.amount,
    count: data.count,
    percentage: data.percentage,
  }));

  const statusData = Object.entries(analytics.byStatus).map(([status, data]) => ({
    name: status.replace('_', ' '),
    amount: data.amount,
    count: data.count,
    percentage: data.percentage,
  }));

  const pieData = methodData.map((item, index) => ({
    name: item.name,
    value: item.amount
  }));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payment Analytics</h1>
          <p className="text-muted-foreground">Comprehensive payment insights and reporting</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadAnalytics} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold">₦{analytics.totalAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Payments</p>
                    <p className="text-2xl font-bold">{analytics.totalPayments}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Average Amount</p>
                    <p className="text-2xl font-bold">₦{analytics.averageAmount.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Processing Time</p>
                    <p className="text-2xl font-bold">{analytics.processingTime.average}h</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-xl font-bold text-yellow-600">₦{analytics.pendingAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sent</p>
                    <p className="text-xl font-bold text-blue-600">₦{analytics.sentAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Delivered</p>
                    <p className="text-xl font-bold text-green-600">₦{analytics.deliveredAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-xl font-bold text-red-600">₦{analytics.failedAmount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Distribution by payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={methodData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`₦${value.toLocaleString()}`, 'Amount']} />
                    <Bar dataKey="amount" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>Payment status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`₦${value.toLocaleString()}`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Priority Levels</CardTitle>
                <CardDescription>Payment priority breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analytics.byPriority).map(([priority, data]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={priority === 'urgent' ? 'destructive' : priority === 'high' ? 'destructive' : 'default'}>
                          {priority.toUpperCase()}
                        </Badge>
                        <span className="text-sm">{data.count} payments</span>
                      </div>
                      <span className="font-bold">₦{data.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Monthly Trends
                </CardTitle>
                <CardDescription>Payment amounts over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={analytics.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`₦${value.toLocaleString()}`, 'Amount']} />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#2563eb" 
                      strokeWidth={2}
                      dot={{ fill: '#2563eb' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Activity</CardTitle>
                <CardDescription>Last 30 days payment activity</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload[0]) {
                          return (
                            <div className="p-2 border rounded bg-background">
                              <p className="font-medium">{payload[0].payload.date}</p>
                              <p>Amount: ₦{payload[0].payload.amount.toLocaleString()}</p>
                              <p>Count: {payload[0].payload.count}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="amount" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Agents Tab */}
        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Agents by Amount Received
              </CardTitle>
              <CardDescription>Highest payment recipients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topAgents.map((agent, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.paymentCount} payments</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">₦{agent.totalReceived.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batches Tab */}
        <TabsContent value="batches">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Payment Batches
              </CardTitle>
              <CardDescription>Recent payment batch processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {batches.map((batch) => (
                  <div key={batch.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{batch.batch_name}</h3>
                        <p className="text-sm text-muted-foreground">{batch.description}</p>
                      </div>
                      <Badge variant={
                        batch.status === 'completed' ? 'default' :
                        batch.status === 'processing' ? 'secondary' :
                        batch.status === 'failed' ? 'destructive' :
                        'outline'
                      }>
                        {batch.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Amount</p>
                        <p className="font-medium">₦{batch.total_amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Agents</p>
                        <p className="font-medium">{batch.total_agents}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">{format(new Date(batch.created_at), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}