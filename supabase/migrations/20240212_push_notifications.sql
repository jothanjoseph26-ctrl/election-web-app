-- Push Notifications Tables for AMAC Situation Room Mobile App

-- Agent push tokens table
CREATE TABLE IF NOT EXISTS agent_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  app_version TEXT NOT NULL,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, push_token)
);

-- Push notification logs
CREATE TABLE IF NOT EXISTS push_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('broadcast', 'emergency', 'report_acknowledged', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent notification preferences
CREATE TABLE IF NOT EXISTS agent_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  broadcast_notifications BOOLEAN DEFAULT TRUE,
  emergency_notifications BOOLEAN DEFAULT TRUE,
  report_acknowledgements BOOLEAN DEFAULT TRUE,
  system_notifications BOOLEAN DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_push_tokens_agent_id ON agent_push_tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_push_tokens_platform ON agent_push_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_agent_push_tokens_last_active ON agent_push_tokens(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_agent_id ON push_notification_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_type ON push_notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_status ON push_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_created_at ON push_notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_notification_preferences_agent_id ON agent_notification_preferences(agent_id);

-- Row Level Security
ALTER TABLE agent_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Agents can only manage their own push tokens
CREATE POLICY "Agents can manage own push tokens" ON agent_push_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_push_tokens.agent_id
        AND agents.phone_number = (
          SELECT phone_number FROM auth.users WHERE auth.users.id = auth.uid()
        )
    )
  );

-- Service role can manage all push tokens
CREATE POLICY "Service role can manage all push tokens" ON agent_push_tokens
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Only admins can view push notification logs
CREATE POLICY "Admins can view push notification logs" ON push_notification_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Service role can insert push notification logs
CREATE POLICY "Service role can insert push notification logs" ON push_notification_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Service role can update push notification logs
CREATE POLICY "Service role can update push notification logs" ON push_notification_logs
  FOR UPDATE WITH CHECK (auth.role() = 'service_role');

-- Agents can manage their own notification preferences
CREATE POLICY "Agents can manage own notification preferences" ON agent_notification_preferences
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = agent_notification_preferences.agent_id
        AND agents.phone_number = (
          SELECT phone_number FROM auth.users WHERE auth.users.id = auth.uid()
        )
    )
  );

-- Service role can manage all notification preferences
CREATE POLICY "Service role can manage all notification preferences" ON agent_notification_preferences
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Function to clean up inactive push tokens
CREATE OR REPLACE FUNCTION cleanup_inactive_push_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove tokens that haven't been active for 30 days
  DELETE FROM agent_push_tokens 
  WHERE last_active < NOW() - INTERVAL '30 days';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled function (this would be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_push_tokens_daily()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_push_tokens 
  WHERE last_active < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update last_active timestamp
CREATE OR REPLACE FUNCTION update_push_token_last_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_active when token is updated
CREATE TRIGGER trigger_update_push_token_last_active
  BEFORE UPDATE ON agent_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_token_last_active();

-- Function to check quiet hours
CREATE OR REPLACE FUNCTION is_in_quiet_hours(agent_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  pref agent_notification_preferences%ROWTYPE;
  current_time TIME;
BEGIN
  SELECT * INTO pref FROM agent_notification_preferences WHERE agent_id = agent_uuid;
  
  IF NOT FOUND OR NOT pref.quiet_hours_enabled THEN
    RETURN FALSE;
  END IF;
  
  current_time := NOW()::TIME;
  
  -- Handle overnight quiet hours (e.g., 22:00 to 07:00)
  IF pref.quiet_hours_start > pref.quiet_hours_end THEN
    RETURN current_time >= pref.quiet_hours_start OR current_time <= pref.quiet_hours_end;
  ELSE
    RETURN current_time >= pref.quiet_hours_start AND current_time <= pref.quiet_hours_end;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for push notification analytics
CREATE OR REPLACE VIEW push_notification_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  notification_type,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE status = 'sent') as successfully_sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'sent') * 100.0) / NULLIF(COUNT(*), 0), 
    2
  ) as success_rate
FROM push_notification_logs
GROUP BY DATE_TRUNC('day', created_at), notification_type
ORDER BY date DESC, notification_type;

-- View for active agent statistics
CREATE OR REPLACE VIEW agent_push_statistics AS
SELECT 
  DATE_TRUNC('day', last_active) as date,
  platform,
  COUNT(DISTINCT agent_id) as active_agents,
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE last_active >= NOW() - INTERVAL '7 days') as weekly_active
FROM agent_push_tokens
GROUP BY DATE_TRUNC('day', last_active), platform
ORDER BY date DESC, platform;