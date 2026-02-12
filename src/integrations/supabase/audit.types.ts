export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: 'agent' | 'report' | 'payment' | 'broadcast' | 'user' | 'system';
  resource_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogInsert {
  user_id: string;
  action: string;
  resource_type: 'agent' | 'report' | 'payment' | 'broadcast' | 'user' | 'system';
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}