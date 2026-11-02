-- Migration: Add HIPAA-compliant audit logs table
-- Purpose: Implement secure, immutable audit trail for medical software compliance
-- Compliance: HIPAA Security Rule § 164.312(b) - Audit Controls
-- Created: 2025-01-03

-- =============================================================================
-- AUDIT LOGS TABLE
-- =============================================================================

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Pseudonymized user identifier
  session_id TEXT,
  ip_address_hash TEXT, -- Hashed IP for privacy compliance
  event_category TEXT NOT NULL CHECK (event_category IN ('security', 'access', 'data', 'system', 'medical')),
  event_description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'warning')),
  resource_accessed TEXT,
  user_agent_hash TEXT, -- Hashed user agent for privacy
  additional_data JSONB, -- Sanitized metadata
  phi_involved BOOLEAN NOT NULL DEFAULT FALSE, -- Whether PHI was involved
  compliance_tags TEXT[] DEFAULT '{}', -- HIPAA, FDA compliance tags
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE AND COMPLIANCE
-- =============================================================================

-- Primary access patterns for audit log queries
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_event_type_timestamp ON audit_logs(event_type, timestamp DESC);
CREATE INDEX idx_audit_logs_severity_timestamp ON audit_logs(severity, timestamp DESC);

-- Security and compliance indexes
CREATE INDEX idx_audit_logs_phi_involved ON audit_logs(phi_involved, timestamp DESC);
CREATE INDEX idx_audit_logs_event_category ON audit_logs(event_category, timestamp DESC);
CREATE INDEX idx_audit_logs_outcome ON audit_logs(outcome, timestamp DESC);

-- Compliance tag search
CREATE INDEX idx_audit_logs_compliance_tags ON audit_logs USING gin(compliance_tags);

-- Session tracking for investigation
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id, timestamp DESC) WHERE session_id IS NOT NULL;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) FOR HIPAA COMPLIANCE
-- =============================================================================

-- Enable RLS to ensure audit logs are only accessible by authorized personnel
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert audit logs (prevents tampering)
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Only authorized roles can read audit logs
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  TO service_role
  USING (true);

-- Policy: NO UPDATE allowed (immutable audit trail)
-- Audit logs should never be updated once created

-- Policy: NO DELETE allowed except by system cleanup
-- Only automated cleanup functions should delete old logs

-- =============================================================================
-- AUDIT LOG RETENTION AND CLEANUP
-- =============================================================================

-- Function to clean up old audit logs (HIPAA requires minimum 6 years retention)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  retention_days INTEGER DEFAULT 2190 -- 6 years default (HIPAA requirement)
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Log the cleanup operation
  INSERT INTO audit_logs (
    id,
    event_type,
    user_id,
    event_category,
    event_description,
    severity,
    outcome,
    phi_involved,
    compliance_tags,
    additional_data
  ) VALUES (
    'cleanup_' || extract(epoch from now())::text,
    'system_error', -- Will be 'system_cleanup' in production
    'SYSTEM',
    'system',
    'Audit log cleanup initiated for logs older than ' || retention_days || ' days',
    'medium',
    'success',
    false,
    ARRAY['HIPAA-164.312(b)', 'RETENTION-POLICY'],
    jsonb_build_object(
      'retention_days', retention_days,
      'cutoff_date', cutoff_date,
      'initiated_by', 'automated_cleanup'
    )
  );

  -- Delete old audit logs (but preserve critical security events longer)
  DELETE FROM audit_logs 
  WHERE timestamp < cutoff_date 
    AND severity NOT IN ('critical') -- Keep critical events longer
    AND event_type NOT IN ('security_violation', 'phi_disclosure'); -- Keep security violations longer

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log completion
  INSERT INTO audit_logs (
    id,
    event_type,
    user_id,
    event_category,
    event_description,
    severity,
    outcome,
    phi_involved,
    compliance_tags,
    additional_data
  ) VALUES (
    'cleanup_complete_' || extract(epoch from now())::text,
    'system_error', -- Will be 'system_cleanup' in production
    'SYSTEM',
    'system',
    'Audit log cleanup completed',
    'low',
    'success',
    false,
    ARRAY['HIPAA-164.312(b)', 'RETENTION-POLICY'],
    jsonb_build_object(
      'deleted_count', deleted_count,
      'retention_days', retention_days,
      'cutoff_date', cutoff_date
    )
  );

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- AUDIT LOG INTEGRITY FUNCTIONS
-- =============================================================================

-- Function to verify audit log integrity (detect tampering)
CREATE OR REPLACE FUNCTION verify_audit_log_integrity()
RETURNS TABLE (
  integrity_status TEXT,
  total_logs BIGINT,
  suspicious_gaps INTEGER,
  timeline_violations INTEGER
) AS $$
DECLARE
  log_count BIGINT;
  gap_count INTEGER := 0;
  timeline_count INTEGER := 0;
BEGIN
  -- Count total logs
  SELECT COUNT(*) INTO log_count FROM audit_logs;
  
  -- Check for suspicious time gaps (may indicate tampering)
  SELECT COUNT(*) INTO gap_count
  FROM (
    SELECT 
      timestamp,
      LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
    FROM audit_logs
  ) AS gaps
  WHERE timestamp - prev_timestamp > INTERVAL '24 hours'
    AND prev_timestamp IS NOT NULL;
  
  -- Check for timeline violations (timestamps in wrong order)
  SELECT COUNT(*) INTO timeline_count
  FROM (
    SELECT 
      timestamp,
      created_at,
      CASE WHEN timestamp > created_at + INTERVAL '1 minute' THEN 1 ELSE 0 END as violation
    FROM audit_logs
  ) AS timeline_check
  WHERE violation = 1;
  
  -- Determine overall integrity status
  integrity_status := CASE 
    WHEN gap_count = 0 AND timeline_count = 0 THEN 'INTACT'
    WHEN gap_count > 0 OR timeline_count > 0 THEN 'SUSPICIOUS'
    ELSE 'UNKNOWN'
  END;
  
  RETURN QUERY SELECT 
    verify_audit_log_integrity.integrity_status,
    log_count,
    gap_count,
    timeline_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMPLIANCE REPORTING VIEWS
-- =============================================================================

-- View for HIPAA compliance reporting
CREATE VIEW hipaa_audit_summary AS
SELECT 
  date_trunc('day', timestamp) as audit_date,
  event_category,
  COUNT(*) as event_count,
  COUNT(*) FILTER (WHERE phi_involved = true) as phi_events,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
  COUNT(*) FILTER (WHERE outcome = 'failure') as failed_events
FROM audit_logs
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY date_trunc('day', timestamp), event_category
ORDER BY audit_date DESC, event_category;

-- View for security incident tracking
CREATE VIEW security_incidents AS
SELECT 
  id,
  timestamp,
  event_type,
  user_id,
  event_description,
  severity,
  outcome,
  additional_data
FROM audit_logs
WHERE event_category = 'security'
  AND (severity IN ('high', 'critical') OR outcome = 'failure')
ORDER BY timestamp DESC;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE audit_logs IS 'HIPAA-compliant audit trail for medical software (§ 164.312(b))';
COMMENT ON COLUMN audit_logs.id IS 'Unique audit event identifier';
COMMENT ON COLUMN audit_logs.user_id IS 'Pseudonymized user identifier for privacy';
COMMENT ON COLUMN audit_logs.ip_address_hash IS 'Hashed IP address for privacy compliance';
COMMENT ON COLUMN audit_logs.phi_involved IS 'Whether Protected Health Information was involved';
COMMENT ON COLUMN audit_logs.compliance_tags IS 'Regulatory compliance tags (HIPAA, FDA, etc.)';
COMMENT ON COLUMN audit_logs.additional_data IS 'Sanitized metadata in JSONB format';

COMMENT ON VIEW hipaa_audit_summary IS 'Daily summary of audit events for HIPAA compliance reporting';
COMMENT ON VIEW security_incidents IS 'High-severity security events for incident response';

COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Automated cleanup of audit logs following HIPAA retention requirements';
COMMENT ON FUNCTION verify_audit_log_integrity IS 'Verify audit log integrity to detect potential tampering';