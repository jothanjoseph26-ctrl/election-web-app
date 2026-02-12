-- Fraud Detection System Tables for AMAC Payment System

-- Fraud detection rules configuration
CREATE TABLE IF NOT EXISTS fraud_detection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('duplicate_payment', 'amount_anomaly', 'frequency_anomaly', 'velocity_check', 'location_anomaly', 'time_pattern', 'agent_risk')),
  enabled BOOLEAN DEFAULT TRUE,
  threshold INTEGER NOT NULL DEFAULT 0,
  weight INTEGER NOT NULL DEFAULT 0,
  conditions JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fraud alerts
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES fraud_detection_rules(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL DEFAULT 0,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  details JSONB DEFAULT '{}',
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  auto_resolved BOOLEAN DEFAULT FALSE,
  auto_resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fraud investigation notes
CREATE TABLE IF NOT EXISTS fraud_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES fraud_alerts(id) ON DELETE CASCADE,
  investigator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  investigation_notes TEXT,
  evidence JSONB DEFAULT '[]',
  findings TEXT,
  conclusion TEXT NOT NULL CHECK (conclusion IN ('fraud_confirmed', 'fraud_denied', 'insufficient_evidence', 'case_closed')),
  actions_taken JSONB DEFAULT '[]',
  recommendation TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'escalated')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk scoring history
CREATE TABLE IF NOT EXISTS payment_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  total_risk_score INTEGER NOT NULL DEFAULT 0,
  risk_factors JSONB DEFAULT '{}',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suspicious patterns tracking
CREATE TABLE IF NOT EXISTS suspicious_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('multiple_agents', 'same_amount', 'round_numbers', 'sequential_references', 'bulk_timing')),
  pattern_data JSONB NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detection_count INTEGER DEFAULT 1,
  first_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'false_positive')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fraud_detection_rules_type ON fraud_detection_rules(type);
CREATE INDEX IF NOT EXISTS idx_fraud_detection_rules_enabled ON fraud_detection_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_payment_id ON fraud_alerts(payment_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_detected_at ON fraud_alerts(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_rule_id ON fraud_alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_fraud_investigations_alert_id ON fraud_investigations(alert_id);
CREATE INDEX IF NOT EXISTS idx_fraud_investigations_status ON fraud_investigations(status);
CREATE INDEX IF NOT EXISTS idx_payment_risk_scores_agent_id ON payment_risk_scores(agent_id);
CREATE INDEX IF NOT EXISTS idx_payment_risk_scores_calculated_at ON payment_risk_scores(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_patterns_type ON suspicious_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_suspicious_patterns_severity ON suspicious_patterns(severity);
CREATE INDEX IF NOT EXISTS idx_suspicious_patterns_last_detected ON suspicious_patterns(last_detected DESC);

-- Row Level Security
ALTER TABLE fraud_detection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_patterns ENABLE ROW LEVEL SECURITY;

-- Policies for fraud detection rules (admin only)
CREATE POLICY "Admins can manage fraud detection rules" ON fraud_detection_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for fraud alerts (admin and investigators)
CREATE POLICY "Staff can view fraud alerts" ON fraud_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'operator')
    )
  );

CREATE POLICY "Admins can manage fraud alerts" ON fraud_alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for fraud investigations
CREATE POLICY "Staff can manage fraud investigations" ON fraud_investigations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role IN ('admin', 'operator')
    )
  );

-- Policies for risk scores (admin only)
CREATE POLICY "Admins can manage risk scores" ON payment_risk_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for suspicious patterns (admin only)
CREATE POLICY "Admins can manage suspicious patterns" ON suspicious_patterns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Function to trigger automatic fraud detection
CREATE OR REPLACE FUNCTION trigger_fraud_detection()
RETURNS TRIGGER AS $$
BEGIN
    -- This function would call the fraud detection service
    -- For now, we'll create a placeholder that logs the payment creation
    INSERT INTO payment_risk_scores (payment_id, agent_id, total_risk_score, risk_factors)
    VALUES (
      NEW.id,
      NEW.agent_id,
      0, -- Initial score, will be updated by fraud detection service
      jsonb_build_object('payment_created', NOW())
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically analyze new payments
CREATE TRIGGER trigger_fraud_detection
  AFTER INSERT ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fraud_detection();

-- Function to detect suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_patterns()
RETURNS TRIGGER AS $$
DECLARE
    pattern_detected BOOLEAN := FALSE;
    pattern_details JSONB;
BEGIN
    -- Check for multiple payments with same amount within time window
    SELECT COUNT(*) > 3, 
           jsonb_build_object(
             'type', 'same_amount',
             'amount', NEW.amount,
             'count', COUNT(*),
             'time_window', '1 hour'
           ) INTO pattern_detected, pattern_details
    FROM payment_records 
    WHERE agent_id = NEW.agent_id 
      AND amount = NEW.amount
      AND created_at > NOW() - INTERVAL '1 hour';
    
    IF pattern_detected THEN
        INSERT INTO suspicious_patterns (pattern_type, pattern_data, severity, detection_count)
        VALUES ('same_amount', pattern_details, 'medium', 1);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to detect patterns when payment is created
CREATE TRIGGER trigger_detect_suspicious_patterns
  AFTER INSERT ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION detect_suspicious_patterns();

-- Function to create automatic investigation for critical alerts
CREATE OR REPLACE FUNCTION auto_create_investigation()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-create investigation for critical fraud alerts
    INSERT INTO fraud_investigations (alert_id, investigator_id, status, started_at)
    SELECT 
      NEW.id,
      (SELECT id FROM user_roles WHERE role = 'admin' LIMIT 1),
      'in_progress',
      NOW()
    WHERE NEW.severity = 'critical' AND NEW.status = 'open';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create investigations for critical alerts
CREATE TRIGGER trigger_auto_create_investigation
  AFTER INSERT ON fraud_alerts
  FOR EACH ROW
  WHEN (NEW.severity = 'critical' AND NEW.status = 'open')
  EXECUTE FUNCTION auto_create_investigation();

-- View for fraud detection analytics
CREATE OR REPLACE VIEW fraud_detection_analytics AS
SELECT 
    DATE_TRUNC('day', detected_at) as date,
    COUNT(*) as total_alerts,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_alerts,
    COUNT(*) FILTER (WHERE severity = 'high') as high_alerts,
    COUNT(*) FILTER (WHERE severity = 'medium') as medium_alerts,
    COUNT(*) FILTER (WHERE severity = 'low') as low_alerts,
    COUNT(*) FILTER (WHERE status = 'open') as open_alerts,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_alerts,
    AVG(risk_score) as average_risk_score,
    MAX(risk_score) as max_risk_score
FROM fraud_alerts
GROUP BY DATE_TRUNC('day', detected_at)
ORDER BY date DESC;

-- View for top risk factors
CREATE OR REPLACE VIEW top_risk_factors AS
SELECT 
    (details->>'reason') as risk_factor,
    COUNT(*) as alert_count,
    AVG(risk_score) as average_score,
    MAX(detected_at) as last_detected
FROM fraud_alerts
WHERE details->>'reason' IS NOT NULL
GROUP BY details->>'reason'
ORDER BY alert_count DESC;

-- Function to clean up old fraud data
CREATE OR REPLACE FUNCTION cleanup_old_fraud_data()
RETURNS void AS $$
BEGIN
    -- Auto-resolve alerts older than 30 days that haven't been reviewed
    UPDATE fraud_alerts 
    SET status = 'resolved',
        auto_resolved = TRUE,
        auto_resolved_at = NOW(),
        resolution_notes = 'Auto-resolved due to age'
    WHERE status = 'open' 
      AND detected_at < NOW() - INTERVAL '30 days';
    
    -- Delete resolved investigations older than 90 days
    DELETE FROM fraud_investigations 
    WHERE status = 'completed' 
      AND completed_at < NOW() - INTERVAL '90 days';
    
    -- Delete risk scores older than 6 months
    DELETE FROM payment_risk_scores 
    WHERE calculated_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;