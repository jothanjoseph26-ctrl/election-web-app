import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ExportService } from '@/services/export.service';

interface ExportOptions {
  format?: 'csv' | 'excel';
  startDate?: string;
  endDate?: string;
  reportType?: string;
  paymentStatus?: string;
  verificationStatus?: string;
  wardName?: string;
  wardNumber?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
}

interface ExportControlsProps {
  exportType: 'reports' | 'payments' | 'agents' | 'auditLogs';
  title: string;
  description: string;
  filters?: {
    reportTypes?: string[];
    paymentStatuses?: string[];
    verificationStatuses?: string[];
    wards?: string[];
  };
}

export function ExportControls({ exportType, title, description, filters }: ExportControlsProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      switch (exportType) {
        case 'reports':
          await ExportService.exportReports(exportOptions.format, {
            startDate: exportOptions.startDate,
            endDate: exportOptions.endDate,
            reportType: exportOptions.reportType,
            wardNumber: exportOptions.wardNumber,
          });
          break;
        case 'payments':
          await ExportService.exportPayments(exportOptions.format, {
            startDate: exportOptions.startDate,
            endDate: exportOptions.endDate,
            paymentStatus: exportOptions.paymentStatus,
            wardName: exportOptions.wardName,
          });
          break;
        case 'agents':
          await ExportService.exportAgents(exportOptions.format, {
            verificationStatus: exportOptions.verificationStatus,
            paymentStatus: exportOptions.paymentStatus,
            wardName: exportOptions.wardName,
          });
          break;
        case 'auditLogs':
          await ExportService.exportAuditLogs(exportOptions.format, {
            startDate: exportOptions.startDate,
            endDate: exportOptions.endDate,
            userId: exportOptions.userId,
            action: exportOptions.action,
            resourceType: exportOptions.resourceType,
          });
          break;
      }

      toast({
        title: 'Export successful',
        description: `Your ${exportType} data has been exported successfully.`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: 'There was an error exporting your data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Format Selection */}
        <div className="space-y-2">
          <Label htmlFor="format">Export Format</Label>
          <Select
            value={exportOptions.format}
            onValueChange={(value: 'csv' | 'excel') => 
              setExportOptions(prev => ({ ...prev, format: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="excel">Excel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filters Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="w-full"
        >
          <Filter className="h-4 w-4 mr-2" />
          {showFilters ? 'Hide' : 'Show'} Filters
        </Button>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="space-y-3 border-t pt-3">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={exportOptions.startDate || ''}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    startDate: e.target.value 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={exportOptions.endDate || ''}
                  onChange={(e) => setExportOptions(prev => ({ 
                    ...prev, 
                    endDate: e.target.value 
                  }))}
                />
              </div>
            </div>

            {/* Report Type Filter */}
            {exportType === 'reports' && filters?.reportTypes && (
              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type</Label>
                <Select
                  value={exportOptions.reportType || ''}
                  onValueChange={(value) => 
                    setExportOptions(prev => ({ ...prev, reportType: value || undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {filters.reportTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Payment Status Filter */}
            {(exportType === 'payments' || exportType === 'agents') && filters?.paymentStatuses && (
              <div className="space-y-2">
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <Select
                  value={exportOptions.paymentStatus || ''}
                  onValueChange={(value) => 
                    setExportOptions(prev => ({ ...prev, paymentStatus: value || undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    {filters.paymentStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Verification Status Filter */}
            {exportType === 'agents' && filters?.verificationStatuses && (
              <div className="space-y-2">
                <Label htmlFor="verificationStatus">Verification Status</Label>
                <Select
                  value={exportOptions.verificationStatus || ''}
                  onValueChange={(value) => 
                    setExportOptions(prev => ({ ...prev, verificationStatus: value || undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    {filters.verificationStatuses.map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Ward Filter */}
            {(exportType === 'reports' || exportType === 'payments' || exportType === 'agents') && filters?.wards && (
              <div className="space-y-2">
                <Label htmlFor="ward">Ward</Label>
                <Select
                  value={exportOptions.wardName || exportOptions.wardNumber || ''}
                  onValueChange={(value) => 
                    setExportOptions(prev => ({ 
                      ...prev, 
                      wardName: exportType === 'reports' ? undefined : value,
                      wardNumber: exportType === 'reports' ? value : undefined
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All wards" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Wards</SelectItem>
                    {filters.wards.map(ward => (
                      <SelectItem key={ward} value={ward}>{ward}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Export Button */}
        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting...' : `Export ${exportType}`}
        </Button>
      </CardContent>
    </Card>
  );
}