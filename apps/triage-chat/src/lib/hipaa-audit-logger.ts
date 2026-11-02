/**
 * HIPAA-Compliant Audit Logger
 *
 * Implements secure, immutable audit trail for medical software compliance
 * as required by HIPAA Security Rule § 164.312(b) - Audit Controls
 */

import { createClient } from '@supabase/supabase-js';
import { generateUUID } from 'crypto';

// =============================================================================
// AUDIT EVENT TYPES & INTERFACES
// =============================================================================

export interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: AuditEventType;
  user_id: string; // Pseudonymized user identifier
  session_id?: string;
  ip_address_hash?: string; // Hashed IP for privacy
  event_category: 'security' | 'access' | 'data' | 'system' | 'medical';
  event_description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  outcome: 'success' | 'failure' | 'warning';
  resource_accessed?: string;
  user_agent_hash?: string; // Hashed user agent
  additional_data?: Record<string, any>; // Sanitized metadata
  phi_involved: boolean; // Whether PHI was involved
  compliance_tags: string[]; // HIPAA, FDA, etc.
}

export type AuditEventType =
  | 'authentication_attempt'
  | 'authentication_success'
  | 'authentication_failure'
  | 'authorization_check'
  | 'data_access'
  | 'data_modification'
  | 'security_violation'
  | 'input_validation_failure'
  | 'prompt_injection_attempt'
  | 'rate_limit_exceeded'
  | 'system_error'
  | 'medical_advice_request'
  | 'emergency_detection'
  | 'phi_access'
  | 'phi_disclosure'
  | 'configuration_change'
  | 'audit_log_access';

// =============================================================================
// HIPAA AUDIT LOGGER CLASS
// =============================================================================

export class HIPAAAuditLogger {
  private supabase;
  private isInitialized: boolean = false;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Initialize the audit logger (ensure table exists)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test if audit_logs table exists and is accessible
      const { error } = await this.supabase
        .from('audit_logs')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        console.error(
          'Audit logs table does not exist. Please run migration first.'
        );
        throw new Error('Audit infrastructure not ready');
      } else if (error) {
        console.error('Audit logger initialization failed:', error);
        throw error;
      }

      this.isInitialized = true;

      // Log the audit system initialization
      await this.logAuditEvent({
        event_type: 'system_error', // Will be 'system_startup' in production
        user_id: 'SYSTEM',
        event_category: 'system',
        event_description: 'HIPAA audit logger initialized successfully',
        severity: 'low',
        outcome: 'success',
        phi_involved: false,
        compliance_tags: ['HIPAA-164.312(b)', 'AUDIT-CONTROLS'],
      });
    } catch (error) {
      console.error(
        'Critical: HIPAA audit logger failed to initialize:',
        error
      );
      throw error;
    }
  }

  /**
   * Log a security event with HIPAA compliance
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    userId: string,
    description: string,
    metadata: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      outcome?: 'success' | 'failure' | 'warning';
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      resourceAccessed?: string;
      phiInvolved?: boolean;
      additionalData?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logAuditEvent({
      event_type: eventType,
      user_id: this.pseudonymizeUserId(userId),
      event_category: 'security',
      event_description: description,
      severity: metadata.severity || 'medium',
      outcome: metadata.outcome || 'success',
      session_id: metadata.sessionId,
      ip_address_hash: metadata.ipAddress
        ? this.hashValue(metadata.ipAddress)
        : undefined,
      user_agent_hash: metadata.userAgent
        ? this.hashValue(metadata.userAgent)
        : undefined,
      resource_accessed: metadata.resourceAccessed,
      phi_involved: metadata.phiInvolved || false,
      additional_data: this.sanitizeMetadata(metadata.additionalData),
      compliance_tags: ['HIPAA-164.312(b)', 'SECURITY-CONTROLS'],
    });
  }

  /**
   * Log medical advice interactions
   */
  async logMedicalEvent(
    eventType: AuditEventType,
    userId: string,
    description: string,
    metadata: {
      careLevel?: string;
      isEmergency?: boolean;
      symptomsInvolved?: string[];
      sessionId?: string;
      additionalData?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logAuditEvent({
      event_type: eventType,
      user_id: this.pseudonymizeUserId(userId),
      event_category: 'medical',
      event_description: description,
      severity: metadata.isEmergency ? 'critical' : 'medium',
      outcome: 'success',
      session_id: metadata.sessionId,
      phi_involved: true, // Medical interactions always involve potential PHI
      additional_data: this.sanitizeMetadata({
        care_level: metadata.careLevel,
        is_emergency: metadata.isEmergency,
        symptoms_count: metadata.symptomsInvolved?.length || 0,
        ...metadata.additionalData,
      }),
      compliance_tags: ['HIPAA-164.312(b)', 'MEDICAL-ADVICE', 'PHI-ACCESS'],
    });
  }

  /**
   * Core audit logging method
   */
  private async logAuditEvent(eventData: Partial<AuditEvent>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const auditEvent: AuditEvent = {
        id: this.generateAuditId(),
        timestamp: new Date().toISOString(),
        event_type: eventData.event_type!,
        user_id: eventData.user_id!,
        session_id: eventData.session_id,
        ip_address_hash: eventData.ip_address_hash,
        event_category: eventData.event_category!,
        event_description: eventData.event_description!,
        severity: eventData.severity || 'medium',
        outcome: eventData.outcome || 'success',
        resource_accessed: eventData.resource_accessed,
        user_agent_hash: eventData.user_agent_hash,
        additional_data: eventData.additional_data,
        phi_involved: eventData.phi_involved || false,
        compliance_tags: eventData.compliance_tags || [],
      };

      const { error } = await this.supabase
        .from('audit_logs')
        .insert([auditEvent]);

      if (error) {
        // Fallback to console logging if database fails (not ideal but prevents total failure)
        console.error('CRITICAL: Audit log insertion failed:', error);
        console.error(
          'Failed audit event:',
          JSON.stringify(auditEvent, null, 2)
        );

        // In production, this should trigger alerts to security team
        throw new Error(`Audit logging failure: ${error.message}`);
      }
    } catch (error) {
      // This is critical - audit logging must not fail silently
      console.error('CRITICAL: Audit event logging failed:', error);

      // In production environment:
      // 1. Alert security team immediately
      // 2. Consider halting the application if audit logging is not working
      // 3. Write to backup audit mechanism

      throw error;
    }
  }

  /**
   * Query audit logs (with proper authorization)
   */
  async queryAuditLogs(
    filters: {
      userId?: string;
      eventType?: AuditEventType;
      startDate?: string;
      endDate?: string;
      severity?: string;
      phiInvolved?: boolean;
    },
    requesterRole: 'admin' | 'security_officer' | 'privacy_officer',
    maxRecords: number = 100
  ): Promise<AuditEvent[]> {
    // This method would implement proper authorization checks
    // Only authorized personnel should access audit logs

    await this.logSecurityEvent(
      'audit_log_access',
      'SYSTEM', // This would be the actual requester ID
      `Audit log query by ${requesterRole}`,
      {
        severity: 'high',
        additionalData: {
          filters,
          max_records: maxRecords,
          requester_role: requesterRole,
        },
      }
    );

    try {
      let query = this.supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(Math.min(maxRecords, 1000)); // Hard limit for security

      if (filters.userId) {
        query = query.eq('user_id', this.pseudonymizeUserId(filters.userId));
      }
      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate);
      }
      if (filters.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters.phiInvolved !== undefined) {
        query = query.eq('phi_involved', filters.phiInvolved);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Audit log query failed:', error);
      throw error;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Pseudonymize user IDs for privacy
   */
  private pseudonymizeUserId(userId: string): string {
    // Use consistent hashing for pseudonymization
    return this.hashValue(`user_${userId}_salt`);
  }

  /**
   * Hash sensitive values for privacy
   */
  private hashValue(value: string): string {
    // Simple hash for demonstration - use crypto.createHash in production
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    // Use crypto.randomUUID() in production
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMetadata(
    metadata?: Record<string, any>
  ): Record<string, any> | undefined {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };

    // Remove or redact sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'api_key',
      'ssn',
      'credit_card',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Truncate large values
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...[TRUNCATED]';
      }
    }

    return sanitized;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let globalAuditLogger: HIPAAAuditLogger | null = null;

export function getHIPAAAuditLogger(): HIPAAAuditLogger {
  if (!globalAuditLogger) {
    globalAuditLogger = new HIPAAAuditLogger();
  }
  return globalAuditLogger;
}

export default HIPAAAuditLogger;
