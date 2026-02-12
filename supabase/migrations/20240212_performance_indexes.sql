-- Performance Indexes for AMAC Situation Room
-- This migration adds indexes to improve query performance

-- Agents table indexes
CREATE INDEX IF NOT EXISTS idx_agents_ward_number ON agents(ward_number);
CREATE INDEX IF NOT EXISTS idx_agents_payment_status ON agents(payment_status);
CREATE INDEX IF NOT EXISTS idx_agents_verification_status ON agents(verification_status);
CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at);
CREATE INDEX IF NOT EXISTS idx_agents_last_report_at ON agents(last_report_at);
CREATE INDEX IF NOT EXISTS idx_agents_payment_sent_at ON agents(payment_sent_at);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agents_ward_payment_status ON agents(ward_number, payment_status);
CREATE INDEX IF NOT EXISTS idx_agents_verification_payment ON agents(verification_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_agents_created_ward ON agents(created_at, ward_number);

-- Reports table indexes
CREATE INDEX IF NOT EXISTS idx_reports_agent_id ON reports(agent_id);
CREATE INDEX IF NOT EXISTS idx_reports_operator_id ON reports(operator_id);
CREATE INDEX IF NOT EXISTS idx_reports_report_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_ward_number ON reports(ward_number);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Compound indexes for reports
CREATE INDEX IF NOT EXISTS idx_reports_created_type ON reports(created_at DESC, report_type);
CREATE INDEX IF NOT EXISTS idx_reports_agent_created ON reports(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_ward_created ON reports(ward_number, created_at DESC);

-- Broadcasts table indexes
CREATE INDEX IF NOT EXISTS idx_broadcasts_sender_id ON broadcasts(sender_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_priority ON broadcasts(priority);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_priority_created ON broadcasts(priority, created_at DESC);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Text search indexes for improved search performance
-- This enables faster text search on agents and reports
CREATE INDEX IF NOT EXISTS idx_agents_full_name_gin ON agents USING gin(to_tsvector('english', full_name));
CREATE INDEX IF NOT EXISTS idx_reports_details_gin ON reports USING gin(to_tsvector('english', details));

-- Add partial indexes for common filtered queries
CREATE INDEX IF NOT EXISTS idx_agents_sent_payments ON agents(payment_amount, payment_sent_at) WHERE payment_status = 'sent';
CREATE INDEX IF NOT EXISTS idx_reports_emergency ON reports(created_at DESC) WHERE report_type IN ('emergency', 'incident');
CREATE INDEX IF NOT EXISTS idx_agents_verified ON agents(created_at DESC) WHERE verification_status = 'verified';

-- Function to update search vectors when data changes
CREATE OR REPLACE FUNCTION update_search_vectors()
RETURNS TRIGGER AS $$
BEGIN
  -- This can be expanded for more complex search scenarios
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring view
CREATE OR REPLACE VIEW query_performance_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Analyze tables to update statistics after index creation
ANALYZE agents;
ANALYZE reports;
ANALYZE broadcasts;
ANALYZE profiles;
ANALYZE user_roles;
ANALYZE audit_logs;