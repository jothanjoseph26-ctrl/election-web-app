import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  RefreshCw,
  Eye,
  Trash2
} from 'lucide-react';
import { PaymentService, type PaymentRecord, type PaymentBatch } from '@/services/payment.service';
import { useToast } from '@/hooks/use-toast';

interface BulkPaymentUploadProps {
  className?: string;
}

interface CSVRow {
  agent_id?: string;
  full_name?: string;
  phone_number?: string;
  amount?: string;
  payment_method?: string;
  reference_number?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  payment_date?: string;
  expected_delivery_date?: string;
  notes?: string;
  priority?: string;
}

interface UploadResult {
  row: CSVRow;
  status: 'pending' | 'success' | 'error';
  error?: string;
  payment_id?: string;
}

const REQUIRED_COLUMNS = [
  'agent_id',
  'amount',
  'payment_method'
];

const OPTIONAL_COLUMNS = [
  'reference_number',
  'bank_name',
  'account_number',
  'account_name',
  'payment_date',
  'expected_delivery_date',
  'notes',
  'priority',
  'full_name',
  'phone_number'
];

export function BulkPaymentUpload({ className }: BulkPaymentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVRow[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Parse CSV file
  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) continue;

      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header as keyof CSVRow] = values[index] || '';
      });
      rows.push(row);
    }

    return rows;
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setPreview(parsed.slice(0, 10)); // Show first 10 rows for preview
    };
    reader.readAsText(selectedFile);
  };

  // Validate CSV structure
  const validateCSV = (rows: CSVRow[]): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

    // Check required columns
    REQUIRED_COLUMNS.forEach(col => {
      if (!headers.includes(col)) {
        errors.push(`Missing required column: ${col}`);
      }
    });

    // Validate data in required columns
    rows.forEach((row, index) => {
      if (!row.agent_id) {
        errors.push(`Row ${index + 1}: Missing agent_id`);
      }
      if (!row.amount || isNaN(parseFloat(row.amount))) {
        errors.push(`Row ${index + 1}: Invalid amount`);
      }
      if (!row.payment_method) {
        errors.push(`Row ${index + 1}: Missing payment_method`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  };

  // Create batch and upload payments
  const handleUpload = async () => {
    if (!file || preview.length === 0) return;

    // Validate CSV
    const validation = validateCSV(preview);
    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    // Validate batch info
    if (!batchName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Batch name is required',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    const uploadResults: UploadResult[] = [];

    try {
      // Create payment batch
      const totalAmount = preview.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
      const { data: batch, error: batchError } = await PaymentService.createPaymentBatch({
        batch_name: batchName,
        description: batchDescription,
        total_amount: totalAmount,
        total_agents: preview.length,
        status: 'processing',
      });

      if (batchError || !batch) {
        throw new Error('Failed to create payment batch');
      }

      // Process each row
      for (const [index, row] of preview.entries()) {
        const result: UploadResult = {
          row,
          status: 'pending'
        };

        try {
          const paymentData = {
            agent_id: row.agent_id,
            amount: parseFloat(row.amount) || 0,
            payment_method: row.payment_method as any,
            reference_number: row.reference_number,
            bank_name: row.bank_name,
            account_number: row.account_number,
            account_name: row.account_name,
            payment_date: row.payment_date,
            expected_delivery_date: row.expected_delivery_date,
            notes: row.notes,
            priority: row.priority as any || 'normal',
            batch_id: batch.id,
          };

          const { error: paymentError } = await PaymentService.createPayment(paymentData);

          if (paymentError) {
            result.status = 'error';
            result.error = paymentError.message || 'Unknown error';
          } else {
            result.status = 'success';
          }
        } catch (error) {
          result.status = 'error';
          result.error = (error as Error).message || 'Unknown error';
        }

        uploadResults.push(result);

        // Update progress
        setResults([...uploadResults]);
      }

      // Update batch status
      const successCount = uploadResults.filter(r => r.status === 'success').length;
      const failedCount = uploadResults.filter(r => r.status === 'error').length;

      const finalBatchStatus = failedCount === 0 ? 'completed' : 
                               successCount > 0 ? 'completed' : 'failed';

      // Update batch status in database (this would be a real API call)
      // await PaymentService.updateBatchStatus(batch.id, finalBatchStatus);

      toast({
        title: 'Upload Complete',
        description: `Successfully processed ${successCount} payments, ${failedCount} failed`,
        variant: failedCount > 0 ? 'destructive' : 'default',
      });

      setShowResults(true);
      setShowPreview(false);
      setFile(null);
      setBatchName('');
      setBatchDescription('');

    } catch (error) {
      toast({
        title: 'Upload Error',
        description: 'Failed to process payments',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    const template = [
      'agent_id,full_name,phone_number,amount,payment_method,reference_number,bank_name,account_number,account_name,payment_date,expected_delivery_date,notes,priority',
      'AGENT_001,John Doe,+2348000000001,5000,bank_transfer,REF001,First Bank,1234567890,John Doe,2024-02-15,2024-02-20,Payment for January services,normal'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payment_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Reset form
  const resetForm = () => {
    setFile(null);
    setPreview([]);
    setResults([]);
    setShowPreview(false);
    setShowResults(false);
    setBatchName('');
    setBatchDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Bulk Payment Upload</h1>
          <p className="text-muted-foreground">Process multiple payments from CSV file</p>
        </div>
        <Button onClick={downloadTemplate} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>Select a CSV file containing payment information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  {file ? file.name : 'Click to select CSV file'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Maximum file size: 10MB • CSV format only
                </p>
              </div>
            </div>

            {file && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-800">
                      File selected: {file.name} ({preview.length} rows)
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium">Batch Name *</label>
                    <input
                      type="text"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      placeholder="Enter batch name"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      value={batchDescription}
                      onChange={(e) => setBatchDescription(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                      placeholder="Enter batch description (optional)"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog open={showPreview} onOpenChange={setShowPreview}>
                    <DialogTrigger asChild>
                      <Button variant="outline" disabled={preview.length === 0}>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview ({preview.length} rows)
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                      <DialogHeader>
                        <DialogTitle>CSV Preview</DialogTitle>
                      </DialogHeader>
                      <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-muted">
                              <th className="border px-4 py-2 text-left">Agent ID</th>
                              <th className="border px-4 py-2 text-left">Name</th>
                              <th className="border px-4 py-2 text-left">Phone</th>
                              <th className="border px-4 py-2 text-left">Amount</th>
                              <th className="border px-4 py-2 text-left">Method</th>
                              <th className="border px-4 py-2 text-left">Reference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.map((row, index) => (
                              <tr key={index} className="hover:bg-muted/50">
                                <td className="border px-4 py-2">{row.agent_id}</td>
                                <td className="border px-4 py-2">{row.full_name}</td>
                                <td className="border px-4 py-2">{row.phone_number}</td>
                                <td className="border px-4 py-2">₦{row.amount}</td>
                                <td className="border px-4 py-2">{row.payment_method}</td>
                                <td className="border px-4 py-2">{row.reference_number}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    onClick={handleUpload}
                    disabled={uploading || !batchName.trim()}
                    className="flex-1"
                  >
                    {uploading ? 'Processing...' : 'Upload Payments'}
                  </Button>

                  <Button onClick={resetForm} variant="outline">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>CSV Requirements</CardTitle>
            <CardDescription>Required and optional columns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Required Columns:</h4>
                <div className="space-y-1">
                  {REQUIRED_COLUMNS.map(col => (
                    <div key={col} className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{col}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Optional Columns:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {OPTIONAL_COLUMNS.map(col => (
                    <div key={col} className="flex items-center gap-2">
                      <div className="h-3 w-3 bg-gray-300 rounded-full" />
                      <span className="text-sm font-mono bg-muted px-2 py-1 rounded text-xs">{col}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> All payment amounts will be processed in Nigerian Naira (₦). 
                  Ensure agent_id matches existing agents in the system.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={results.length / preview.length * 100} className="w-full" />
              <p className="text-center text-sm text-muted-foreground">
                Processing {results.length} of {preview.length} payments...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {showResults && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Results</CardTitle>
            <CardDescription>
              {results.filter(r => r.status === 'success').length} successful, 
              {results.filter(r => r.status === 'error').length} failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="flex items-start justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.row.full_name || result.row.agent_id}</span>
                      <span className="text-sm text-muted-foreground">₦{result.row.amount}</span>
                    </div>
                    {result.error && (
                      <p className="text-sm text-red-600">{result.error}</p>
                    )}
                  </div>
                  <Badge className={getStatusColor(result.status) as any}>
                    {result.status}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={resetForm} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Upload Another File
              </Button>
              <Button onClick={downloadTemplate} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}