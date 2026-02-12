-- WhatsApp Integration Tables for AMAC Situation Room

-- WhatsApp group management
CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name TEXT NOT NULL,
  description TEXT,
  phone_numbers TEXT[] DEFAULT '{}',
  broadcast_enabled BOOLEAN DEFAULT TRUE,
  auto_reply_enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp message logs
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  message_content TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'document', 'location', 'payment_update', 'emergency_alert'),
  media_url TEXT,
  thumbnail_url TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  whatsapp_message_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled'),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp agent group membership
CREATE TABLE IF NOT EXISTS whatsapp_agent_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  group_id UUID REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZINE DEFAULT NOW()
);

-- WhatsApp message templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid,
  template_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('broadcast', 'payment_reminder', 'emergency_alert', 'verification_request', 'welcome'),
  message_content TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  auto_send BOOLEAN DEFAULT FALSE,
  conditions JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp analytics
CREATE TABLE IF NOT EXISTS whatsapp_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_sent INTEGER DEFAULT 0,
  delivered INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  read_rate DECIMAL(5,2),
  response_time_avg INTEGER DEFAULT 0,
  group_stats JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp delivery tracking
CREATE TABLE IF NOT EXISTS whatsapp_delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid,
  message_id UUID REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled'),
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_agent_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Policies for groups (admin only)
CREATE POLICY "Admins can manage WhatsApp groups" ON whatsapp_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for messages (admins and operators)
CREATE POLICY "Staff can view WhatsApp messages" ON whatsapp_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins can send WhatsApp messages" ON whatsapp_messages
  FOR INSERT WITH CHECK (
    auth.role() IN ('admin', 'operator')
  );

-- Policies for templates (admin only)
CREATE POLICY "Admins can manage WhatsApp templates" ON whatsapp_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for agent membership
CREATE POLICY "Admins can manage agent groups" ON whatsapp_agent_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Function to add agent to group
CREATE OR REPLACE FUNCTION add_agent_to_whatsapp_group()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if agent is verified
    DECLARE
      agent_verified BOOLEAN;
    BEGIN
      SELECT verification_status INTO agent_verified 
      FROM agents 
      WHERE id = NEW.agent_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Agent not found';
    END;
    
    IF NOT agent_verified THEN
        RAISE EXCEPTION 'Agent must be verified to join WhatsApp group';
    END IF;
    
    -- Check if agent is already in group
    DECLARE
      already_in_group BOOLEAN;
    BEGIN
      SELECT COUNT(*) INTO already_in_group
      FROM whatsapp_agent_groups
      WHERE agent_id = NEW.agent_id 
        AND group_id = NEW.group_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Database error checking group membership';
    END IF;
    
    -- Add agent to group
    INSERT INTO whatsapp_agent_groups (agent_id, group_id, added_by)
    VALUES (NEW.agent_id, NEW.group_id, auth.uid());
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send WhatsApp message via third-party API
CREATE OR REPLACE FUNCTION send_whatsapp_message()
RETURNS TEXT AS $$
BEGIN
    -- This would integrate with WhatsApp Business API
    -- For demo purposes, we'll return a mock response
    RETURN 'Message sent successfully via WhatsApp (demo mode)';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create WhatsApp group
CREATE OR REPLACE FUNCTION create_whatsapp_group()
RETURNS UUID AS $$
BEGIN
    INSERT INTO whatsapp_groups (group_name, description, created_by)
    VALUES (
      NEW.group_name,
      NEW.description,
      auth.uid()
    )
    RETURN (SELECT id FROM whatsapp_groups WHERE group_name = NEW.group_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get message analytics
CREATE OR REPLACE FUNCTION get_whatsapp_analytics() RETURNS TABLE AS $$
    LANGUAGE sql SECURITY DEFINER SECURITY DEFINER;
    RETURN SELECT * FROM whatsapp_analytics ORDER BY date DESC;
END;

-- Function to get agent WhatsApp activity
CREATE OR REPLACE FUNCTION get_agent_whatsapp_activity(
  agent_uuid UUID
) RETURNS TABLE (
    id INTEGER,
    total_sent INTEGER,
    delivered INTEGER,
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE
  ) AS $$
BEGIN
    RETURN 
    SELECT 
        COUNT(*) FILTER (wm.status = 'delivered') as total_sent,
        COUNT(*) FILTER (wm.status = 'delivered') as delivered,
        MAX(wm.message_content) as last_message,
        MAX(wm.created_at) as last_message_at
    FROM whatsapp_messages wm
    WHERE wm.agent_id = agent_uuid
    ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get group activity
CREATE OR REPLACE FUNCTION get_group_whatsapp_activity(
  group_uuid UUID
) RETURNS TABLE (
    members_count INTEGER,
    messages_today INTEGER,
    messages_this_week INTEGER,
    last_message TEXT,
    delivered_rate DECIMAL(5,2),
    last_message_at TIMESTAMP WITH TIME ZONE
  ) AS $$
BEGIN
    RETURN 
    SELECT 
        COUNT(DISTINCT ag.id) as members_count,
        COUNT(wm.id) FILTER (DATE_TRUNC('day', wm.created_at) = CURRENT_DATE) as messages_today,
        COUNT(wm.id) FILTER (DATE_TRUNC('day', wm.created_at) >= DATE_TRUNC('day', CURRENT_DATE) - INTERVAL '7 days')) as messages_this_week,
        COUNT(*) FILTER (wm.status = 'delivered')::real / COUNT(*)::real) * 100 as delivered_rate,
        MAX(wm.message_content) as last_message,
        MAX(wm.created_at) as last_message_at
    FROM whatsapp_messages wm
      INNER JOIN whatsapp_agent_groups wag ON wm.agent_id = wag.agent_id
    WHERE wag.group_id = group_uuid
    ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;