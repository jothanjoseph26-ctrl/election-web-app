import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Shield, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity,
  RefreshCw,
  Search,
  Filter,
  TrendingUp,
  Users,
  FileText
} from 'lucide-react';
import { FraudDetectionService, type FraudAlert } from '@/services/fraudDetection.service';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';

interface FraudDetectionDashboardProps {
  className?: string;
}

export function FraudDetectionDashboard({ className }: FraudDetectionDashboardProps) {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [showInvestigation, setShowInvestigation] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    severity: 'all',
    dateRange: '30d'
  });
  const [investigationNotes, setInvestigationNotes] = useState('');
  const { toast } = useToast();

  // Load fraud alerts and analytics
  const loadData = async () => {
    setLoading(true);
    try {
      // Calculate date range
      let dateFrom: string;
      switch (filters.dateRange) {
        case '7d':
          dateFrom = subDays(new Date(), 7).toISOString().split('T')[0];
          break;
        case '30d':
          dateFrom = subDays(new Date(), 30).toISOString().split('T')[0];
          break;
        case '90d':
          dateFrom = subDays(new Date(), 90).toISOString().split('T')[0];
          break;
        default:
          dateFrom = subDays(new Date(), 30).toISOString().split('T')[0];
      }

      const [alertsRes, analyticsRes] = await Promise.all([
        FraudDetectionService.getFraudAlerts({
          status: filters.status === 'all' ? undefined : filters.status,
          severity: filters.severity === 'all' ? undefined : filters.severity,
          dateFrom,
          limit: 100
        }),
        FraudDetectionService.getFraudAnalytics()
      ]);

      if (alertsRes.data) setAlerts(alertsRes.data);
      if (analyticsRes) setAnalytics(analyticsRes);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load fraud detection data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle alert status update
  const handleStatusUpdate = async (alertId: string, status: string, notes?: string) => {
    try {
      const { error } = await FraudDetectionService.updateAlertStatus(alertId, status, notes);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Alert status updated to ${status}`,
      });

      // Close investigation dialog if resolving
      if (status === 'resolved' || status === 'false_positive') {
        setShowInvestigation(false);
        setSelectedAlert(null);
        setInvestigationNotes('');
      }

      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update alert status',
        variant: 'destructive',
      });
    }
  };

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'false_positive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'low':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading fraud detection data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-600" />
            Fraud Detection
          </h1>
          <p className="text-muted-foreground">AI-powered fraud detection and risk monitoring</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filters.severity}
            onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
            className="px-3 py-2 border rounded text-sm"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border rounded text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="false_positive">False Positive</option>
          </select>
          <Button onClick={loadData} variant="outline">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Fraud Analytics Summary */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalAlerts}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Cases</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{analytics.openAlerts}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{analytics.resolvedAlerts}</div>
              <p className="text-xs text-muted-foreground">Successfully handled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{analytics.criticalAlerts}</div>
              <p className="text-xs text-muted-foreground">Immediate action needed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fraud Alert List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Fraud Alerts
          </CardTitle>
          <CardDescription>{alerts.length} alerts detected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">Risk Score: {alert.risk_score}</h3>
                      <Badge className={getSeverityColor(alert.severity) as any}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <Badge className={getStatusColor(alert.status) as any}>
                        {alert.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>

                    <div className="text-sm text-muted-foreground mb-2">
                      <p><strong>Rule:</strong> {alert.rule?.name}</p>
                      <p><strong>Payment:</strong> ₦{alert.payment?.amount?.toLocaleString()} to {alert.payment?.agent?.full_name}</p>
                      <p><strong>Detected:</strong> {format(new Date(alert.detected_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>

                    {alert.details?.reason && (
                      <Alert className="mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Alert Reason:</strong> {alert.details.reason}
                          {Object.entries(alert.details).filter(([key]) => key !== 'reason').map(([key, value]) => (
                            <div key={key} className="mt-1">
                              <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : value}
                            </div>
                          ))}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {alert.status === 'open' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(alert.id, 'investigating');
                        }}
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        Investigate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlert(alert);
                        setShowInvestigation(true);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Investigation Dialog */}
      <Dialog open={showInvestigation && selectedAlert} onOpenChange={setShowInvestigation}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Fraud Investigation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAlert && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Alert ID</p>
                    <p className="font-mono">{selectedAlert.id.substring(0, 8)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Risk Score</p>
                    <p className="font-bold">{selectedAlert.risk_score}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Severity</p>
                    <Badge className={getSeverityColor(selectedAlert.severity) as any}>
                      {selectedAlert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge className={getStatusColor(selectedAlert.status) as any}>
                      {selectedAlert.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Detection Details</p>
                  <div className="p-3 bg-muted rounded text-sm">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(selectedAlert.details, null, 2)}
                    </pre>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Payment Information</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p>Amount: ₦{selectedAlert.payment?.amount?.toLocaleString()}</p>
                      <p>Agent: {selectedAlert.payment?.agent?.full_name}</p>
                      <p>Phone: {selectedAlert.payment?.agent?.phone_number}</p>
                    </div>
                    <div>
                      <p>Payment ID: {selectedAlert.payment_id?.substring(0, 8)}</p>
                      <p>Ward: {selectedAlert.payment?.agent?.ward_name}</p>
                      <p>Detected: {format(new Date(selectedAlert.detected_at), 'MMM d, HH:mm')}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Investigation Notes</label>
                  <Textarea
                    value={investigationNotes}
                    onChange={(e) => setInvestigationNotes(e.target.value)}
                    placeholder="Enter investigation notes..."
                    rows={4}
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleStatusUpdate(selectedAlert.id, 'resolved', investigationNotes)}
                    variant="default"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark Resolved
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate(selectedAlert.id, 'false_positive', investigationNotes)}
                    variant="outline"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    False Positive
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate(selectedAlert.id, 'investigating', investigationNotes)}
                    variant="outline"
                  >
                    <Activity className="h-4 w-4 mr-1" />
                    Continue Investigation
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}