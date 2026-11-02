-- Staging Environment Database Tables
-- Medical Professional Testing and Monitoring Infrastructure

-- Medical Professional Feedback Table
CREATE TABLE IF NOT EXISTS medical_professional_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_type VARCHAR(50) NOT NULL,
  session_id VARCHAR(100),
  medical_accuracy_score INTEGER CHECK (medical_accuracy_score >= 1 AND medical_accuracy_score <= 10),
  usability_score INTEGER CHECK (usability_score >= 1 AND usability_score <= 10),
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  medical_concerns TEXT[],
  usability_concerns TEXT[],
  additional_comments TEXT,
  recommendations_for_improvement TEXT,
  would_recommend_to_patients BOOLEAN,
  safety_rating INTEGER CHECK (safety_rating >= 1 AND safety_rating <= 10),
  compliance_rating INTEGER CHECK (compliance_rating >= 1 AND compliance_rating <= 10),
  testing_session JSONB,
  environment VARCHAR(20) DEFAULT 'staging',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Logs Table (Enhanced for Staging)
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  user_id VARCHAR(100),
  professional_type VARCHAR(50),
  environment VARCHAR(20) DEFAULT 'staging',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error Logs Table (Enhanced for Staging)
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  component VARCHAR(100),
  severity VARCHAR(20) DEFAULT 'medium',
  user_id VARCHAR(100),
  session_id VARCHAR(100),
  environment VARCHAR(20) DEFAULT 'staging',
  metadata JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medical Professional Test Users Table
CREATE TABLE IF NOT EXISTS medical_professional_test_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) UNIQUE NOT NULL,
  professional_type VARCHAR(50) NOT NULL,
  access_code VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  institution VARCHAR(255),
  specialization VARCHAR(100),
  years_experience INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  total_sessions INTEGER DEFAULT 0,
  environment VARCHAR(20) DEFAULT 'staging',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Staging Test Sessions Table
CREATE TABLE IF NOT EXISTS staging_test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  professional_type VARCHAR(50),
  test_scenario VARCHAR(100),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  interactions_count INTEGER DEFAULT 0,
  errors_encountered INTEGER DEFAULT 0,
  feedback_provided BOOLEAN DEFAULT FALSE,
  test_data JSONB,
  environment VARCHAR(20) DEFAULT 'staging'
);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  unit VARCHAR(20),
  endpoint VARCHAR(200),
  user_id VARCHAR(100),
  session_id VARCHAR(100),
  environment VARCHAR(20) DEFAULT 'staging',
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medical_feedback_professional_type ON medical_professional_feedback(professional_type);
CREATE INDEX IF NOT EXISTS idx_medical_feedback_created_at ON medical_professional_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_medical_feedback_environment ON medical_professional_feedback(environment);

CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_environment ON system_logs(environment);

CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_environment ON error_logs(environment);

CREATE INDEX IF NOT EXISTS idx_test_users_professional_type ON medical_professional_test_users(professional_type);
CREATE INDEX IF NOT EXISTS idx_test_users_access_code ON medical_professional_test_users(access_code);
CREATE INDEX IF NOT EXISTS idx_test_users_is_active ON medical_professional_test_users(is_active);

CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id ON staging_test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_started_at ON staging_test_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_test_sessions_professional_type ON staging_test_sessions(professional_type);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_environment ON performance_metrics(environment);

-- Create RLS (Row Level Security) policies for staging data isolation
ALTER TABLE medical_professional_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_professional_test_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staging environment isolation
CREATE POLICY "Staging data isolation - medical_professional_feedback" ON medical_professional_feedback
  FOR ALL USING (environment = 'staging');

CREATE POLICY "Staging data isolation - system_logs" ON system_logs
  FOR ALL USING (environment = 'staging');

CREATE POLICY "Staging data isolation - error_logs" ON error_logs
  FOR ALL USING (environment = 'staging');

CREATE POLICY "Staging data isolation - test_users" ON medical_professional_test_users
  FOR ALL USING (environment = 'staging');

CREATE POLICY "Staging data isolation - test_sessions" ON staging_test_sessions
  FOR ALL USING (environment = 'staging');

CREATE POLICY "Staging data isolation - performance_metrics" ON performance_metrics
  FOR ALL USING (environment = 'staging');

-- Insert default medical professional test users
INSERT INTO medical_professional_test_users (
  user_id, professional_type, access_code, email, institution, specialization, years_experience
) VALUES 
  ('staging-doctor-001', 'doctor', 'STAGING_DOC_2024', 'test.doctor@medical-triage-staging.com', 'Staging Medical Center', 'Emergency Medicine', 10),
  ('staging-doctor-002', 'doctor', 'STAGING_DOC_2024', 'test.doctor2@medical-triage-staging.com', 'Staging Medical Center', 'Internal Medicine', 8),
  ('staging-nurse-001', 'nurse', 'STAGING_RN_2024', 'test.nurse@medical-triage-staging.com', 'Staging Medical Center', 'Emergency Nursing', 5),
  ('staging-nurse-002', 'nurse', 'STAGING_RN_2024', 'test.nurse2@medical-triage-staging.com', 'Staging Medical Center', 'Triage Nursing', 7),
  ('staging-pa-001', 'physician_assistant', 'STAGING_CLIN_2024', 'test.pa@medical-triage-staging.com', 'Staging Medical Center', 'Family Medicine', 6),
  ('staging-np-001', 'nurse_practitioner', 'STAGING_CLIN_2024', 'test.np@medical-triage-staging.com', 'Staging Medical Center', 'Acute Care', 9),
  ('staging-clinician-001', 'clinician', 'STAGING_CLIN_2024', 'test.clinician@medical-triage-staging.com', 'Staging Medical Center', 'General Practice', 4)
ON CONFLICT (user_id) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_medical_professional_feedback_updated_at
  BEFORE UPDATE ON medical_professional_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_professional_test_users_updated_at
  BEFORE UPDATE ON medical_professional_test_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically log test session metrics
CREATE OR REPLACE FUNCTION log_test_session_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Log session completion metrics
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    INSERT INTO performance_metrics (
      metric_type, metric_name, metric_value, unit, user_id, session_id, environment
    ) VALUES (
      'test_session', 'session_duration', NEW.duration_seconds, 'seconds', NEW.user_id, NEW.session_id, NEW.environment
    ), (
      'test_session', 'interactions_count', NEW.interactions_count, 'count', NEW.user_id, NEW.session_id, NEW.environment
    ), (
      'test_session', 'errors_encountered', NEW.errors_encountered, 'count', NEW.user_id, NEW.session_id, NEW.environment
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_test_session_metrics_trigger
  AFTER UPDATE ON staging_test_sessions
  FOR EACH ROW
  EXECUTE FUNCTION log_test_session_metrics();

-- Create function to clean up old staging data (data retention)
CREATE OR REPLACE FUNCTION cleanup_staging_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete system logs older than 90 days
  DELETE FROM system_logs 
  WHERE environment = 'staging' 
    AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete error logs older than 30 days (except unresolved critical errors)
  DELETE FROM error_logs 
  WHERE environment = 'staging' 
    AND created_at < NOW() - INTERVAL '30 days'
    AND NOT (severity = 'critical' AND resolved = FALSE);
  
  -- Delete performance metrics older than 60 days
  DELETE FROM performance_metrics 
  WHERE environment = 'staging' 
    AND recorded_at < NOW() - INTERVAL '60 days';
  
  -- Delete completed test sessions older than 45 days
  DELETE FROM staging_test_sessions 
  WHERE environment = 'staging' 
    AND ended_at IS NOT NULL 
    AND ended_at < NOW() - INTERVAL '45 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for medical professional dashboard
CREATE OR REPLACE VIEW medical_professional_dashboard AS
SELECT 
  u.professional_type,
  u.specialization,
  u.years_experience,
  COUNT(DISTINCT s.session_id) as total_sessions,
  AVG(s.duration_seconds) as avg_session_duration,
  SUM(s.interactions_count) as total_interactions,
  SUM(s.errors_encountered) as total_errors,
  COUNT(f.id) as feedback_count,
  AVG(f.medical_accuracy_score) as avg_medical_accuracy,
  AVG(f.usability_score) as avg_usability_score,
  AVG(f.overall_rating) as avg_overall_rating
FROM medical_professional_test_users u
LEFT JOIN staging_test_sessions s ON u.user_id = s.user_id
LEFT JOIN medical_professional_feedback f ON u.user_id = f.session_id
WHERE u.environment = 'staging' AND u.is_active = TRUE
GROUP BY u.professional_type, u.specialization, u.years_experience;

-- Grant necessary permissions (adjust based on your Supabase setup)
-- These would typically be handled by your service role key
COMMENT ON TABLE medical_professional_feedback IS 'Feedback from medical professionals testing the triage system';
COMMENT ON TABLE system_logs IS 'System event logs for staging environment monitoring';
COMMENT ON TABLE error_logs IS 'Error logs for debugging and monitoring';
COMMENT ON TABLE medical_professional_test_users IS 'Test user accounts for medical professionals';
COMMENT ON TABLE staging_test_sessions IS 'Test session tracking for medical professional testing';
COMMENT ON TABLE performance_metrics IS 'Performance metrics collection for staging environment';
COMMENT ON VIEW medical_professional_dashboard IS 'Dashboard view for medical professional testing analytics';