import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Report = Database['public']['Tables']['reports']['Row'];
type Agent = Database['public']['Tables']['agents']['Row'];
type Payment = Database['public']['Tables']['agents']['Row'] & { payment_amount: number; payment_reference: string; payment_sent_at: string | null };

export class ExportService {
  private static generateFileName(prefix: string, extension: string = 'csv'): string {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    return `${prefix}_${date}_${time}.${extension}`;
  }

  private static convertToCSV(data: any[], headers: Record<string, string>): string {
    if (data.length === 0) return '';

    // Create CSV header
    const headerRow = Object.values(headers).join(',');
    
    // Create data rows
    const dataRows = data.map(row => {
      return Object.keys(headers).map(key => {
        const value = row[key];
        // Handle different data types and escaping
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`; // Escape quotes and wrap in quotes
        }
        return value;
      }).join(',');
    });

    return [headerRow, ...dataRows].join('\n');
  }

  private static convertToExcel(data: any[], headers: Record<string, string>): ArrayBuffer {
    const ws = XLSX.utils.json_to_sheet(data.map(row => {
      const mappedRow: any = {};
      Object.keys(headers).forEach(key => {
        mappedRow[headers[key]] = row[key];
      });
      return mappedRow;
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  // Export Reports
  static async exportReports(format: 'csv' | 'excel' = 'csv', filters?: {
    startDate?: string;
    endDate?: string;
    reportType?: string;
    wardNumber?: string;
  }): Promise<void> {
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          agents (
            full_name,
            phone_number,
            ward_name,
            ward_number
          )
        `);

      // Apply filters
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters?.reportType) {
        query = query.eq('report_type', filters.reportType);
      }
      if (filters?.wardNumber) {
        query = query.eq('ward_number', filters.wardNumber);
      }

      const { data: reports, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const exportData = reports?.map(report => ({
        id: report.id,
        created_at: new Date(report.created_at).toLocaleString(),
        report_type: report.report_type,
        ward_number: report.ward_number,
        details: report.details,
        agent_name: report.agents?.full_name || 'Unknown',
        agent_phone: report.agents?.phone_number || '',
        agent_ward: report.agents?.ward_name || '',
      })) || [];

      const headers = {
        id: 'Report ID',
        created_at: 'Date & Time',
        report_type: 'Report Type',
        ward_number: 'Ward Number',
        details: 'Details',
        agent_name: 'Agent Name',
        agent_phone: 'Agent Phone',
        agent_ward: 'Agent Ward'
      };

      const fileName = this.generateFileName('reports');

      if (format === 'excel') {
        const excelData = this.convertToExcel(exportData, headers);
        saveAs(new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName.replace('csv', 'xlsx'));
      } else {
        const csvData = this.convertToCSV(exportData, headers);
        saveAs(new Blob([csvData], { type: 'text/csv;charset=utf-8' }), fileName);
      }
    } catch (error) {
      console.error('Export reports failed:', error);
      throw new Error('Failed to export reports');
    }
  }

  // Export Payments
  static async exportPayments(format: 'csv' | 'excel' = 'csv', filters?: {
    startDate?: string;
    endDate?: string;
    paymentStatus?: string;
    wardName?: string;
  }): Promise<void> {
    try {
      let query = supabase
        .from('agents')
        .select('*')
        .not('payment_amount', 'is', null);

      // Apply filters
      if (filters?.startDate) {
        query = query.gte('payment_sent_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('payment_sent_at', filters.endDate);
      }
      if (filters?.paymentStatus) {
        query = query.eq('payment_status', filters.paymentStatus);
      }
      if (filters?.wardName) {
        query = query.eq('ward_name', filters.wardName);
      }

      const { data: agents, error } = await query.order('payment_sent_at', { ascending: false });

      if (error) throw error;

      const exportData = agents?.map(agent => ({
        id: agent.id,
        full_name: agent.full_name,
        phone_number: agent.phone_number,
        ward_name: agent.ward_name,
        ward_number: agent.ward_number,
        payment_amount: agent.payment_amount || 0,
        payment_reference: agent.payment_reference || '',
        payment_status: agent.payment_status,
        payment_sent_at: agent.payment_sent_at ? new Date(agent.payment_sent_at).toLocaleString() : '',
        created_at: new Date(agent.created_at).toLocaleString(),
        verification_status: agent.verification_status,
      })) || [];

      const headers = {
        id: 'Agent ID',
        full_name: 'Agent Name',
        phone_number: 'Phone Number',
        ward_name: 'Ward Name',
        ward_number: 'Ward Number',
        payment_amount: 'Payment Amount',
        payment_reference: 'Payment Reference',
        payment_status: 'Payment Status',
        payment_sent_at: 'Payment Date',
        created_at: 'Agent Created',
        verification_status: 'Verification Status'
      };

      const fileName = this.generateFileName('payments');

      if (format === 'excel') {
        const excelData = this.convertToExcel(exportData, headers);
        saveAs(new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName.replace('csv', 'xlsx'));
      } else {
        const csvData = this.convertToCSV(exportData, headers);
        saveAs(new Blob([csvData], { type: 'text/csv;charset=utf-8' }), fileName);
      }
    } catch (error) {
      console.error('Export payments failed:', error);
      throw new Error('Failed to export payments');
    }
  }

  // Export Agents
  static async exportAgents(format: 'csv' | 'excel' = 'csv', filters?: {
    verificationStatus?: string;
    paymentStatus?: string;
    wardName?: string;
  }): Promise<void> {
    try {
      let query = supabase.from('agents').select('*');

      // Apply filters
      if (filters?.verificationStatus) {
        query = query.eq('verification_status', filters.verificationStatus);
      }
      if (filters?.paymentStatus) {
        query = query.eq('payment_status', filters.paymentStatus);
      }
      if (filters?.wardName) {
        query = query.eq('ward_name', filters.wardName);
      }

      const { data: agents, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const exportData = agents?.map(agent => ({
        id: agent.id,
        full_name: agent.full_name,
        phone_number: agent.phone_number,
        ward_name: agent.ward_name,
        ward_number: agent.ward_number,
        pin: agent.pin,
        verification_status: agent.verification_status,
        payment_status: agent.payment_status,
        payment_amount: agent.payment_amount || 0,
        payment_reference: agent.payment_reference || '',
        payment_sent_at: agent.payment_sent_at ? new Date(agent.payment_sent_at).toLocaleString() : '',
        last_report_at: agent.last_report_at ? new Date(agent.last_report_at).toLocaleString() : '',
        notes: agent.notes || '',
        created_at: new Date(agent.created_at).toLocaleString(),
      })) || [];

      const headers = {
        id: 'Agent ID',
        full_name: 'Agent Name',
        phone_number: 'Phone Number',
        ward_name: 'Ward Name',
        ward_number: 'Ward Number',
        pin: 'PIN',
        verification_status: 'Verification Status',
        payment_status: 'Payment Status',
        payment_amount: 'Payment Amount',
        payment_reference: 'Payment Reference',
        payment_sent_at: 'Payment Date',
        last_report_at: 'Last Report',
        notes: 'Notes',
        created_at: 'Agent Created'
      };

      const fileName = this.generateFileName('agents');

      if (format === 'excel') {
        const excelData = this.convertToExcel(exportData, headers);
        saveAs(new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName.replace('csv', 'xlsx'));
      } else {
        const csvData = this.convertToCSV(exportData, headers);
        saveAs(new Blob([csvData], { type: 'text/csv;charset=utf-8' }), fileName);
      }
    } catch (error) {
      console.error('Export agents failed:', error);
      throw new Error('Failed to export agents');
    }
  }

  // Export Audit Logs (Admin only)
  static async exportAuditLogs(format: 'csv' | 'excel' = 'csv', filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    action?: string;
    resourceType?: string;
  }): Promise<void> {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.action) {
        query = query.eq('action', filters.action);
      }
      if (filters?.resourceType) {
        query = query.eq('resource_type', filters.resourceType);
      }

      const { data: logs, error } = await query;

      if (error) throw error;

      const exportData = logs?.map(log => ({
        id: log.id,
        created_at: new Date(log.created_at).toLocaleString(),
        user_id: log.user_id,
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id || '',
        details: JSON.stringify(log.details),
        ip_address: log.ip_address || '',
        user_agent: log.user_agent || '',
      })) || [];

      const headers = {
        id: 'Log ID',
        created_at: 'Date & Time',
        user_id: 'User ID',
        action: 'Action',
        resource_type: 'Resource Type',
        resource_id: 'Resource ID',
        details: 'Details',
        ip_address: 'IP Address',
        user_agent: 'User Agent'
      };

      const fileName = this.generateFileName('audit_logs');

      if (format === 'excel') {
        const excelData = this.convertToExcel(exportData, headers);
        saveAs(new Blob([excelData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName.replace('csv', 'xlsx'));
      } else {
        const csvData = this.convertToCSV(exportData, headers);
        saveAs(new Blob([csvData], { type: 'text/csv;charset=utf-8' }), fileName);
      }
    } catch (error) {
      console.error('Export audit logs failed:', error);
      throw new Error('Failed to export audit logs');
    }
  }
}