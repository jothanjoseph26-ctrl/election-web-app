-- Advanced Payment System Tables for AMAC Situation Room

-- Payment batches for bulk processing
CREATE TABLE IF NOT EXISTS payment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL,
  description TEXT,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_agents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending_approval', 'approved', 'processing', 'completed', 'failed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detailed payment records with full workflow
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES payment_batches(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'cash', 'mobile_money', 'cheque', 'other')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'approved', 'processing', 'sent', 'delivered', 'failed', 'cancelled', 'reversed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  reference_number TEXT,
  transaction_id TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  payment_date DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  notes TEXT,
  verification_notes TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  failure_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment verification checkpoints
CREATE TABLE IF NOT EXISTS payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('amount', 'recipient', 'reference', 'bank_details', 'duplicate_check')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'failed', 'skipped')),
  details JSONB DEFAULT '{}',
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment delivery tracking
CREATE TABLE IF NOT EXISTS payment_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('in_person', 'bank_deposit', 'mobile_transfer', 'courier', 'email')),
  tracking_number TEXT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled')),
  delivery_address TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  recipient_signature BLOB,
  photo_proof_url TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  attempted_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  delivery_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment reconciliation records
CREATE TABLE IF NOT EXISTS payment_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  difference DECIMAL(12,2) NOT NULL DEFAULT 0,
  reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('matched', 'unmatched', 'variance', 'exception')),
  variance_reason TEXT,
  attached_documents JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment notifications
CREATE TABLE IF NOT EXISTS payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payment_records(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('created', 'approved', 'sent', 'delivered', 'failed', 'reminder', 'escalation')),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('agent', 'admin', 'finance', 'system')),
  recipient_id TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push', 'whatsapp', 'in_app')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment templates for recurring payments
CREATE TABLE IF NOT EXISTS payment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  description TEXT,
  default_amount DECIMAL(10,2),
  default_payment_method TEXT,
  payment_terms JSONB DEFAULT '{}',
  verification_rules JSONB DEFAULT '{}',
  approval_required BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update agents table with additional payment fields
ALTER TABLE agents ADD COLUMN payment_preference TEXT CHECK (payment_preference IN ('bank_transfer', 'mobile_money', 'cash', 'other'));
ALTER TABLE agents ADD COLUMN bank_name TEXT;
ALTER TABLE agents ADD COLUMN account_number TEXT;
ALTER TABLE agents ADD COLUMN account_name TEXT;
ALTER TABLE agents ADD COLUMN mobile_money_provider TEXT;
ALTER TABLE agents ADD COLUMN mobile_money_number TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_batches_status ON payment_batches(status);
CREATE INDEX IF NOT EXISTS idx_payment_batches_created_by ON payment_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_payment_records_agent_id ON payment_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_batch_id ON payment_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_status ON payment_records(status);
CREATE INDEX IF NOT EXISTS idx_payment_records_priority ON payment_records(priority);
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_date ON payment_records(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_payment_id ON payment_verifications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_delivery_payment_id ON payment_delivery(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_delivery_status ON payment_delivery(delivery_status);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_payment_id ON payment_reconciliation(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_date ON payment_reconciliation(reconciliation_date);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_payment_id ON payment_notifications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_status ON payment_notifications(status);
CREATE INDEX IF NOT EXISTS idx_payment_templates_active ON payment_templates(active);

-- Row Level Security
ALTER TABLE payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_templates ENABLE ROW LEVEL SECURITY;

-- Policies for payment batches
CREATE POLICY "Admins can manage payment batches" ON payment_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for payment records
CREATE POLICY "Admins can manage payment records" ON payment_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for payment verifications
CREATE POLICY "Admins can manage payment verifications" ON payment_verifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for payment delivery
CREATE POLICY "Admins can manage payment delivery" ON payment_delivery
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for payment reconciliation
CREATE POLICY "Admins can manage payment reconciliation" ON payment_reconciliation
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for payment notifications
CREATE POLICY "Admins can manage payment notifications" ON payment_notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Policies for payment templates
CREATE POLICY "Admins can manage payment templates" ON payment_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Function to update agent payment status
CREATE OR REPLACE FUNCTION update_agent_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update agent's overall payment status based on latest payment
    UPDATE agents 
    SET 
        payment_status = CASE 
            WHEN NEW.status = 'delivered' THEN 'paid'
            WHEN NEW.status = 'sent' THEN 'processing'
            WHEN NEW.status = 'failed' THEN 'failed'
            ELSE 'pending'
        END,
        payment_amount = CASE 
            WHEN NEW.status IN ('sent', 'delivered') THEN NEW.amount
            ELSE COALESCE(agents.payment_amount, 0)
        END,
        payment_reference = CASE 
            WHEN NEW.status IN ('sent', 'delivered') THEN NEW.reference_number
            ELSE agents.payment_reference
        END,
        payment_sent_at = CASE 
            WHEN NEW.status IN ('sent', 'delivered') THEN NEW.sent_at
            ELSE agents.payment_sent_at
        END
    WHERE agents.id = NEW.agent_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update agent payment status
CREATE TRIGGER trigger_update_agent_payment_status
  AFTER INSERT OR UPDATE ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_payment_status();

-- Function to create payment verification automatically
CREATE OR REPLACE FUNCTION create_payment_verification()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-create basic verifications for new payments
    IF TG_OP = 'INSERT' THEN
        -- Amount verification
        INSERT INTO payment_verifications (payment_id, verification_type, status)
        VALUES (NEW.id, 'amount', NEW.amount > 0 ? 'passed' : 'failed');
        
        -- Recipient verification
        INSERT INTO payment_verifications (payment_id, verification_type, status, details)
        SELECT NEW.id, 'recipient', 'passed', 
               jsonb_build_object('agent_name', agents.full_name, 'verified', true)
        FROM agents WHERE agents.id = NEW.agent_id;
        
        -- Duplicate check
        INSERT INTO payment_verifications (payment_id, verification_type, status, details)
        SELECT NEW.id, 'duplicate_check', 
               CASE WHEN COUNT(*) > 1 THEN 'failed' ELSE 'passed' END,
               jsonb_build_object('duplicate_count', COUNT(*) - 1)
        FROM payment_records 
        WHERE agent_id = NEW.agent_id 
          AND status IN ('sent', 'delivered')
          AND created_at > NOW() - INTERVAL '30 days';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create verifications
CREATE TRIGGER trigger_create_payment_verification
  AFTER INSERT ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_verification();

-- Function for payment status workflow
CREATE OR REPLACE FUNCTION advance_payment_workflow(payment_uuid UUID, new_status TEXT, notes TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    current_record payment_records%ROWTYPE;
    workflow_valid BOOLEAN;
BEGIN
    -- Get current payment record
    SELECT * INTO current_record 
    FROM payment_records 
    WHERE id = payment_uuid;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment record not found';
    END IF;
    
    -- Validate workflow transition
    workflow_valid := (
        -- From pending to verified
        (current_record.status = 'pending' AND new_status = 'verified') OR
        -- From verified to approved
        (current_record.status = 'verified' AND new_status = 'approved') OR
        -- From approved to processing
        (current_record.status = 'approved' AND new_status = 'processing') OR
        -- From processing to sent
        (current_record.status = 'processing' AND new_status = 'sent') OR
        -- From sent to delivered
        (current_record.status = 'sent' AND new_status = 'delivered') OR
        -- From any status to failed
        (current_record.status IN ('pending', 'verified', 'approved', 'processing', 'sent') AND new_status = 'failed') OR
        -- From failed to pending (for retry)
        (current_record.status = 'failed' AND new_status = 'pending' AND current_record.retry_count < current_record.max_retries)
    );
    
    IF NOT workflow_valid THEN
        RAISE EXCEPTION 'Invalid workflow transition from % to %', current_record.status, new_status;
    END IF;
    
    -- Update payment record
    UPDATE payment_records 
    SET status = new_status,
        notes = COALESCE(notes, current_record.notes),
        updated_at = NOW(),
        approved_by = CASE WHEN new_status = 'approved' THEN auth.uid() ELSE approved_by END,
        approved_at = CASE WHEN new_status = 'approved' THEN NOW() ELSE approved_at END,
        sent_by = CASE WHEN new_status = 'sent' THEN auth.uid() ELSE sent_by END,
        sent_at = CASE WHEN new_status = 'sent' THEN NOW() ELSE sent_at END,
        confirmed_by = CASE WHEN new_status = 'delivered' THEN auth.uid() ELSE confirmed_by END,
        confirmed_at = CASE WHEN new_status = 'delivered' THEN NOW() ELSE confirmed_at END,
        retry_count = CASE WHEN new_status = 'failed' THEN retry_count + 1 ELSE retry_count END,
        next_retry_at = CASE 
            WHEN new_status = 'failed' AND retry_count < max_retries 
            THEN NOW() + (retry_count + 1) * INTERVAL '1 hour'
            ELSE NULL 
        END
    WHERE id = payment_uuid;
    
    -- Log the workflow change
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
        auth.uid(),
        'PAYMENT_STATUS_CHANGE',
        'payment',
        payment_uuid,
        jsonb_build_object(
            'old_status', current_record.status,
            'new_status', new_status,
            'notes', notes,
            'timestamp', NOW()
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;