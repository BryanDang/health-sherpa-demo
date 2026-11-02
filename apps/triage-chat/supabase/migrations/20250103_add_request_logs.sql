-- Migration: Add request logs table for user-level rate limiting
-- Purpose: Track user requests to prevent abuse and control costs
-- Created: 2025-01-03

CREATE TABLE request_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  tier TEXT DEFAULT 'default' CHECK (tier IN ('default', 'premium', 'emergency')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by user_id and time window
CREATE INDEX idx_request_logs_user_id_created_at ON request_logs(user_id, created_at);

-- Index for cleanup operations
CREATE INDEX idx_request_logs_created_at ON request_logs(created_at);

-- Index for tier-based analytics
CREATE INDEX idx_request_logs_tier ON request_logs(tier, created_at);

-- Function to clean up old request logs automatically
CREATE OR REPLACE FUNCTION cleanup_old_request_logs()
RETURNS void AS $$
BEGIN
  -- Delete request logs older than 7 days
  DELETE FROM request_logs WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE request_logs IS 'User request logs for rate limiting and abuse prevention';
COMMENT ON COLUMN request_logs.user_id IS 'User identifier (can be IP, session, or authenticated user ID)';
COMMENT ON COLUMN request_logs.tier IS 'User tier for different rate limits (default, premium, emergency)';
COMMENT ON COLUMN request_logs.ip_address IS 'Optional IP address for additional abuse detection';
COMMENT ON COLUMN request_logs.user_agent IS 'Optional user agent for analytics and abuse detection';