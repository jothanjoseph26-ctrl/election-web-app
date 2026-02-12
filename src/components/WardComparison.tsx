import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users,
  BarChart3,
  RefreshCw,
  Download,
  Activity
} from 'lucide-react';
import { AnalyticsService, type WardAnalytics } from '@/services/analytics.service';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface WardComparisonProps {
  className?: string;
}

export function WardComparison({ className }: WardComparisonProps) {
  const [wards, setWards] = useState<WardAnalytics[]>([]);
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [wardDetails, setWardDetails] = useState<WardAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<any[]>([]);

  const loadWards = async () => {
    setLoading(true);
    try {
      // Get all ward analytics
      const { data: allAgents } = await supabase
        .from('agents')
        .select('ward_number, ward_name')
        .eq('verification_status', 'verified');

      if (!allAgents) return;

      const uniqueWards = Array.from(new Set(allAgents.map(a => a.ward_number).filter(Boolean)));
      const wardsData: WardAnalytics[] = [];

      for (const wardNumber of uniqueWards) {
        const analytics = await AnalyticsService.getWardAnalytics(wardNumber, timeRange);
        wardsData.push(analytics);
      }

      setWards(wardsData.sort((a, b) => b.reportsCount - a.reportsCount));
    } catch (error) {
      console.error('Failed to load wards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWardDetails = async (wardNumber: string) => {
    try {
      const details = await AnalyticsService.getWardAnalytics(wardNumber, timeRange);
      setWardDetails(details);
      
      // Load trend data for this ward
      const trends = await AnalyticsService.getHistoricalTrends(7);
      setTrendData(trends);
    } catch (error) {
      console.error('Failed to load ward details:', error);
    }
  };

  const getRiskLevel = (ward: WardAnalytics): 'low' | 'medium' | 'high' => {
    const incidentRate = ward.activeAgentCount > 0 ? ward.incidentsCount / ward.activeAgentCount : 0;
    if (incidentRate > 0.5) return 'high';
    if (incidentRate > 0.2) return 'medium';
    return 'low';
  };

  const getPerformanceGrade = (ward: WardAnalytics): 'A' | 'B' | 'C' | 'D' | 'F' => {
    const performance = ward.turnoutPercentage;
    if (performance >= 90) return 'A';
    if (performance >= 80) return 'B';
    if (performance >= 70) return 'C';
    if (performance >= 60) return 'D';
    return 'F';
  };

  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'outline';
      case 'low': return 'secondary';
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'B': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-yellow-100 text-yellow-800';
      case 'D': return 'bg-orange-100 text-orange-800';
      case 'F': return 'bg-red-100 text-red-800';
    }
  };

  useEffect(() => {
    loadWards();
  }, [timeRange]);

  useEffect(() => {
    if (selectedWard) {
      loadWardDetails(selectedWard);
    }
  }, [selectedWard, timeRange]);

  const topPerformingWards = wards
    .sort((a, b) => b.turnoutPercentage - a.turnoutPercentage)
    .slice(0, 10);

  const highRiskWards = wards
    .sort((a, b) => b.incidentsCount - a.incidentsCount)
    .slice(0, 10);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ward Analysis</h1>
          <p className="text-muted-foreground">Detailed ward performance and risk assessment</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadWards} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Ward Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Ward</CardTitle>
          <CardDescription>Choose a ward for detailed analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedWard} onValueChange={setSelectedWard}>
            <SelectTrigger>
              <SelectValue placeholder="Select a ward to analyze" />
            </SelectTrigger>
            <SelectContent>
              {wards.map((ward) => (
                <SelectItem key={ward.wardNumber} value={ward.wardNumber}>
                  {ward.wardName} ({ward.wardNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {wardDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{wardDetails.wardName}</span>
              <div className="flex gap-2">
                <Badge variant={getRiskColor(getRiskLevel(wardDetails)) as any}>
                  {getRiskLevel(wardDetails).toUpperCase()} RISK
                </Badge>
                <Badge className={getGradeColor(getPerformanceGrade(wardDetails))}>
                  GRADE {getPerformanceGrade(wardDetails)}
                </Badge>
              </div>
            </CardTitle>
            <CardDescription>Ward {wardDetails.wardNumber} performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                <p className="text-2xl font-bold">{wardDetails.reportsCount}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Active Agents</p>
                <p className="text-2xl font-bold">{wardDetails.activeAgentCount}/{wardDetails.agentCount}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Incidents</p>
                <p className="text-2xl font-bold text-red-600">{wardDetails.incidentsCount}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Performance</p>
                <p className="text-2xl font-bold">{wardDetails.turnoutPercentage.toFixed(1)}%</p>
              </div>
            </div>

            {/* Trend Chart */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-4">Activity Trend</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData.slice(-24)}> {/* Last 24 hours */}
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparative Analysis */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Performing Wards
              </CardTitle>
              <CardDescription>Wards with highest agent activity and reporting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPerformingWards.map((ward, index) => (
                  <div key={ward.wardNumber} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{ward.wardName}</p>
                        <p className="text-sm text-muted-foreground">
                          Ward {ward.wardNumber}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{ward.reportsCount} reports</p>
                      <Badge className={getGradeColor(getPerformanceGrade(ward))}>
                        Grade {getPerformanceGrade(ward)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                High Priority Wards
              </CardTitle>
              <CardDescription>Wards requiring immediate attention due to high incident rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {highRiskWards.map((ward, index) => (
                  <div key={ward.wardNumber} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-800 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{ward.wardName}</p>
                        <p className="text-sm text-muted-foreground">
                          Ward {ward.wardNumber}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">
                        {ward.incidentsCount} incidents
                      </Badge>
                      <Badge variant={getRiskColor(getRiskLevel(ward)) as any} className="ml-2">
                        {getRiskLevel(ward).toUpperCase()}
                      </Badge>
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