/**
 * Security Validator for Medical Triage API
 *
 * Comprehensive input validation, sanitization, and security controls
 * for medical data handling with HIPAA considerations.
 */

import { z } from 'zod';

// =============================================================================
// SECURITY CONSTANTS
// =============================================================================

const MAX_MESSAGE_LENGTH = 5000; // Prevent DoS via large inputs
const MAX_CONVERSATION_HISTORY = 20; // Limit memory/cost exposure
const MAX_PROMPT_INJECTION_SCORE = 0.7; // Threshold for prompt injection detection

// Known prompt injection patterns (medical context aware)
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction injection
  /ignore\s+(?:previous|all|above|prior)\s+(?:instructions|prompts|commands)/i,
  /forget\s+(?:everything|all|previous|above)/i,
  /you\s+are\s+now\s+(?:a|an)\s+(?:different|new)/i,
  /act\s+(?:as|like)\s+(?:a|an)\s+(?:different|new)/i,
  /pretend\s+(?:to\s+be|you\s+are)/i,

  // Role manipulation
  /you\s+are\s+(?:no\s+longer|not)\s+(?:a|an)\s+(?:medical|health|triage)/i,
  /override\s+your\s+(?:instructions|programming|role)/i,
  /change\s+your\s+(?:role|behavior|personality)/i,

  // System prompt leakage attempts
  /what\s+(?:are|were)\s+your\s+(?:initial|original|system)\s+(?:instructions|prompts)/i,
  /show\s+me\s+your\s+(?:system|initial|original)\s+prompt/i,
  /reveal\s+your\s+(?:programming|instructions|prompts)/i,

  // Medical context manipulation
  /you\s+are\s+(?:a|an)\s+(?:doctor|physician|nurse|medical\s+professional)/i,
  /diagnose\s+(?:me|this|my)/i,
  /prescribe\s+(?:medication|drugs|treatment)/i,

  // Harmful medical advice solicitation
  /how\s+to\s+(?:overdose|self\s*harm|hurt\s+myself)/i,
  /suicide\s+(?:methods|ways|how)/i,
  /illegal\s+(?:drugs|substances|medication)/i,

  // Information extraction attempts
  /what\s+(?:other|previous)\s+(?:users|patients)\s+(?:asked|said|told)/i,
  /share\s+(?:other|previous)\s+(?:conversations|messages|data)/i,
  /access\s+(?:database|records|files|system)/i,
];

// Medical terms that should NOT be sanitized (preserve clinical accuracy)
const MEDICAL_PRESERVE_TERMS = [
  'chest pain',
  'shortness of breath',
  'abdominal pain',
  'headache',
  'fever',
  'nausea',
  'vomiting',
  'diarrhea',
  'cough',
  'fatigue',
  'dizziness',
  'rash',
  'swelling',
  'bleeding',
  'pain',
  'ache',
  'temperature',
  'degrees',
  'fahrenheit',
  'celsius',
  'emergency',
  'urgent',
  'severe',
  'mild',
  'moderate',
  'diabetes',
  'hypertension',
  'asthma',
  'allergies',
  'medication',
];

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

// Message content validation (will be validated separately due to async prompt injection check)
const MessageSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(
    MAX_MESSAGE_LENGTH,
    `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`
  )
  .refine((msg) => msg.trim().length > 0, 'Message cannot be only whitespace');

// Separate async validation for prompt injection
async function validateMessageForPromptInjection(
  message: string,
  userId: string = 'unknown'
): Promise<boolean> {
  const score = await calculatePromptInjectionScore(message, userId);
  return score < MAX_PROMPT_INJECTION_SCORE;
}

// Conversation history item validation
const ConversationItemSchema = z.object({
  role: z.enum(['user', 'assistant'], {
    errorMap: () => ({ message: 'Role must be either "user" or "assistant"' }),
  }),
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(MAX_MESSAGE_LENGTH, 'Content too long'),
  timestamp: z
    .string()
    .datetime({ message: 'Invalid timestamp format' })
    .optional(),
});

// Full conversation history validation
const ConversationHistorySchema = z
  .array(ConversationItemSchema)
  .max(
    MAX_CONVERSATION_HISTORY,
    `Too many conversation items (max ${MAX_CONVERSATION_HISTORY})`
  )
  .refine((history) => {
    // Ensure alternating user/assistant pattern for conversation integrity
    for (let i = 1; i < history.length; i++) {
      if (history[i].role === history[i - 1].role) {
        return false; // No consecutive same roles
      }
    }
    return true;
  }, 'Invalid conversation flow - roles must alternate');

// Main request schema
export const TriageRequestSchema = z.object({
  message: MessageSchema,
  conversationHistory: ConversationHistorySchema.optional().default([]),
  userId: z.string().optional(), // For rate limiting
  sessionId: z.string().optional(), // For tracking
  metadata: z.record(z.any()).optional(), // Additional context
});

// =============================================================================
// SECURITY VALIDATION FUNCTIONS
// =============================================================================

/**
 * Enhanced prompt injection detection using multi-layered analysis
 */
async function calculatePromptInjectionScore(
  text: string,
  userId: string = 'unknown'
): Promise<number> {
  // First, apply legacy pattern-based detection for backwards compatibility
  const legacyScore = calculateLegacyPromptInjectionScore(text);

  try {
    // Use advanced multi-layered detection
    const { getAdvancedPromptInjectionDefense } = await import(
      './advanced-prompt-injection-defense'
    );
    const defense = getAdvancedPromptInjectionDefense();

    const analysis = await defense.analyzePromptInjection(text, userId);

    // Return the higher of legacy or advanced score for maximum security
    return Math.max(legacyScore, analysis.overallScore);
  } catch (error) {
    console.warn(
      'Advanced prompt injection analysis failed, using legacy detection:',
      error
    );
    return legacyScore;
  }
}

/**
 * Legacy prompt injection detection (fallback)
 */
function calculateLegacyPromptInjectionScore(text: string): number {
  const normalizedText = text.toLowerCase().trim();
  let score = 0;
  let matchCount = 0;

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(normalizedText)) {
      matchCount++;
      score += 0.3; // Each pattern match adds significant risk
    }
  }

  // Additional heuristics
  const suspiciousKeywords = [
    'ignore',
    'forget',
    'override',
    'system',
    'admin',
    'root',
    'prompt',
    'instruction',
    'command',
    'execute',
    'run',
    'script',
    'code',
    'function',
    'api',
    'database',
  ];

  const keywordMatches = suspiciousKeywords.filter((keyword) =>
    normalizedText.includes(keyword)
  ).length;

  score += keywordMatches * 0.1; // Each suspicious keyword adds minor risk

  // Pattern density check (multiple matches in short text)
  if (normalizedText.length < 100 && matchCount > 1) {
    score += 0.2; // High pattern density = suspicious
  }

  // Excessive special characters or encoding attempts
  const specialCharRatio =
    (text.match(/[<>{}[\]\\"`'|&$%;]/g) || []).length / text.length;
  if (specialCharRatio > 0.1) {
    score += 0.15; // Too many special chars = potential injection
  }

  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * Sanitize user input while preserving medical terminology and redacting PHI/PII
 */
export function sanitizeInput(input: string): {
  sanitized: string;
  phiDetected: boolean;
  redactionStats: any;
} {
  // First, apply PHI/PII redaction
  const { getPHIRedactionEngine } = require('./phi-redaction');
  const redactionEngine = getPHIRedactionEngine();
  const redactionResult = redactionEngine.redactText(input);

  let sanitized = redactionResult.redactedText;

  // Basic HTML/script sanitization (after PHI redaction)
  sanitized = sanitized
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\u0000/g, '') // Remove null bytes
    .trim();

  return {
    sanitized,
    phiDetected:
      redactionResult.redactionStats.phiDetected ||
      redactionResult.redactionStats.piiDetected,
    redactionStats: redactionResult.redactionStats,
  };
}

/**
 * Validate conversation history integrity
 */
function validateConversationIntegrity(history: any[]): boolean {
  if (!Array.isArray(history)) return false;

  // Check for manipulation attempts
  for (const item of history) {
    if (!item.role || !item.content) return false;

    // Check for role manipulation in content
    if (item.role === 'user' && /^(?:assistant|system):/i.test(item.content)) {
      return false; // User trying to impersonate assistant
    }

    // Check for system prompt injection in history
    if (
      calculatePromptInjectionScore(item.content) > MAX_PROMPT_INJECTION_SCORE
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Rate limit validation (checks if request should be blocked)
 */
export function validateRateLimit(
  userId: string,
  tier: 'default' | 'premium' = 'default'
): {
  isAllowed: boolean;
  reason?: string;
} {
  // Basic validation - detailed rate limiting handled by UserRateLimiter
  if (!userId || userId.length === 0) {
    return { isAllowed: false, reason: 'Invalid user identifier' };
  }

  if (userId.length > 100) {
    return { isAllowed: false, reason: 'User identifier too long' };
  }

  return { isAllowed: true };
}

// =============================================================================
// MAIN SECURITY VALIDATOR CLASS
// =============================================================================

export class SecurityValidator {
  /**
   * Validate and sanitize a complete triage request
   */
  static validateTriageRequest(rawRequest: any): {
    isValid: boolean;
    data?: z.infer<typeof TriageRequestSchema>;
    errors?: string[];
    securityFlags?: string[];
  } {
    const errors: string[] = [];
    const securityFlags: string[] = [];

    try {
      // Pre-validation security checks
      if (typeof rawRequest !== 'object' || rawRequest === null) {
        return { isValid: false, errors: ['Invalid request format'] };
      }

      // Check for oversized requests (DoS prevention)
      const requestString = JSON.stringify(rawRequest);
      if (requestString.length > 50000) {
        // 50KB limit
        return { isValid: false, errors: ['Request too large'] };
      }

      // Validate conversation history integrity
      if (
        rawRequest.conversationHistory &&
        !validateConversationIntegrity(rawRequest.conversationHistory)
      ) {
        securityFlags.push('Conversation history integrity violation');
        return {
          isValid: false,
          errors: ['Invalid conversation history format'],
        };
      }

      // Sanitize inputs before validation and track PHI detection
      let phiDetectionEvents: any[] = [];

      if (rawRequest.message) {
        const sanitizationResult = sanitizeInput(rawRequest.message);
        rawRequest.message = sanitizationResult.sanitized;

        if (sanitizationResult.phiDetected) {
          phiDetectionEvents.push({
            location: 'message',
            stats: sanitizationResult.redactionStats,
          });
        }
      }

      if (rawRequest.conversationHistory) {
        rawRequest.conversationHistory = rawRequest.conversationHistory.map(
          (item: any, index: number) => {
            if (item.content) {
              const sanitizationResult = sanitizeInput(item.content);

              if (sanitizationResult.phiDetected) {
                phiDetectionEvents.push({
                  location: `conversationHistory[${index}]`,
                  stats: sanitizationResult.redactionStats,
                });
              }

              return {
                ...item,
                content: sanitizationResult.sanitized,
              };
            }
            return item;
          }
        );
      }

      // Log PHI detection events if any were found
      if (phiDetectionEvents.length > 0) {
        securityFlags.push('PHI/PII detected and redacted');

        // Log PHI detection for compliance audit
        try {
          const { getHIPAAAuditLogger } = await import('./hipaa-audit-logger');
          const auditLogger = getHIPAAAuditLogger();

          await auditLogger.logSecurityEvent(
            'phi_access',
            'UNKNOWN_USER', // Will be updated by caller
            'PHI/PII detected in user input and automatically redacted',
            {
              severity: 'high',
              outcome: 'warning',
              phiInvolved: true,
              additionalData: {
                detection_events: phiDetectionEvents,
                total_redactions: phiDetectionEvents.reduce(
                  (sum, event) => sum + event.stats.totalRedactions,
                  0
                ),
                critical_redactions: phiDetectionEvents.reduce(
                  (sum, event) => sum + event.stats.criticalRedactions,
                  0
                ),
              },
            }
          );
        } catch (error) {
          console.error('Failed to log PHI detection event:', error);
        }
      }

      // Run zod validation
      const result = TriageRequestSchema.safeParse(rawRequest);

      if (!result.success) {
        const zodErrors = result.error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`
        );
        return { isValid: false, errors: zodErrors };
      }

      // Additional async security validations
      try {
        // Enhanced prompt injection validation
        const messageValid = await validateMessageForPromptInjection(
          result.data.message,
          'SECURITY_VALIDATION' // Placeholder - actual userId will be provided by caller
        );

        if (!messageValid) {
          securityFlags.push('Advanced prompt injection detected');
          return {
            isValid: false,
            errors: ['Message contains potentially harmful content'],
            securityFlags,
          };
        }

        // Validate conversation history for prompt injection
        if (result.data.conversationHistory) {
          for (let i = 0; i < result.data.conversationHistory.length; i++) {
            const item = result.data.conversationHistory[i];
            const itemValid = await validateMessageForPromptInjection(
              item.content,
              'SECURITY_VALIDATION'
            );

            if (!itemValid) {
              securityFlags.push(
                `Prompt injection in conversation history item ${i}`
              );
              return {
                isValid: false,
                errors: [
                  `Conversation history item ${i} contains potentially harmful content`,
                ],
                securityFlags,
              };
            }
          }
        }
      } catch (error) {
        console.error('Async security validation failed:', error);
        // Continue with basic validation if advanced validation fails
      }

      // All security validations passed
      return {
        isValid: true,
        data: result.data,
        securityFlags: securityFlags.length > 0 ? securityFlags : undefined,
      };
    } catch (error) {
      console.error('Security validation error:', error);
      return { isValid: false, errors: ['Security validation failed'] };
    }
  }

  /**
   * Validate individual message for quick checks
   */
  static async validateMessage(
    message: string,
    userId: string = 'unknown'
  ): Promise<{
    isValid: boolean;
    sanitized?: string;
    errors?: string[];
    phiDetected?: boolean;
    redactionStats?: any;
    promptInjectionDetected?: boolean;
  }> {
    try {
      const sanitizationResult = sanitizeInput(message);
      const result = MessageSchema.safeParse(sanitizationResult.sanitized);

      if (!result.success) {
        return {
          isValid: false,
          errors: result.error.errors.map((err) => err.message),
          phiDetected: sanitizationResult.phiDetected,
          redactionStats: sanitizationResult.redactionStats,
        };
      }

      // Enhanced prompt injection validation
      const promptInjectionValid = await validateMessageForPromptInjection(
        sanitizationResult.sanitized,
        userId
      );

      if (!promptInjectionValid) {
        return {
          isValid: false,
          errors: ['Message contains potentially harmful content'],
          phiDetected: sanitizationResult.phiDetected,
          redactionStats: sanitizationResult.redactionStats,
          promptInjectionDetected: true,
        };
      }

      return {
        isValid: true,
        sanitized: sanitizationResult.sanitized,
        phiDetected: sanitizationResult.phiDetected,
        redactionStats: sanitizationResult.redactionStats,
        promptInjectionDetected: false,
      };
    } catch (error) {
      return { isValid: false, errors: ['Message validation failed'] };
    }
  }

  /**
   * Security audit log entry with HIPAA compliance
   */
  static async logSecurityEvent(
    userId: string,
    eventType:
      | 'validation_failed'
      | 'prompt_injection'
      | 'rate_limit'
      | 'sanitization',
    details: Record<string, any>
  ): Promise<void> {
    try {
      const { getHIPAAAuditLogger } = await import('./hipaa-audit-logger');
      const auditLogger = getHIPAAAuditLogger();

      // Map event types to audit event types
      const auditEventTypeMap = {
        validation_failed: 'input_validation_failure' as const,
        prompt_injection: 'prompt_injection_attempt' as const,
        rate_limit: 'rate_limit_exceeded' as const,
        sanitization: 'security_violation' as const,
      };

      // Determine severity based on event type
      const severityMap = {
        validation_failed: 'medium' as const,
        prompt_injection: 'high' as const,
        rate_limit: 'medium' as const,
        sanitization: 'medium' as const,
      };

      // Determine outcome
      const outcome =
        eventType === 'sanitization'
          ? ('warning' as const)
          : ('failure' as const);

      // Create description
      const description = `Security event: ${eventType} detected for user ${userId}`;

      await auditLogger.logSecurityEvent(
        auditEventTypeMap[eventType],
        userId,
        description,
        {
          severity: severityMap[eventType],
          outcome,
          sessionId: details.sessionId,
          ipAddress: details.ip,
          userAgent: details.userAgent,
          additionalData: {
            event_details: details,
            detection_timestamp: new Date().toISOString(),
            event_source: 'security_validator',
          },
        }
      );

      // For critical events, also alert security team (in production)
      if (severityMap[eventType] === 'high') {
        console.error(
          `CRITICAL SECURITY EVENT [${eventType}] for user ${userId}:`,
          details
        );
        // In production: Send alert to security team
        // await alertSecurityTeam(eventType, userId, details);
      }
    } catch (error) {
      // Fallback to console logging if audit system fails
      console.error(
        `Failed to log security event [${eventType}] for user ${userId}:`,
        error
      );
      console.warn(
        `Security Event [${eventType}] for user ${userId}:`,
        details
      );
    }
  }
}

// =============================================================================
// EXPORT TYPES
// =============================================================================

export type ValidatedTriageRequest = z.infer<typeof TriageRequestSchema>;
export type ConversationItem = z.infer<typeof ConversationItemSchema>;

export default SecurityValidator;
