-- Migration: Add response caching for medical triage system
-- Purpose: Cache non-emergency responses to improve performance and reduce API costs
-- Created: 2025-01-03

CREATE TABLE response_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  input_hash TEXT NOT NULL UNIQUE,
  cached_response JSONB NOT NULL,
  urgency_level TEXT NOT NULL CHECK (urgency_level IN ('emergency', 'urgent', 'routine', 'self-care')),
  model_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by hash
CREATE INDEX idx_response_cache_hash ON response_cache(input_hash);

-- Index for TTL cleanup
CREATE INDEX idx_response_cache_expires ON response_cache(expires_at);

-- Index for analytics queries
CREATE INDEX idx_response_cache_urgency ON response_cache(urgency_level, created_at);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM response_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE response_cache IS 'Caches medical triage responses for performance optimization';
COMMENT ON COLUMN response_cache.input_hash IS 'SHA-256 hash of sanitized user input (no PII)';
COMMENT ON COLUMN response_cache.cached_response IS 'Full triage response JSON';
COMMENT ON COLUMN response_cache.urgency_level IS 'Emergency responses are never cached (TTL=0)';
COMMENT ON COLUMN response_cache.hit_count IS 'Number of times this cache entry was accessed';