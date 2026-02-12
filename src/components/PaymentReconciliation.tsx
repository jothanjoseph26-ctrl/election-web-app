import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Balance, 
  FileText, 
  RefreshCw, 
  Download,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Eye,
  Activity,
  Calendar,
  DollarSign
} from 'lucide-react';
import { PaymentReconciliationService, type PaymentReconciliation, type PaymentAuditTrail } from '@/services/paymentReconciliation.service';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface PaymentReconciliationProps {
  className?: string;
}

export function PaymentReconciliation({ className }: PaymentReconciliationProps) {
  const [reconciliations, setReconciliations] = useState<PaymentReconciliation[]>([]);
  const [auditTrails, setAuditTrails] = useState<PaymentAuditTrail[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<PaymentReconciliation | null>(null);
  const [showVarianceDialog, setShowVarianceDialog] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    agentId: ''
  });
  const [varianceResolution, setVarianceResolution] = useState({
    notes: '',
    adjustmentAmount: 0
  });
  const { toast } = useToast();

  // Load reconciliation data
  const loadData = async () => {
    setLoading(true);
    try {
      const [reconciliationsRes, summaryRes] = await Promise.all([
        PaymentReconciliationService.getReconciliationRecords(filters),
        PaymentReconciliationService.getReconciliationSummary()
      ]);

      if (reconciliationsRes.data) setReconciliations(reconciliationsRes.data);
      if (summaryRes) setSummary(summaryRes);

      // Get audit trails for first few reconciliations
      if (reconciliationsRes.data && reconciliationsRes.data.length > 0) {
        const auditPromises = reconciliationsRes.data.slice(0, 10).map(r => 
          PaymentReconciliationService.getPaymentAuditTrail(r.payment_id)
        );

        try {
          const auditResults = await Promise.all(auditPromises);
          const allAudits = auditResults.flatMap(r => r.data || []);
          setAuditTrails(allAudits);
        } catch (error) {
          console.error('Failed to load audit trails:', error);
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load reconciliation data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle variance resolution
  const handleVarianceResolution = async () => {
    if (!selectedReconciliation) return;

    try {
      const { error } = await PaymentReconciliationService.resolveVariance(
        selectedReconciliation.id,
        varianceResolution.notes,
        varianceResolution.adjustmentAmount || undefined
      );

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Variance resolved successfully',
      });

      setShowVarianceDialog(false);
      setVarianceResolution({ notes: '', adjustmentAmount: 0 });
      setSelectedReconciliation(null);
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve variance',
        variant: 'destructive',
      });
    }
  };

  // Generate reconciliation report
  const generateReport = async () => {
    try {
      const reportData = await PaymentReconciliationService.generateReconciliationReport(
        filters.dateFrom && filters.dateTo ? {
          from: filters.dateFrom,
          to: filters.dateTo
        } : undefined
      );

      // Create and download the CSV
      const blob = new Blob([reportData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reconciliation_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Reconciliation report downloaded',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate report',
        variant: 'destructive',
      });
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'bg-green-100 text-green-800';
      case 'unmatched':
        return 'bg-red-100 text-red-800';
      case 'variance':
        return 'bg-yellow-100 text-yellow-800';
      case 'exception':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'matched':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'unmatched':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'variance':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'exception':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <Balance className="h-4 w-4 text-gray-600" />;
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
          <p className="text-muted-foreground">Loading reconciliation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payment Reconciliation</h1>
          <p className="text-muted-foreground">Account verification and audit trail tracking</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={generateReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalPayments.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reconciliation Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.reconciliationRate.toFixed(1)}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${summary.reconciliationRate}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{summary.totalAmount.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Variance</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">₦{summary.averageVariance.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="matched">Matched</option>
                <option value="unmatched">Unmatched</option>
                <option value="variance">Variance</option>
                <option value="exception">Exception</option>
              </select>
            </div>

            <div>
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full mt-1"
              />
            </div>

            <div>
              <Label htmlFor="agentId">Agent ID</Label>
              <Input
                id="agentId"
                value={filters.agentId}
                onChange={(e) => setFilters(prev => ({ ...prev, agentId: e.target.value }))}
                placeholder="Enter agent ID"
                className="w-full mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="reconciliations">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reconciliations">Reconciliations</TabsTrigger>
          <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
        </TabsList>

        {/* Reconciliations Tab */}
        <TabsContent value="reconciliations">
          <Card>
            <CardHeader>
              <CardTitle>Payment Reconciliations</CardTitle>
              <CardDescription>{reconciliations.length} records found</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reconciliations.map((reconciliation) => (
                  <div
                    key={reconciliation.id}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">₦{Math.abs(reconciliation.difference).toLocaleString()}</h3>
                          <Badge className={getStatusColor(reconciliation.status) as any}>
                            {getStatusIcon(reconciliation.status)}
                            {reconciliation.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <p><strong>Payment:</strong> ₦{reconciliation.payment?.amount?.toLocaleString()}</p>
                          <p><strong>Reference:</strong> {reconciliation.payment?.reference_number}</p>
                          <p><strong>Agent:</strong> {reconciliation.payment?.agent?.full_name}</p>
                        </div>

                        {reconciliation.payment?.agent && (
                          <div className="text-sm text-muted-foreground">
                            <p><strong>Phone:</strong> {reconciliation.payment.agent.phone_number}</p>
                          </div>
                        )}

                        {reconciliation.variance_reason && (
                          <Alert className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              <strong>Variance Reason:</strong> {reconciliation.variance_reason}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(reconciliation.reconciliation_date), 'MMM d, yyyy')}
                        </span>
                        {reconciliation.status === 'variance' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedReconciliation(reconciliation);
                              setShowVarianceDialog(true);
                            }}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                      <span>Opening Balance: ₦{reconciliation.opening_balance.toLocaleString()}</span>
                      <span>Closing Balance: ₦{reconciliation.closing_balance.toLocaleString()}</span>
                      <span>Difference: ₦{Math.abs(reconciliation.difference).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit-trail">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Payment Audit Trail
              </CardTitle>
              <CardDescription>Payment modification history and compliance tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditTrails.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No audit trail entries found</p>
                  </div>
                ) : (
                  auditTrails.map((audit, index) => (
                    <div key={audit.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {audit.action.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium">
                              {audit.payment?.amount ? `₦${audit.payment.amount.toLocaleString()}` : 'Payment'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            by {format(new Date(audit.performed_at), 'MMM d, HH:mm')}
                          </div>
                        </div>
                      </div>

                      {audit.old_values && Object.keys(audit.old_values).length > 0 && (
                        <div className="mb-2 p-2 bg-red-50 rounded text-sm">
                          <p className="font-medium text-red-800">Before:</p>
                          <pre className="text-xs text-red-700">
                            {JSON.stringify(audit.old_values, null, 2)}
                          </pre>
                        </div>
                      )}

                      {audit.new_values && Object.keys(audit.new_values).length > 0 && (
                        <div className="mb-2 p-2 bg-green-50 rounded text-sm">
                          <p className="font-medium text-green-800">After:</p>
                          <pre className="text-xs text-green-700">
                            {JSON.stringify(audit.new_values, null, 2)}
                          </pre>
                        </div>
                      )}

                      {audit.notes && (
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Notes:</strong> {audit.notes}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Variance Resolution Dialog */}
      <Dialog open={showVarianceDialog && selectedReconciliation} onOpenChange={setShowVarianceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Payment Variance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedReconciliation && (
              <>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-800" />
                    <div>
                      <h3 className="font-semibold">Variance Detected</h3>
                      <p className="text-sm">Payment: {selectedReconciliation.payment?.reference_number}</p>
                      <p className="text-sm">Amount: ₦{selectedReconciliation.payment?.amount?.toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-sm">
                    Opening Balance: ₦{selectedReconciliation.opening_balance.toLocaleString()}
                  </p>
                  <p className="text-sm">
                    Expected Closing: ₦{selectedReconciliation.closing_balance.toLocaleString()}
                  </p>
                  <p className="text-sm">
                    Actual Difference: <span className="font-bold text-yellow-800">₦{Math.abs(selectedReconciliation.difference).toLocaleString()}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor="varianceNotes">Resolution Notes</Label>
                    <Textarea
                      id="varianceNotes"
                      value={varianceResolution.notes}
                      onChange={(e) => setVarianceResolution(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Explain how this variance was resolved..."
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label htmlFor="adjustmentAmount">Adjustment Amount (₦)</Label>
                    <Input
                      id="adjustmentAmount"
                      type="number"
                      value={varianceResolution.adjustmentAmount}
                      onChange={(e) => setVarianceResolution(prev => ({ ...prev, adjustmentAmount: parseFloat(e.target.value) || 0 }))}
                      placeholder="Enter adjustment amount (if any)"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowVarianceDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleVarianceResolution}>
                    Resolve Variance
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