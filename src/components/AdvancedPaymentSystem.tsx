import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Upload,
  FileText,
  CreditCard,
  Banknote,
  Smartphone,
  User
} from 'lucide-react';
import { PaymentService, type PaymentRecord, type PaymentBatch, type PaymentTemplate } from '@/services/payment.service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface AdvancedPaymentSystemProps {
  className?: string;
}

export function AdvancedPaymentSystem({ className }: AdvancedPaymentSystemProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [templates, setTemplates] = useState<PaymentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showCreateBatch, setShowCreateBatch] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const { toast } = useToast();

  const [newPayment, setNewPayment] = useState({
    agent_id: '',
    amount: '',
    payment_method: 'bank_transfer',
    priority: 'normal',
    reference_number: '',
    bank_name: '',
    account_number: '',
    account_name: '',
    payment_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    notes: '',
  });

  const [newBatch, setNewBatch] = useState({
    batch_name: '',
    description: '',
    notes: '',
  });

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, batchesRes, templatesRes, statsRes] = await Promise.all([
        PaymentService.getPaymentRecords({
          status: statusFilter === 'all' ? undefined : statusFilter,
          paymentMethod: methodFilter === 'all' ? undefined : methodFilter,
          dateFrom: dateFilter.from || undefined,
          dateTo: dateFilter.to || undefined,
        }),
        PaymentService.getPaymentBatches(),
        PaymentService.getPaymentTemplates(),
        PaymentService.getPaymentStats(dateFilter.from && dateFilter.to ? dateFilter : undefined),
      ]);

      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (batchesRes.data) setBatches(batchesRes.data);
      if (templatesRes.data) setTemplates(templatesRes.data);
      if (statsRes) setPaymentStats(statsRes);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load payment data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, methodFilter, dateFilter]);

  // Create new payment
  const handleCreatePayment = async () => {
    if (!newPayment.agent_id || !newPayment.amount) {
      toast({
        title: 'Validation Error',
        description: 'Agent and amount are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await PaymentService.createPayment({
        ...newPayment,
        amount: parseFloat(newPayment.amount),
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payment created successfully',
      });

      setShowCreatePayment(false);
      setNewPayment({
        agent_id: '',
        amount: '',
        payment_method: 'bank_transfer',
        priority: 'normal',
        reference_number: '',
        bank_name: '',
        account_number: '',
        account_name: '',
        payment_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: '',
        notes: '',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create payment',
        variant: 'destructive',
      });
    }
  };

  // Update payment status
  const updatePaymentStatus = async (paymentId: string, newStatus: string) => {
    try {
      const { error } = await PaymentService.updatePaymentStatus(paymentId, newStatus);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Payment status updated to ${newStatus}`,
      });

      loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update payment status',
        variant: 'destructive',
      });
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get method icon
  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return <Banknote className="h-4 w-4" />;
      case 'mobile_money':
        return <Smartphone className="h-4 w-4" />;
      case 'cash':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'normal':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = !searchQuery || 
      payment.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.agent?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.agent?.phone_number?.includes(searchQuery);
    
    return matchesSearch;
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payment Management</h1>
          <p className="text-muted-foreground">Advanced payment processing and tracking</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showCreatePayment} onOpenChange={setShowCreatePayment}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Payment</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="agent_id">Agent ID</Label>
                  <Input
                    id="agent_id"
                    value={newPayment.agent_id}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, agent_id: e.target.value }))}
                    placeholder="Enter agent ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₦)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Payment Method</Label>
                  <Select value={newPayment.payment_method} onValueChange={(value) => setNewPayment(prev => ({ ...prev, payment_method: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newPayment.priority} onValueChange={(value) => setNewPayment(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference_number">Reference Number</Label>
                  <Input
                    id="reference_number"
                    value={newPayment.reference_number}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, reference_number: e.target.value }))}
                    placeholder="Enter reference number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_date">Payment Date</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={newPayment.payment_date}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, payment_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={newPayment.bank_name}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="Enter bank name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={newPayment.account_number}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, account_number: e.target.value }))}
                    placeholder="Enter account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_name">Account Name</Label>
                  <Input
                    id="account_name"
                    value={newPayment.account_name}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, account_name: e.target.value }))}
                    placeholder="Enter account name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                  <Input
                    id="expected_delivery_date"
                    type="date"
                    value={newPayment.expected_delivery_date}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Enter any additional notes"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreatePayment(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePayment}>
                  Create Payment
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showBulkUpload} onOpenChange={setShowBulkUpload}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Payment Upload</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-muted-foreground mb-4">
                  Upload a CSV file with payment information. The file should include columns for: 
                  agent_id, amount, payment_method, reference_number, etc.
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  className="mb-4"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowBulkUpload(false)}>
                    Cancel
                  </Button>
                  <Button>
                    Upload CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={loadData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Payment Statistics */}
      {paymentStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentStats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{paymentStats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{paymentStats.sent}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{paymentStats.delivered}</div>
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="From Date"
                value={dateFilter.from}
                onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
              />
              <Input
                type="date"
                placeholder="To Date"
                value={dateFilter.to}
                onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment List */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Records</CardTitle>
          <CardDescription>{filteredPayments.length} payment records found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPayments.map((payment) => (
              <div key={payment.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {getMethodIcon(payment.payment_method)}
                        <span className="font-semibold">{payment.agent?.full_name || 'Unknown Agent'}</span>
                      </div>
                      <Badge className={getStatusColor(payment.status) as any}>
                        {payment.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant={getPriorityColor(payment.priority) as any}>
                        {payment.priority}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-medium">₦{payment.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reference</p>
                        <p className="font-medium">{payment.reference_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Agent</p>
                        <p className="font-medium">{payment.agent?.phone_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ward</p>
                        <p className="font-medium">{payment.agent?.ward_name || 'N/A'}</p>
                      </div>
                    </div>

                    {payment.notes && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground">Notes</p>
                        <p className="text-sm">{payment.notes}</p>
                      </div>
                    )}

                    {payment.failure_reason && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-red-800 text-sm">
                        <p className="font-medium">Failure Reason:</p>
                        <p>{payment.failure_reason}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {payment.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => updatePaymentStatus(payment.id, 'verified')}
                      >
                        Verify
                      </Button>
                    )}
                    {payment.status === 'verified' && (
                      <Button
                        size="sm"
                        onClick={() => updatePaymentStatus(payment.id, 'approved')}
                      >
                        Approve
                      </Button>
                    )}
                    {payment.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => updatePaymentStatus(payment.id, 'sent')}
                      >
                        Mark Sent
                      </Button>
                    )}
                    {payment.status === 'sent' && (
                      <Button
                        size="sm"
                        onClick={() => updatePaymentStatus(payment.id, 'delivered')}
                      >
                        Confirm Delivery
                      </Button>
                    )}
                    {payment.status === 'failed' && payment.retry_count < payment.max_retries && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => PaymentService.retryPayment(payment.id)}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>Created: {format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')}</span>
                  {payment.approved_at && (
                    <span>Approved: {format(new Date(payment.approved_at), 'MMM d, yyyy HH:mm')}</span>
                  )}
                  {payment.sent_at && (
                    <span>Sent: {format(new Date(payment.sent_at), 'MMM d, yyyy HH:mm')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}