import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Search, 
  Filter,
  RefreshCw,
  UserCheck,
  FileText,
  DollarSign,
  CreditCard,
  Building
} from 'lucide-react';
import { PaymentService, type PaymentRecord, type PaymentVerification } from '@/services/payment.service';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface PaymentWorkflowProps {
  className?: string;
}

export function PaymentWorkflow({ className }: PaymentWorkflowProps) {
  const [pendingPayments, setPendingPayments] = useState<PaymentRecord[]>([]);
  const [verifications, setVerifications] = useState<PaymentVerification[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);
  const [filters, setFilters] = useState({
    status: 'pending',
    priority: 'all',
    amountRange: 'all',
    dateRange: 'all',
  });
  const [newVerification, setNewVerification] = useState({
    verification_type: 'amount',
    status: 'pending',
    notes: '',
  });
  const { toast } = useToast();

  // Load pending payments
  const loadPendingPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await PaymentService.getPaymentRecords({
        status: filters.status === 'all' ? undefined : filters.status,
        limit: 100,
      });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load pending payments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load verifications for selected payment
  const loadVerifications = async (paymentId: string) => {
    try {
      // This would be a proper API call in real implementation
      // For now, showing placeholder data
      const mockVerifications: PaymentVerification[] = [
        {
          id: '1',
          payment_id: paymentId,
          verification_type: 'amount',
          status: 'passed',
          details: { amount: 5000, verified: true },
          verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          payment_id: paymentId,
          verification_type: 'recipient',
          status: 'passed',
          details: { agent_name: 'John Doe', verified: true },
          verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
        {
          id: '3',
          payment_id: paymentId,
          verification_type: 'duplicate_check',
          status: 'passed',
          details: { duplicate_count: 0 },
          verified_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ];

      setVerifications(mockVerifications);
    } catch (error) {
      console.error('Failed to load verifications:', error);
    }
  };

  // Process payment verification
  const handleVerification = async (paymentId: string) => {
    setVerificationLoading(true);
    try {
      const { error } = await PaymentService.verifyPayment(
        paymentId,
        newVerification.verification_type,
        newVerification.status,
        newVerification.notes
      );

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Payment verification recorded',
      });

      setNewVerification({
        verification_type: 'amount',
        status: 'pending',
        notes: '',
      });

      // Refresh data
      await loadPendingPayments();
      if (selectedPayment) {
        await loadVerifications(selectedPayment.id);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to record verification',
        variant: 'destructive',
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  // Advance payment in workflow
  const advanceWorkflow = async (paymentId: string, action: 'verify' | 'approve' | 'send' | 'deliver') => {
    try {
      let newStatus = '';
      switch (action) {
        case 'verify':
          newStatus = 'verified';
          break;
        case 'approve':
          newStatus = 'approved';
          break;
        case 'send':
          newStatus = 'sent';
          break;
        case 'deliver':
          newStatus = 'delivered';
          break;
      }

      const { error } = await PaymentService.updatePaymentStatus(paymentId, newStatus);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Payment ${action}d successfully`,
      });

      await loadPendingPayments();
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action} payment`,
        variant: 'destructive',
      });
    }
  };

  // Get verification status icon
  const getVerificationIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get verification type icon
  const getVerificationTypeIcon = (type: string) => {
    switch (type) {
      case 'amount':
        return <DollarSign className="h-4 w-4" />;
      case 'recipient':
        return <UserCheck className="h-4 w-4" />;
      case 'reference':
        return <FileText className="h-4 w-4" />;
      case 'bank_details':
        return <Building className="h-4 w-4" />;
      case 'duplicate_check':
        return <Search className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  // Get workflow step status
  const getWorkflowStatus = (payment: PaymentRecord) => {
    const steps = [
      { name: 'Created', completed: true, timestamp: payment.created_at },
      { name: 'Verified', completed: payment.status !== 'pending', timestamp: payment.verified_at },
      { name: 'Approved', completed: ['approved', 'processing', 'sent', 'delivered'].includes(payment.status), timestamp: payment.approved_at },
      { name: 'Sent', completed: ['sent', 'delivered'].includes(payment.status), timestamp: payment.sent_at },
      { name: 'Delivered', completed: payment.status === 'delivered', timestamp: payment.confirmed_at },
    ];

    return steps;
  };

  useEffect(() => {
    loadPendingPayments();
  }, [filters]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Payment Workflow</h1>
          <p className="text-muted-foreground">Verification and approval processes</p>
        </div>
        <div className="flex gap-2">
          <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadPendingPayments} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Payments Requiring Action</CardTitle>
              <CardDescription>{pendingPayments.length} payments need processing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedPayment?.id === payment.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedPayment(payment);
                      loadVerifications(payment.id);
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{payment.agent?.full_name || 'Unknown Agent'}</h3>
                          <Badge variant="outline">₦{payment.amount.toLocaleString()}</Badge>
                          <Badge variant={payment.priority === 'urgent' ? 'destructive' : 'default'}>
                            {payment.priority}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          payment.status === 'verified' ? 'bg-blue-100 text-blue-800' :
                          payment.status === 'approved' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }>
                          {payment.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                      <div>
                        <p className="font-medium">Reference</p>
                        <p>{payment.reference_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="font-medium">Method</p>
                        <p>{payment.payment_method.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <p className="font-medium">Agent Phone</p>
                        <p>{payment.agent?.phone_number || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="font-medium">Created</p>
                        <p>{format(new Date(payment.created_at), 'MMM d, HH:mm')}</p>
                      </div>
                    </div>

                    {/* Workflow Actions */}
                    <div className="flex gap-2">
                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            advanceWorkflow(payment.id, 'verify');
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Verify
                        </Button>
                      )}
                      {payment.status === 'verified' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            advanceWorkflow(payment.id, 'approve');
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      )}
                      {payment.status === 'approved' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            advanceWorkflow(payment.id, 'send');
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Mark Sent
                        </Button>
                      )}
                      {payment.status === 'sent' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            advanceWorkflow(payment.id, 'deliver');
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Confirm Delivery
                        </Button>
                      )}
                    </div>

                    {/* Workflow Progress */}
                    <div className="mt-4 pt-3 border-t">
                      <p className="text-sm font-medium mb-2">Workflow Progress</p>
                      <div className="flex items-center justify-between">
                        {getWorkflowStatus(payment).map((step, index) => (
                          <div key={step.name} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                              step.completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {index + 1}
                            </div>
                            {index < getWorkflowStatus(payment).length - 1 && (
                              <div className={`h-1 w-16 ${
                                step.completed ? 'bg-green-500' : 'bg-gray-300'
                              }`} />
                            )}
                            <span className={`text-xs ml-2 ${step.completed ? 'text-green-800' : 'text-gray-600'}`}>
                              {step.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verification Details */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Verification Details
              </CardTitle>
              <CardDescription>
                {selectedPayment ? `Payment: ${selectedPayment.reference_number}` : 'Select a payment'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedPayment ? (
                <div className="space-y-4">
                  {/* Verification Checklist */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Verification Checklist</h4>
                    {verifications.map((verification) => (
                      <div key={verification.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {getVerificationTypeIcon(verification.verification_type)}
                          <div>
                            <p className="font-medium capitalize">
                              {verification.verification_type.replace('_', ' ')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(verification.created_at), 'MMM d, HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getVerificationIcon(verification.status)}
                          <Badge className={
                            verification.status === 'passed' ? 'bg-green-100 text-green-800' :
                            verification.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }>
                            {verification.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Verification */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Add Verification</h4>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="verification_type">Verification Type</Label>
                        <Select
                          value={newVerification.verification_type}
                          onValueChange={(value) => setNewVerification(prev => ({ ...prev, verification_type: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="amount">Amount</SelectItem>
                            <SelectItem value="recipient">Recipient</SelectItem>
                            <SelectItem value="reference">Reference</SelectItem>
                            <SelectItem value="bank_details">Bank Details</SelectItem>
                            <SelectItem value="duplicate_check">Duplicate Check</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="verification_status">Status</Label>
                        <Select
                          value={newVerification.status}
                          onValueChange={(value) => setNewVerification(prev => ({ ...prev, status: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="passed">Passed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                            <SelectItem value="skipped">Skipped</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="verification_notes">Notes</Label>
                        <Textarea
                          id="verification_notes"
                          value={newVerification.notes}
                          onChange={(e) => setNewVerification(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Enter verification notes..."
                          rows={3}
                        />
                      </div>

                      <Button
                        onClick={() => selectedPayment && handleVerification(selectedPayment.id)}
                        disabled={verificationLoading}
                        className="w-full"
                      >
                        {verificationLoading ? 'Processing...' : 'Add Verification'}
                      </Button>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Payment Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-medium">₦{selectedPayment.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Method:</span>
                        <span className="font-medium">{selectedPayment.payment_method.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agent:</span>
                        <span className="font-medium">{selectedPayment.agent?.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ward:</span>
                        <span className="font-medium">{selectedPayment.agent?.ward_name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Select a payment to view verification details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}