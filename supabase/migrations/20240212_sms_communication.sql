-- SMS Communication Tables for AMAC Situation Room

-- SMS logs for tracking all outgoing messages
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  provider TEXT NOT NULL DEFAULT 'twilio',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Incoming SMS for two-way communication
CREATE TABLE IF NOT EXISTS sms_incoming (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  agent_id UUID REFERENCES agents(id),
  response_sent BOOLEAN DEFAULT FALSE
);

-- SMS broadcast tracking
CREATE TABLE IF NOT EXISTS sms_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgent')),
  recipients_count INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'twilio',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- WhatsApp message logs
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'location', 'media')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_to_phone ON sms_logs(to_phone);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_incoming_from_phone ON sms_incoming(from_phone);
CREATE INDEX IF NOT EXISTS idx_sms_incoming_processed ON sms_incoming(processed);
CREATE INDEX IF NOT EXISTS idx_sms_incoming_received_at ON sms_incoming(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_broadcasts_created_at ON sms_broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_to_phone ON whatsapp_logs(to_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);

-- Row Level Security
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_incoming ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view SMS logs
CREATE POLICY "Admins can view all SMS logs" ON sms_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Only service role can insert SMS logs
CREATE POLICY "Service role can insert SMS logs" ON sms_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service role can update SMS logs
CREATE POLICY "Service role can update SMS logs" ON sms_logs
  FOR UPDATE WITH CHECK (auth.role() = 'service_role');

-- Only admins can view incoming SMS
CREATE POLICY "Admins can view incoming SMS" ON sms_incoming
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Only service role can insert incoming SMS
CREATE POLICY "Service role can insert incoming SMS" ON sms_incoming
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service role can update incoming SMS
CREATE POLICY "Service role can update incoming SMS" ON sms_incoming
  FOR UPDATE WITH CHECK (auth.role() = 'service_role');

-- Only admins can view SMS broadcasts
CREATE POLICY "Admins can view SMS broadcasts" ON sms_broadcasts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can create SMS broadcasts
CREATE POLICY "Admins can create SMS broadcasts" ON sms_broadcasts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Only admins can view WhatsApp logs
CREATE POLICY "Admins can view WhatsApp logs" ON whatsapp_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Only service role can insert WhatsApp logs
CREATE POLICY "Service role can insert WhatsApp logs" ON whatsapp_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service role can update WhatsApp logs
CREATE POLICY "Service role can update WhatsApp logs" ON whatsapp_logs
  FOR UPDATE WITH CHECK (auth.role() = 'service_role');

-- Function to auto-link incoming SMS to agents
CREATE OR REPLACE FUNCTION link_incoming_sms_to_agent()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to find agent by phone number
  UPDATE sms_incoming 
  SET agent_id = agents.id 
  FROM agents 
  WHERE agents.phone_number = NEW.from_phone 
    AND sms_incoming.id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-link incoming SMS
CREATE TRIGGER trigger_link_incoming_sms_to_agent
  AFTER INSERT ON sms_incoming
  FOR EACH ROW
  EXECUTE FUNCTION link_incoming_sms_to_agent();

-- Function to send SMS confirmation
CREATE OR REPLACE FUNCTION send_sms_report_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- This would typically call the SMS service
  -- For now, we'll just log that a confirmation should be sent
  INSERT INTO sms_logs (to_phone, message, status, provider)
  SELECT 
    agents.phone_number,
    'AMAC: Your report (ID: ' || NEW.id || ') has been received. Thank you.',
    'pending',
    'twilio'
  FROM agents
  WHERE agents.id = NEW.agent_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to send SMS confirmation for new reports
CREATE TRIGGER trigger_send_sms_report_confirmation
  AFTER INSERT ON reports
  FOR EACH ROW
  WHEN (NEW.agent_id IS NOT NULL)
  EXECUTE FUNCTION send_sms_report_confirmation();

-- View for SMS analytics
CREATE OR REPLACE VIEW sms_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_sms,
  COUNT(*) FILTER (WHERE status = 'sent') as sent_sms,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_sms,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'sent') * 100.0) / NULLIF(COUNT(*), 0), 
    2
  ) as success_rate
FROM sms_logs
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- View for incoming SMS analytics
CREATE OR REPLACE VIEW incoming_sms_analytics AS
SELECT 
  DATE_TRUNC('day', received_at) as date,
  COUNT(*) as total_incoming,
  COUNT(*) FILTER (WHERE processed = TRUE) as processed,
  COUNT(*) FILTER (WHERE agent_id IS NOT NULL) as from_registered_agents
FROM sms_incoming
GROUP BY DATE_TRUNC('day', received_at)
ORDER BY date DESC;