-- Voice Notes Support for AMAC Situation Room

-- Update reports table to include voice note fields
ALTER TABLE reports ADD COLUMN voice_note_url TEXT;
ALTER TABLE reports ADD COLUMN voice_duration INTEGER;
ALTER TABLE reports ADD COLUMN voice_file_size INTEGER;
ALTER TABLE reports ADD COLUMN voice_transcription TEXT;

-- Create storage bucket for voice notes (run this in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('voice-notes', 'voice-notes', true);

-- Voice note uploads tracking
CREATE TABLE IF NOT EXISTS voice_note_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  upload_status TEXT NOT NULL CHECK (upload_status IN ('uploading', 'completed', 'failed')),
  transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  transcription TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offline voice notes table for mobile app sync
CREATE TABLE IF NOT EXISTS offline_voice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  local_file_path TEXT NOT NULL,
  report_id UUID,
  file_size INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced BOOLEAN DEFAULT FALSE,
  sync_error TEXT,
  attempts INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_note_uploads_report_id ON voice_note_uploads(report_id);
CREATE INDEX IF NOT EXISTS idx_voice_note_uploads_agent_id ON voice_note_uploads(agent_id);
CREATE INDEX IF NOT EXISTS idx_voice_note_uploads_status ON voice_note_uploads(upload_status);
CREATE INDEX IF NOT EXISTS idx_voice_note_uploads_transcription ON voice_note_uploads(transcription_status);
CREATE INDEX IF NOT EXISTS idx_offline_voice_notes_agent_id ON offline_voice_notes(agent_id);
CREATE INDEX IF NOT EXISTS idx_offline_voice_notes_synced ON offline_voice_notes(synced);

-- Row Level Security
ALTER TABLE voice_note_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_voice_notes ENABLE ROW LEVEL SECURITY;

-- Agents can only manage their own voice note uploads
CREATE POLICY "Agents can manage own voice note uploads" ON voice_note_uploads
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM agents 
      WHERE phone_number = (
        SELECT phone_number FROM auth.users WHERE auth.users.id = auth.uid()
      )
    )
  );

-- Service role can manage all voice note uploads
CREATE POLICY "Service role can manage all voice note uploads" ON voice_note_uploads
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Agents can only manage their own offline voice notes
CREATE POLICY "Agents can manage own offline voice notes" ON offline_voice_notes
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM agents 
      WHERE phone_number = (
        SELECT phone_number FROM auth.users WHERE auth.users.id = auth.uid()
      )
    )
  );

-- Service role can manage all offline voice notes
CREATE POLICY "Service role can manage all offline voice notes" ON offline_voice_notes
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Function to trigger transcription when voice note is uploaded
CREATE OR REPLACE FUNCTION trigger_voice_transcription()
RETURNS TRIGGER AS $$
BEGIN
  -- This would call an external transcription service
  -- For now, we'll just mark it as processing
  UPDATE voice_note_uploads 
  SET transcription_status = 'processing' 
  WHERE id = NEW.id;
  
  -- In a real implementation, you would:
  -- 1. Call an external API (OpenAI Whisper, Google Speech-to-Text, etc.)
  -- 2. Store the transcription result
  -- 3. Update the reports table with the transcription
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to start transcription when upload is completed
CREATE TRIGGER trigger_voice_transcription
  AFTER UPDATE OF upload_status ON voice_note_uploads
  FOR EACH ROW
  WHEN (OLD.upload_status != NEW.upload_status AND NEW.upload_status = 'completed')
  EXECUTE FUNCTION trigger_voice_transcription();

-- Function to get voice note statistics
CREATE OR REPLACE FUNCTION get_voice_note_stats()
RETURNS TABLE(
  date DATE,
  total_uploads INTEGER,
  successful_uploads INTEGER,
  failed_uploads INTEGER,
  total_duration INTEGER,
  average_duration DECIMAL,
  transcribed_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_uploads,
    COUNT(*) FILTER (WHERE upload_status = 'completed') as successful_uploads,
    COUNT(*) FILTER (WHERE upload_status = 'failed') as failed_uploads,
    SUM(duration) as total_duration,
    ROUND(AVG(duration), 2) as average_duration,
    COUNT(*) FILTER (WHERE transcription_status = 'completed') as transcribed_count
  FROM voice_note_uploads
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for voice note analytics
CREATE OR REPLACE VIEW voice_note_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_voice_notes,
  COUNT(*) FILTER (WHERE upload_status = 'completed') as successful_uploads,
  COUNT(*) FILTER (WHERE upload_status = 'failed') as failed_uploads,
  SUM(duration) as total_duration,
  ROUND(AVG(duration), 2) as average_duration,
  COUNT(*) FILTER (WHERE transcription_status = 'completed') as transcribed_count,
  ROUND(
    (COUNT(*) FILTER (WHERE transcription_status = 'completed') * 100.0) / NULLIF(COUNT(*), 0), 
    2
  ) as transcription_rate
FROM voice_note_uploads
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Function to clean up old offline voice notes
CREATE OR REPLACE FUNCTION cleanup_old_offline_voice_notes()
RETURNS void AS $$
BEGIN
  DELETE FROM offline_voice_notes 
  WHERE synced = TRUE 
    AND created_at < NOW() - INTERVAL '7 days';
    
  DELETE FROM offline_voice_notes 
  WHERE attempts > 5 
    AND created_at < NOW() - INTERVAL '2 days';
END;
$$ LANGUAGE plpgsql;

-- Storage policies for voice notes bucket
-- Run these in Supabase dashboard storage section
-- POLICIES:
-- 1. Agents can upload voice notes
-- 2. Agents can view their own voice notes
-- 3. Admins can view all voice notes