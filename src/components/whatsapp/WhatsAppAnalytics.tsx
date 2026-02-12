import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { WhatsAppService } from '@/services/whatsapp.service';
import type { WhatsAppAnalytics } from '@/services/whatsapp.service';
import { MessageSquare, Users, TrendingUp, AlertCircle, Calendar, Download } from 'lucide-react';

export function WhatsAppAnalytics() {
  const [analytics, setAnalytics] = useState<WhatsAppAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [selectedMetric, setSelectedMetric] = useState<'messages' | 'delivery' | 'engagement'>('messages');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data, error } = await WhatsAppService.getAnalytics(dateRange);
      
      if (error) throw error;
      
      setAnalytics(data || generateMockAnalytics());
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setAnalytics(generateMockAnalytics());
    } finally {
      setLoading(false);
    }
  };

  const generateMockAnalytics = (): WhatsAppAnalytics[] => {
    const days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      days.push({
        date: date.toISOString().split('T')[0],
        total_sent: Math.floor(Math.random() * 500) + 100,
        delivered: Math.floor(Math.random() * 450) + 90,
        failed: Math.floor(Math.random() * 50) + 5,
        read_rate: Math.random() * 0.4 + 0.6,
        response_time_avg: Math.floor(Math.random() * 300) + 60,
        group_stats: {
          'Field Agents': Math.floor(Math.random() * 200) + 50,
          'Supervisors': Math.floor(Math.random() * 100) + 20,
          'Admin': Math.floor(Math.random() * 50) + 10,
        },
      });
    }
    
    return days;
  };

  const calculateTotals = () => {
    return analytics.reduce(
      (acc, day) => ({
        total_sent: acc.total_sent + day.total_sent,
        delivered: acc.delivered + day.delivered,
        failed: acc.failed + day.failed,
        read_rate: acc.read_rate + day.read_rate,
        response_time_avg: acc.response_time_avg + day.response_time_avg,
      }),
      { total_sent: 0, delivered: 0, failed: 0, read_rate: 0, response_time_avg: 0 }
    );
  };

  const totals = calculateTotals();
  const deliveryRate = totals.total_sent > 0 ? (totals.delivered / totals.total_sent) * 100 : 0;
  const avgReadRate = analytics.length > 0 ? (totals.read_rate / analytics.length) * 100 : 0;
  const avgResponseTime = analytics.length > 0 ? totals.response_time_avg / analytics.length : 0;

  const pieData = [
    { name: 'Delivered', value: totals.delivered, color: '#10b981' },
    { name: 'Failed', value: totals.failed, color: '#ef4444' },
    { name: 'Pending', value: totals.total_sent - totals.delivered - totals.failed, color: '#f59e0b' },
  ].filter(item => item.value > 0);

  const groupData = analytics.length > 0 ? 
    Object.entries(analytics[analytics.length - 1]?.group_stats || {}).map(([name, value]) => ({
      name,
      value: value as number,
    })) : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">WhatsApp Analytics</h2>
          <p className="text-muted-foreground">Monitor messaging performance and engagement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="from-date">From Date</Label>
              <Input
                id="from-date"
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="to-date">To Date</Label>
              <Input
                id="to-date"
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.total_sent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{totals.delivered.toLocaleString()} delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgReadRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Average engagement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgResponseTime)}s</div>
            <p className="text-xs text-muted-foreground">Time to first read</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message Volume Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Message Volume</CardTitle>
            <CardDescription>Daily message statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Line type="monotone" dataKey="total_sent" stroke="#3b82f6" strokeWidth={2} name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} name="Delivered" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Delivery Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Status</CardTitle>
            <CardDescription>Overall message delivery breakdown</CardDescription>
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
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Messages']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Group Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Group Activity</CardTitle>
            <CardDescription>Messages by group (latest day)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={groupData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Messages']} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Read Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Engagement Rate</CardTitle>
            <CardDescription>Daily read percentage</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Read Rate']}
                />
                <Line type="monotone" dataKey="read_rate" stroke="#10b981" strokeWidth={2} name="Read Rate" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}