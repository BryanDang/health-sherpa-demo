/**
 * PHI/PII Redaction Layer for HIPAA Compliance
 *
 * Comprehensive scanning and redaction of Protected Health Information (PHI)
 * and Personally Identifiable Information (PII) from user inputs.
 *
 * Compliance: HIPAA Privacy Rule § 164.514 - De-identification of PHI
 */

// =============================================================================
// PHI/PII DETECTION PATTERNS
// =============================================================================

interface RedactionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'phi' | 'pii' | 'financial' | 'identifier';
  description: string;
}

const PHI_PII_PATTERNS: RedactionPattern[] = [
  // HIPAA Safe Harbor Method - 18 Identifiers

  // Names (partial implementation - conservative approach)
  {
    name: 'full_name_pattern',
    pattern:
      /\b(?:my name is|i am|i'm|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/gi,
    replacement: '[NAME_REDACTED]',
    severity: 'high',
    category: 'phi',
    description: 'Full name mention',
  },

  // Phone Numbers
  {
    name: 'phone_number',
    pattern:
      /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    replacement: '[PHONE_REDACTED]',
    severity: 'high',
    category: 'phi',
    description: 'Phone number',
  },

  // Email Addresses
  {
    name: 'email_address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
    severity: 'high',
    category: 'phi',
    description: 'Email address',
  },

  // Social Security Numbers
  {
    name: 'ssn',
    pattern: /\b(?:\d{3}[-.\s]?\d{2}[-.\s]?\d{4}|\d{9})\b/g,
    replacement: '[SSN_REDACTED]',
    severity: 'critical',
    category: 'phi',
    description: 'Social Security Number',
  },

  // Medical Record Numbers
  {
    name: 'medical_record_number',
    pattern:
      /\b(?:MRN|medical record|record number|patient id)[\s:]+([A-Z0-9]{6,})/gi,
    replacement: '[MEDICAL_RECORD_REDACTED]',
    severity: 'critical',
    category: 'phi',
    description: 'Medical record number',
  },

  // Account Numbers
  {
    name: 'account_number',
    pattern: /\b(?:account|acct|policy)[\s#:]+([A-Z0-9]{8,})/gi,
    replacement: '[ACCOUNT_REDACTED]',
    severity: 'high',
    category: 'financial',
    description: 'Account number',
  },

  // Health Plan Numbers
  {
    name: 'health_plan_number',
    pattern: /\b(?:insurance|policy|health plan)[\s#:]+([A-Z0-9]{6,})/gi,
    replacement: '[INSURANCE_REDACTED]',
    severity: 'high',
    category: 'phi',
    description: 'Health plan number',
  },

  // Dates of Birth (conservative - only obvious patterns)
  {
    name: 'date_of_birth',
    pattern: /\b(?:born|birth|dob)[\s:]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    replacement: '[DOB_REDACTED]',
    severity: 'critical',
    category: 'phi',
    description: 'Date of birth',
  },

  // Driver's License
  {
    name: 'drivers_license',
    pattern: /\b(?:driver's? license|dl|license)[\s#:]+([A-Z0-9]{6,})/gi,
    replacement: '[LICENSE_REDACTED]',
    severity: 'high',
    category: 'pii',
    description: "Driver's license",
  },

  // Biometric Identifiers (device IDs that might be biometric)
  {
    name: 'device_identifier',
    pattern: /\b(?:device|imei|uuid|serial)[\s#:]+([A-Z0-9]{12,})/gi,
    replacement: '[DEVICE_ID_REDACTED]',
    severity: 'medium',
    category: 'identifier',
    description: 'Device identifier',
  },

  // Vehicle Identifiers
  {
    name: 'vehicle_identifier',
    pattern: /\b(?:vin|license plate|plate)[\s#:]+([A-Z0-9]{6,})/gi,
    replacement: '[VEHICLE_ID_REDACTED]',
    severity: 'medium',
    category: 'identifier',
    description: 'Vehicle identifier',
  },

  // URLs with potential PHI
  {
    name: 'web_url',
    pattern: /https?:\/\/[^\s]+/g,
    replacement: '[URL_REDACTED]',
    severity: 'medium',
    category: 'identifier',
    description: 'Web URL',
  },

  // IP Addresses
  {
    name: 'ip_address',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: '[IP_REDACTED]',
    severity: 'medium',
    category: 'identifier',
    description: 'IP address',
  },

  // Credit Card Numbers (basic pattern)
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CREDIT_CARD_REDACTED]',
    severity: 'critical',
    category: 'financial',
    description: 'Credit card number',
  },
];

// Medical-specific patterns that should be preserved
const MEDICAL_PRESERVE_PATTERNS = [
  'blood pressure',
  'heart rate',
  'temperature',
  'pain scale',
  'bmi',
  'weight',
  'height',
  'symptoms',
  'medication',
  'diagnosis',
  'treatment',
  'emergency',
  'urgent care',
  'primary care',
  'specialist',
  'hospital',
  'clinic',
  'doctor',
  'physician',
  'nurse',
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
];

// =============================================================================
// PHI/PII REDACTION ENGINE
// =============================================================================

export interface RedactionResult {
  redactedText: string;
  detectedPHI: Array<{
    type: string;
    category: string;
    severity: string;
    description: string;
    originalLength: number;
    position: number;
  }>;
  redactionStats: {
    totalRedactions: number;
    criticalRedactions: number;
    highSeverityRedactions: number;
    phiDetected: boolean;
    piiDetected: boolean;
  };
}

export class PHIRedactionEngine {
  private preserveTermsMap: Map<string, string> = new Map();

  /**
   * Redact PHI/PII from text while preserving medical terminology
   */
  redactText(input: string): RedactionResult {
    if (!input || typeof input !== 'string') {
      return {
        redactedText: '',
        detectedPHI: [],
        redactionStats: {
          totalRedactions: 0,
          criticalRedactions: 0,
          highSeverityRedactions: 0,
          phiDetected: false,
          piiDetected: false,
        },
      };
    }

    let redactedText = input;
    const detectedPHI: RedactionResult['detectedPHI'] = [];
    const preservedTerms = this.preserveMedicalTerms(redactedText);
    redactedText = preservedTerms.text;

    // Apply redaction patterns
    for (const pattern of PHI_PII_PATTERNS) {
      const matches = Array.from(redactedText.matchAll(pattern.pattern));

      for (const match of matches) {
        if (match.index !== undefined) {
          // Check if this match is within a preserved medical term
          if (
            !this.isWithinPreservedTerm(
              match.index,
              match[0].length,
              preservedTerms.ranges
            )
          ) {
            detectedPHI.push({
              type: pattern.name,
              category: pattern.category,
              severity: pattern.severity,
              description: pattern.description,
              originalLength: match[0].length,
              position: match.index,
            });

            // Replace with redaction marker
            redactedText = redactedText.replace(match[0], pattern.replacement);
          }
        }
      }
    }

    // Restore preserved medical terms
    redactedText = this.restorePreservedTerms(
      redactedText,
      preservedTerms.mapping
    );

    // Calculate stats
    const redactionStats = this.calculateRedactionStats(detectedPHI);

    return {
      redactedText,
      detectedPHI,
      redactionStats,
    };
  }

  /**
   * Preserve medical terminology during redaction
   */
  private preserveMedicalTerms(text: string): {
    text: string;
    mapping: Map<string, string>;
    ranges: Array<{ start: number; end: number }>;
  } {
    const mapping = new Map<string, string>();
    const ranges: Array<{ start: number; end: number }> = [];
    let preservedText = text;

    MEDICAL_PRESERVE_PATTERNS.forEach((term, index) => {
      const placeholder = `__MEDICAL_TERM_${index}__`;
      const regex = new RegExp(
        `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'gi'
      );

      let match;
      while ((match = regex.exec(text)) !== null) {
        ranges.push({
          start: match.index,
          end: match.index + match[0].length,
        });
        mapping.set(placeholder, match[0]);
        preservedText = preservedText.replace(match[0], placeholder);
      }
    });

    return { text: preservedText, mapping, ranges };
  }

  /**
   * Check if a position is within a preserved term range
   */
  private isWithinPreservedTerm(
    position: number,
    length: number,
    ranges: Array<{ start: number; end: number }>
  ): boolean {
    const end = position + length;
    return ranges.some(
      (range) =>
        (position >= range.start && position < range.end) ||
        (end > range.start && end <= range.end) ||
        (position < range.start && end > range.end)
    );
  }

  /**
   * Restore preserved medical terms
   */
  private restorePreservedTerms(
    text: string,
    mapping: Map<string, string>
  ): string {
    let restoredText = text;
    mapping.forEach((originalTerm, placeholder) => {
      restoredText = restoredText.replace(
        new RegExp(placeholder, 'g'),
        originalTerm
      );
    });
    return restoredText;
  }

  /**
   * Calculate redaction statistics
   */
  private calculateRedactionStats(detectedPHI: RedactionResult['detectedPHI']) {
    const stats = {
      totalRedactions: detectedPHI.length,
      criticalRedactions: 0,
      highSeverityRedactions: 0,
      phiDetected: false,
      piiDetected: false,
    };

    for (const item of detectedPHI) {
      if (item.severity === 'critical') {
        stats.criticalRedactions++;
      }
      if (item.severity === 'high' || item.severity === 'critical') {
        stats.highSeverityRedactions++;
      }
      if (item.category === 'phi') {
        stats.phiDetected = true;
      }
      if (item.category === 'pii') {
        stats.piiDetected = true;
      }
    }

    return stats;
  }

  /**
   * Validate that text is safe for logging (no remaining PHI/PII)
   */
  validateSafeForLogging(text: string): {
    isSafe: boolean;
    riskyPatterns: string[];
    recommendations: string[];
  } {
    const riskyPatterns: string[] = [];
    const recommendations: string[] = [];

    // Quick scan for common PHI/PII patterns that might have been missed
    const quickPatterns = [
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: 'SSN format' },
      {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        name: 'Email',
      },
      { pattern: /\b\d{10,}\b/, name: 'Long number sequence' },
      { pattern: /\b[A-Z]{2}\d{6,}\b/, name: 'Alphanumeric ID' },
    ];

    for (const { pattern, name } of quickPatterns) {
      if (pattern.test(text)) {
        riskyPatterns.push(name);
      }
    }

    // Generate recommendations
    if (riskyPatterns.length > 0) {
      recommendations.push('Consider additional redaction before logging');
      recommendations.push('Review and update redaction patterns');
      if (riskyPatterns.includes('SSN format')) {
        recommendations.push(
          'Critical: SSN detected - immediate redaction required'
        );
      }
    }

    return {
      isSafe: riskyPatterns.length === 0,
      riskyPatterns,
      recommendations,
    };
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

let globalRedactionEngine: PHIRedactionEngine | null = null;

export function getPHIRedactionEngine(): PHIRedactionEngine {
  if (!globalRedactionEngine) {
    globalRedactionEngine = new PHIRedactionEngine();
  }
  return globalRedactionEngine;
}

/**
 * Quick redaction function for simple use cases
 */
export function redactPHI(text: string): string {
  const engine = getPHIRedactionEngine();
  const result = engine.redactText(text);
  return result.redactedText;
}

/**
 * Safe logging function that automatically redacts PHI/PII
 */
export function safeLog(message: string, data?: any): void {
  const engine = getPHIRedactionEngine();
  const redactedMessage = engine.redactText(message).redactedText;

  let redactedData = data;
  if (data && typeof data === 'object') {
    redactedData = JSON.parse(JSON.stringify(data));

    // Recursively redact string values in objects
    const redactObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return engine.redactText(obj).redactedText;
      } else if (Array.isArray(obj)) {
        return obj.map(redactObject);
      } else if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = redactObject(value);
        }
        return result;
      }
      return obj;
    };

    redactedData = redactObject(redactedData);
  }

  console.log(redactedMessage, redactedData);
}

export default PHIRedactionEngine;
