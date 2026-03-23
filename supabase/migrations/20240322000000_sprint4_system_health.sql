-- Sprint 4: System Health Monitoring + Admin Access Control
-- This migration adds:
-- 1. system_health table for cron job monitoring
-- 2. is_admin column on coaches for secure admin access
-- 3. reminder_sent_at column on content for tracking sent reminders

-- System health tracking table
CREATE TABLE IF NOT EXISTS system_health (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS - only service role can write
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

-- Service role bypass policy (service role can do everything)
CREATE POLICY "Service role full access" ON system_health
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add is_admin column to coaches table
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add reminder_sent_at column to content table for tracking sent reminders
ALTER TABLE content ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_content_reminder_pending
  ON content (reminder_at, status)
  WHERE status = 'reminder_set' AND reminder_at IS NOT NULL;

-- Create trigger to auto-update system_health.updated_at
CREATE OR REPLACE FUNCTION update_system_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_system_health_updated_at
  BEFORE UPDATE ON system_health
  FOR EACH ROW EXECUTE FUNCTION update_system_health_updated_at();

-- Comment for documentation
COMMENT ON TABLE system_health IS 'Stores system health metrics like cron job status. Only writable via service role.';
COMMENT ON COLUMN coaches.is_admin IS 'Admin flag for founder dashboard access. Set manually after deploy.';
COMMENT ON COLUMN content.reminder_sent_at IS 'Timestamp when reminder email was sent. Null if not yet sent.';

-- NOTE: After deployment, manually set the founder as admin:
-- UPDATE coaches SET is_admin = true WHERE email = 'founder@example.com';
