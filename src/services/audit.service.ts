import { supabase } from "@/integrations/supabase/client";
import type { AuditLogInsert } from "./audit.types";

export class AuditService {
  private static async getClientInfo() {
    return {
      ip_address: await this.getClientIP(),
      user_agent: navigator.userAgent,
    };
  }

  private static async getClientIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  }

  static async logAction(
    userId: string,
    action: string,
    resourceType: 'agent' | 'report' | 'payment' | 'broadcast' | 'user' | 'system',
    resourceId: string | null = null,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      const clientInfo = await this.getClientInfo();
      
      const logEntry: AuditLogInsert = {
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        ...clientInfo,
      };

      const { error } = await supabase.from('audit_logs').insert(logEntry);
      
      if (error) {
        console.error('Failed to log audit entry:', error);
      }
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }

  // Specific logging methods for common actions
  static async logUserLogin(userId: string, email: string) {
    return this.logAction(userId, 'USER_LOGIN', 'user', userId, { email });
  }

  static async logUserLogout(userId: string) {
    return this.logAction(userId, 'USER_LOGOUT', 'user', userId);
  }

  static async logAgentCreate(userId: string, agentId: string, agentData: any) {
    return this.logAction(userId, 'AGENT_CREATE', 'agent', agentId, agentData);
  }

  static async logAgentUpdate(userId: string, agentId: string, changes: any) {
    return this.logAction(userId, 'AGENT_UPDATE', 'agent', agentId, changes);
  }

  static async logReportCreate(userId: string, reportId: string, reportData: any) {
    return this.logAction(userId, 'REPORT_CREATE', 'report', reportId, reportData);
  }

  static async logPaymentRecord(userId: string, agentId: string, paymentData: any) {
    return this.logAction(userId, 'PAYMENT_RECORD', 'payment', agentId, paymentData);
  }

  static async logBroadcastCreate(userId: string, broadcastId: string, message: string, priority: string) {
    return this.logAction(userId, 'BROADCAST_CREATE', 'broadcast', broadcastId, { message, priority });
  }

  static async logRoleChange(userId: string, targetUserId: string, oldRole: string, newRole: string) {
    return this.logAction(userId, 'ROLE_CHANGE', 'user', targetUserId, { old_role: oldRole, new_role: newRole });
  }

  static async logSystemEvent(action: string, details: Record<string, any> = {}) {
    return this.logAction('system', action, 'system', null, details);
  }
}