-- Create audit logs table for compliance and security tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('agent', 'report', 'payment', 'broadcast', 'user', 'system')),
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);

-- Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- No one can delete audit logs (immutable record)
CREATE POLICY "No one can delete audit logs" ON audit_logs
  FOR DELETE USING (false);

-- Only system/trigger can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Function to automatically log role changes
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'ROLE_CHANGE',
    'user',
    NEW.user_id,
    jsonb_build_object(
      'old_role', COALESCE(OLD.role, 'none'),
      'new_role', NEW.role
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log role changes
CREATE TRIGGER trigger_log_role_change
  AFTER UPDATE OF role ON user_roles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_role_change();

-- Function to log user logins (to be called from auth hook)
CREATE OR REPLACE FUNCTION log_user_login()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    NEW.id,
    'USER_LOGIN',
    'user',
    NEW.id,
    jsonb_build_object('email', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;