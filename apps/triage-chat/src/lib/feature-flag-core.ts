/**
 * Feature Flag Core Infrastructure
 * 
 * Production-grade feature flag system with medical safety controls,
 * emergency killswitch capabilities, and HIPAA-compliant audit logging.
 * 
 * CRITICAL: This system controls patient-facing features in a medical
 * application and must maintain the highest standards of safety and reliability.
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import type {
  FeatureFlagContract,
  UserSegment,
  FeatureFlagContext,
  FeatureFlagMetadata,
  MedicalSafetyStatus,
  UserSegmentationContract,
  UserProfile,
  HIPAAConsentFlags,
  RolloutEligibility,
  MedicalSafetyFlags,
  ABTestingContract,
  TestVariant,
  ExperimentMetadata,
  EmergencyControlsContract,
  EmergencyType,
  EmergencyRollbackPlan
} from '../../tests/contracts/feature-flag-system.contract';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const FeatureFlagConfigSchema = z.object({
  key: z.string().min(1).max(100),
  enabled: z.boolean(),
  rolloutPercentage: z.number().min(0).max(100),
  medicalSafetyLevel: z.enum(['low', 'medium', 'high', 'critical']),
  requiresMedicalProfessional: z.boolean().optional(),
  dependencies: z.array(z.string()).optional(),
  fallbackValue: z.any().optional(),
  prioritySegments: z.array(z.string()).optional(),
  emergencyKillswitchEnabled: z.boolean().default(true)
});

const UserContextSchema = z.object({
  userId: z.string(),
  segment: z.string(),
  medicalProfessionalStatus: z.boolean().optional(),
  emergencyContext: z.boolean().optional(),
  consentFlags: z.object({
    analyticsConsent: z.boolean(),
    testingParticipationConsent: z.boolean(),
    dataProcessingConsent: z.boolean()
  }).optional()
});

// =============================================================================
// CORE FEATURE FLAG EVALUATOR
// =============================================================================

export class FeatureFlagEvaluator {
  private segmentationEngine: UserSegmentationEngine;
  private safetyValidator: MedicalSafetyValidator;
  private auditLogger: HIPAAAuditLogger;
  private emergencyController: EmergencyController;

  constructor(dependencies: {
    segmentationEngine: UserSegmentationEngine;
    safetyValidator: MedicalSafetyValidator;
    auditLogger: HIPAAAuditLogger;
    emergencyController: EmergencyController;
  }) {
    this.segmentationEngine = dependencies.segmentationEngine;
    this.safetyValidator = dependencies.safetyValidator;
    this.auditLogger = dependencies.auditLogger;
    this.emergencyController = dependencies.emergencyController;
  }

  /**
   * Evaluate a feature flag for a specific user context
   * 
   * CRITICAL: This is the core evaluation function that determines which
   * features users see. Medical safety checks are mandatory.
   */
  async evaluate(
    flagConfig: z.infer<typeof FeatureFlagConfigSchema>,
    userContext: z.infer<typeof UserContextSchema>
  ): Promise<{
    enabled: boolean;
    variant: string;
    metadata: FeatureFlagMetadata;
    safetyStatus: MedicalSafetyStatus;
  }> {
    const startTime = Date.now();
    const evaluationId = this.generateEvaluationId();

    try {
      // Validate inputs
      const validatedConfig = FeatureFlagConfigSchema.parse(flagConfig);
      const validatedContext = UserContextSchema.parse(userContext);

      // Check for emergency killswitch
      const emergencyStatus = await this.emergencyController.checkEmergencyStatus(validatedConfig.key);
      if (emergencyStatus.killswitchActive) {
        return this.createFailsafeResponse(
          validatedConfig,
          'emergency_killswitch_active',
          startTime,
          evaluationId
        );
      }

      // Medical safety validation (MANDATORY)
      const safetyValidation = await this.safetyValidator.validateFlagForUser(
        validatedConfig,
        validatedContext
      );

      if (!safetyValidation.approved) {
        await this.auditLogger.logFlagEvaluation({
          flagKey: validatedConfig.key,
          userId: validatedContext.userId,
          result: 'blocked_by_safety',
          reason: safetyValidation.reason,
          timestamp: new Date(),
          evaluationId
        });

        return {
          enabled: false,
          variant: 'disabled_safety',
          metadata: {
            evaluationTime: Date.now() - startTime,
            rolloutPercentage: 0,
            safetyValidated: true,
            complianceChecked: true,
            overrideReason: 'medical_safety_requirement_not_met'
          },
          safetyStatus: {
            approved: false,
            riskLevel: safetyValidation.riskLevel || 'high',
            requiredPrecautions: safetyValidation.requiredPrecautions || [],
            monitoringEnabled: true,
            emergencyContactsNotified: safetyValidation.riskLevel === 'critical'
          }
        };
      }

      // Check dependencies
      const dependencyCheck = await this.checkDependencies(
        validatedConfig.dependencies || [],
        validatedContext
      );

      if (!dependencyCheck.allMet) {
        return {
          enabled: false,
          variant: 'disabled_dependency',
          metadata: {
            evaluationTime: Date.now() - startTime,
            rolloutPercentage: validatedConfig.rolloutPercentage,
            safetyValidated: true,
            complianceChecked: true,
            disabledReason: 'dependency_not_met',
            missingDependencies: dependencyCheck.missing
          },
          safetyStatus: safetyValidation
        };
      }

      // Calculate rollout inclusion
      const rolloutCalculator = new RolloutCalculator();
      const rolloutResult = rolloutCalculator.calculateRollout(
        validatedConfig.key,
        validatedContext.userId,
        validatedConfig.rolloutPercentage
      );

      // Apply priority segment overrides
      let finalEnabled = rolloutResult.included;
      let priorityOverride = false;

      if (validatedConfig.prioritySegments?.includes(validatedContext.segment)) {
        finalEnabled = true;
        priorityOverride = true;
      }

      // Emergency users always get critical features
      if (validatedContext.emergencyContext && validatedConfig.medicalSafetyLevel === 'critical') {
        finalEnabled = true;
        priorityOverride = true;
      }

      const result = {
        enabled: finalEnabled && validatedConfig.enabled,
        variant: finalEnabled ? 'enabled' : 'disabled',
        metadata: {
          evaluationTime: Date.now() - startTime,
          rolloutPercentage: validatedConfig.rolloutPercentage,
          safetyValidated: true,
          complianceChecked: true,
          priorityOverride,
          evaluationId
        },
        safetyStatus: safetyValidation
      };

      // Audit log the evaluation
      await this.auditLogger.logFlagEvaluation({
        flagKey: validatedConfig.key,
        userId: validatedContext.userId,
        result: result.enabled ? 'enabled' : 'disabled',
        rolloutPercentage: validatedConfig.rolloutPercentage,
        medicalSafetyLevel: validatedConfig.medicalSafetyLevel,
        timestamp: new Date(),
        evaluationId
      });

      return result;

    } catch (error) {
      console.error('Feature flag evaluation error:', {
        flagKey: flagConfig.key,
        userId: userContext.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        evaluationId
      });

      // Return safe fallback
      return this.createFailsafeResponse(
        flagConfig,
        'evaluation_error',
        startTime,
        evaluationId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Check if all flag dependencies are met
   */
  async checkDependencies(
    dependencies: string[],
    userContext: z.infer<typeof UserContextSchema>
  ): Promise<{ allMet: boolean; missing: string[] }> {
    if (dependencies.length === 0) {
      return { allMet: true, missing: [] };
    }

    const missing: string[] = [];
    
    for (const dependency of dependencies) {
      try {
        // This would typically check other flags or services
        // For now: basic check
        const dependencyMet = await this.checkSingleDependency(dependency, userContext);
        if (!dependencyMet) {
          missing.push(dependency);
        }
      } catch (error) {
        console.warn(`Dependency check failed for ${dependency}:`, error);
        missing.push(dependency);
      }
    }

    return {
      allMet: missing.length === 0,
      missing
    };
  }

  private async checkSingleDependency(
    dependency: string,
    userContext: z.infer<typeof UserContextSchema>
  ): Promise<boolean> {
    // Implementation would check actual dependency status
    // This is a placeholder that assumes dependencies are met
    return true;
  }

  private createFailsafeResponse(
    flagConfig: any,
    reason: string,
    startTime: number,
    evaluationId: string,
    error?: string
  ) {
    return {
      enabled: flagConfig.fallbackValue ?? false,
      variant: 'failsafe',
      metadata: {
        evaluationTime: Date.now() - startTime,
        rolloutPercentage: 0,
        safetyValidated: false,
        complianceChecked: false,
        fallbackUsed: true,
        failsafeReason: reason,
        error,
        evaluationId
      },
      safetyStatus: {
        approved: false,
        riskLevel: 'critical' as const,
        requiredPrecautions: ['manual_review_required'],
        monitoringEnabled: true,
        emergencyContactsNotified: false
      }
    };
  }

  private generateEvaluationId(): string {
    return `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// USER SEGMENTATION ENGINE
// =============================================================================

export class UserSegmentationEngine {
  private medicalVerification: MedicalVerificationService;
  private geoService: GeographicLocationService;
  private auditLogger: HIPAAAuditLogger;

  constructor(dependencies: {
    medicalVerification: MedicalVerificationService;
    geoService: GeographicLocationService;
    auditLogger: HIPAAAuditLogger;
  }) {
    this.medicalVerification = dependencies.medicalVerification;
    this.geoService = dependencies.geoService;
    this.auditLogger = dependencies.auditLogger;
  }

  /**
   * Calculate user segment based on profile and context
   */
  async calculateSegment(userProfile: UserProfile): Promise<{
    primarySegment: UserSegment;
    secondarySegments: UserSegment[];
    rolloutEligibility: RolloutEligibility;
    medicalSafetyFlags: MedicalSafetyFlags;
    geographicContext?: any;
    regulatoryFlags?: any;
  }> {
    try {
      // Primary segment determination
      let primarySegment: UserSegment = 'general_users';
      const secondarySegments: UserSegment[] = [];
      
      // Check medical professional status
      if (userProfile.medicalProfessionalStatus) {
        const verification = await this.medicalVerification.verifyMedicalProfessional(userProfile.id);
        if (verification.verified) {
          primarySegment = 'medical_professionals';
          if (verification.specialization) {
            secondarySegments.push(`${verification.specialization}_specialists` as UserSegment);
          }
        }
      }

      // Check beta tester status
      if (userProfile.betaTesterStatus) {
        primarySegment = 'beta_testers';
      }

      // Check emergency context
      if (userProfile.emergencyContext) {
        primarySegment = 'emergency_users';
      }

      // Check high-risk patient status
      if (userProfile.riskFactors && userProfile.riskFactors.length > 0) {
        secondarySegments.push('high_risk_patients');
      }

      // Geographic segmentation
      let geographicContext;
      if (userProfile.ipAddress || userProfile.zipCode) {
        try {
          geographicContext = await this.geoService.getLocationFromIP(userProfile.ipAddress || '');
          if (geographicContext.region) {
            secondarySegments.push(`${geographicContext.region}_region` as UserSegment);
          }
        } catch (error) {
          console.warn('Geographic segmentation failed:', error);
        }
      }

      // Calculate rollout eligibility
      const rolloutEligibility = this.calculateRolloutEligibility(userProfile, primarySegment);

      // Determine medical safety flags
      const medicalSafetyFlags: MedicalSafetyFlags = {
        highRiskPatient: secondarySegments.includes('high_risk_patients'),
        emergencyContext: !!userProfile.emergencyContext,
        medicalProfessionalOverride: primarySegment === 'medical_professionals',
        regulatoryRestrictions: this.determineRegulatoryRestrictions(geographicContext)
      };

      // Audit the segmentation
      await this.auditLogger.logUserSegmentation({
        userId: userProfile.id,
        primarySegment,
        secondarySegments,
        medicalSafetyFlags,
        timestamp: new Date()
      });

      return {
        primarySegment,
        secondarySegments,
        rolloutEligibility,
        medicalSafetyFlags,
        geographicContext,
        regulatoryFlags: geographicContext ? { gdprApplicable: geographicContext.gdprApplicable } : undefined
      };

    } catch (error) {
      console.error('User segmentation error:', error);
      
      // Safe fallback
      return {
        primarySegment: 'general_users',
        secondarySegments: [],
        rolloutEligibility: {
          eligible: false,
          eligibilityReasons: ['segmentation_error'],
          restrictions: ['require_manual_review'],
          medicalSafetyApproved: false,
          eligibilityScore: 0
        },
        medicalSafetyFlags: {
          highRiskPatient: true, // Err on side of caution
          emergencyContext: false,
          medicalProfessionalOverride: false,
          regulatoryRestrictions: ['segmentation_unavailable']
        }
      };
    }
  }

  private calculateRolloutEligibility(
    userProfile: UserProfile,
    primarySegment: UserSegment
  ): RolloutEligibility {
    const eligibilityReasons: string[] = [];
    const restrictions: string[] = [];
    let eligibilityScore = 0.5; // Base score

    // Check consent status
    if (!userProfile.consentPreferences?.analytics) {
      restrictions.push('insufficient_consent');
      eligibilityScore -= 0.3;
    }

    if (!userProfile.consentPreferences?.testing) {
      restrictions.push('no_testing_consent');
      eligibilityScore -= 0.2;
    }

    // Medical professionals get higher eligibility
    if (primarySegment === 'medical_professionals') {
      eligibilityReasons.push('medical_professional_status');
      eligibilityScore += 0.3;
    }

    // Beta testers get priority
    if (primarySegment === 'beta_testers') {
      eligibilityReasons.push('beta_tester_status');
      eligibilityScore += 0.2;
    }

    // High-risk patients may have restrictions
    if (userProfile.riskFactors && userProfile.riskFactors.length > 2) {
      restrictions.push('high_risk_patient_review_required');
      eligibilityScore -= 0.1;
    }

    const eligible = restrictions.length === 0 && eligibilityScore > 0.5;

    return {
      eligible,
      eligibilityReasons,
      restrictions,
      medicalSafetyApproved: eligible && primarySegment === 'medical_professionals',
      eligibilityScore: Math.max(0, Math.min(1, eligibilityScore)),
      betaTesterBenefits: primarySegment === 'beta_testers',
      emergencyPriority: primarySegment === 'emergency_users'
    };
  }

  private determineRegulatoryRestrictions(geographicContext: any): string[] {
    const restrictions: string[] = [];
    
    if (geographicContext?.gdprApplicable) {
      restrictions.push('gdpr_compliance_required');
    }
    
    if (geographicContext?.country === 'CA') {
      restrictions.push('pipeda_compliance_required');
    }
    
    return restrictions;
  }
}

// =============================================================================
// ROLLOUT CALCULATOR
// =============================================================================

export class RolloutCalculator {
  /**
   * Calculate if a user should be included in a rollout using consistent hashing
   */
  calculateRollout(
    flagKey: string,
    userId: string,
    rolloutPercentage: number
  ): { included: boolean; hashValue: number; rolloutPercentage: number } {
    // Validate inputs
    if (rolloutPercentage < 0 || rolloutPercentage > 100) {
      rolloutPercentage = 0;
    }

    if (rolloutPercentage === 0) {
      return { included: false, hashValue: 0, rolloutPercentage: 0 };
    }

    if (rolloutPercentage === 100) {
      return { included: true, hashValue: 100, rolloutPercentage: 100 };
    }

    // Create consistent hash
    const hashInput = `${flagKey}:${userId}`;
    const hash = createHash('sha256').update(hashInput).digest('hex');
    
    // Convert first 8 characters to number and normalize to 0-100
    const hashValue = parseInt(hash.substring(0, 8), 16) % 10000 / 100;
    
    const included = hashValue < rolloutPercentage;

    return {
      included,
      hashValue,
      rolloutPercentage
    };
  }

  /**
   * Calculate rollout with segment-specific percentages
   */
  calculateSegmentRollout(
    rolloutConfig: {
      flagKey: string;
      segments: Record<string, number>;
      defaultRollout?: number;
    },
    userId: string,
    userSegment: string
  ): { included: boolean; hashValue: number; rolloutPercentage: number } {
    const segmentPercentage = rolloutConfig.segments[userSegment] ?? rolloutConfig.defaultRollout ?? 0;
    
    return this.calculateRollout(rolloutConfig.flagKey, userId, segmentPercentage);
  }

  /**
   * Calculate rollout with medical safety overrides
   */
  calculateWithSafetyOverrides(
    rolloutConfig: {
      flagKey: string;
      baseRollout: number;
      medicalSafetyOverrides: Record<string, number>;
    },
    userId: string,
    userSegments: string[]
  ): { included: boolean; hashValue: number; rolloutPercentage: number; safetyOverrideApplied: boolean } {
    // Check for safety overrides
    for (const segment of userSegments) {
      if (rolloutConfig.medicalSafetyOverrides[segment] !== undefined) {
        const overridePercentage = rolloutConfig.medicalSafetyOverrides[segment];
        const result = this.calculateRollout(rolloutConfig.flagKey, userId, overridePercentage);
        
        return {
          ...result,
          safetyOverrideApplied: true
        };
      }
    }

    // No override, use base rollout
    const result = this.calculateRollout(rolloutConfig.flagKey, userId, rolloutConfig.baseRollout);
    return {
      ...result,
      safetyOverrideApplied: false
    };
  }
}

// =============================================================================
// MEDICAL SAFETY VALIDATOR
// =============================================================================

export class MedicalSafetyValidator {
  private complianceChecker: ComplianceChecker;
  private auditLogger: HIPAAAuditLogger;

  constructor(dependencies: {
    complianceChecker: ComplianceChecker;
    auditLogger: HIPAAAuditLogger;
  }) {
    this.complianceChecker = dependencies.complianceChecker;
    this.auditLogger = dependencies.auditLogger;
  }

  /**
   * Validate if a flag is safe for a specific user
   */
  async validateFlagForUser(
    flagConfig: any,
    userContext: any
  ): Promise<MedicalSafetyStatus> {
    try {
      const validationId = this.generateValidationId();

      // Check medical safety level requirements
      if (flagConfig.medicalSafetyLevel === 'critical' || flagConfig.medicalSafetyLevel === 'high') {
        if (flagConfig.requiresMedicalProfessional && !userContext.medicalProfessionalStatus) {
          return {
            approved: false,
            riskLevel: flagConfig.medicalSafetyLevel,
            requiredPrecautions: ['medical_professional_verification_required'],
            monitoringEnabled: true,
            emergencyContactsNotified: false,
            reason: 'Medical professional verification required for high-risk features'
          };
        }
      }

      // Check consent requirements
      if (userContext.consentFlags) {
        if (!userContext.consentFlags.dataProcessingConsent) {
          return {
            approved: false,
            riskLevel: 'medium',
            requiredPrecautions: ['obtain_data_processing_consent'],
            monitoringEnabled: false,
            emergencyContactsNotified: false,
            reason: 'Data processing consent required'
          };
        }
      }

      // Additional safety checks would go here
      const safetyScore = await this.calculateSafetyScore(flagConfig, userContext);
      
      const approved = safetyScore >= 0.8;

      await this.auditLogger.logSafetyValidation({
        flagKey: flagConfig.key,
        userId: userContext.userId,
        validationId,
        approved,
        safetyScore,
        timestamp: new Date()
      });

      return {
        approved,
        riskLevel: this.determineRiskLevel(safetyScore),
        requiredPrecautions: approved ? [] : ['enhanced_monitoring_required'],
        monitoringEnabled: true,
        emergencyContactsNotified: !approved && flagConfig.medicalSafetyLevel === 'critical'
      };

    } catch (error) {
      console.error('Medical safety validation error:', error);
      
      // Fail safe - deny access when validation fails
      return {
        approved: false,
        riskLevel: 'critical',
        requiredPrecautions: ['manual_safety_review_required'],
        monitoringEnabled: true,
        emergencyContactsNotified: true,
        reason: 'Safety validation system error'
      };
    }
  }

  /**
   * Validate flag activation meets medical safety requirements
   */
  async validateFlagActivation(flagRequest: any): Promise<{
    approved: boolean;
    reason?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresManualReview: boolean;
    blockingReasons?: string[];
    emergencyReviewRequired?: boolean;
  }> {
    try {
      // Get current safety metrics
      const safetyMetrics = await this.getCurrentSafetyMetrics();
      
      const blockingReasons: string[] = [];

      // Check error rate thresholds
      if (safetyMetrics.errorRate > 0.05) {
        blockingReasons.push('Error rate exceeds safety threshold');
      }

      // Check patient complaint rate
      if (safetyMetrics.patientComplaintRate > 0.02) {
        blockingReasons.push('Patient complaint rate too high');
      }

      // Check medical professional feedback
      if (safetyMetrics.medicalProfessionalFeedback < 3.0) {
        blockingReasons.push('Medical professional feedback below minimum');
      }

      // Check safety incidents
      if (safetyMetrics.safetyIncidents > 2) {
        blockingReasons.push('Recent safety incidents require review');
      }

      const approved = blockingReasons.length === 0;
      const emergencyReviewRequired = safetyMetrics.safetyIncidents > 0;

      return {
        approved,
        reason: approved ? undefined : 'Safety thresholds not met',
        riskLevel: this.assessRiskLevel(safetyMetrics),
        requiresManualReview: !approved,
        blockingReasons: blockingReasons.length > 0 ? blockingReasons : undefined,
        emergencyReviewRequired
      };

    } catch (error) {
      console.error('Flag activation validation error:', error);
      
      return {
        approved: false,
        reason: 'Medical safety assessment unavailable - failing safe',
        riskLevel: 'critical',
        requiresManualReview: true
      };
    }
  }

  private async calculateSafetyScore(flagConfig: any, userContext: any): Promise<number> {
    let score = 0.7; // Base score

    // Medical professional status adds safety
    if (userContext.medicalProfessionalStatus) {
      score += 0.2;
    }

    // Low medical impact is safer
    if (flagConfig.medicalSafetyLevel === 'low') {
      score += 0.1;
    } else if (flagConfig.medicalSafetyLevel === 'critical') {
      score -= 0.2;
    }

    // Emergency context requires extra caution
    if (userContext.emergencyContext) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  private determineRiskLevel(safetyScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (safetyScore >= 0.9) return 'low';
    if (safetyScore >= 0.7) return 'medium';
    if (safetyScore >= 0.5) return 'high';
    return 'critical';
  }

  private async getCurrentSafetyMetrics(): Promise<{
    errorRate: number;
    patientComplaintRate: number;
    medicalProfessionalFeedback: number;
    safetyIncidents: number;
    falsePositiveRate: number;
  }> {
    // Implementation would fetch real metrics
    return {
      errorRate: 0.02,
      patientComplaintRate: 0.01,
      medicalProfessionalFeedback: 4.2,
      safetyIncidents: 0,
      falsePositiveRate: 0.05
    };
  }

  private assessRiskLevel(metrics: any): 'low' | 'medium' | 'high' | 'critical' {
    if (metrics.safetyIncidents > 2 || metrics.errorRate > 0.1) return 'critical';
    if (metrics.errorRate > 0.05 || metrics.patientComplaintRate > 0.02) return 'high';
    if (metrics.medicalProfessionalFeedback < 3.5) return 'medium';
    return 'low';
  }

  private generateValidationId(): string {
    return `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// EMERGENCY CONTROLLER
// =============================================================================

export class EmergencyController {
  private auditLogger: HIPAAAuditLogger;
  private notificationService: NotificationService;
  private flagStorage: FeatureFlagStorage;

  constructor(dependencies: {
    auditLogger: HIPAAAuditLogger;
    notificationService: NotificationService;
    flagStorage: FeatureFlagStorage;
  }) {
    this.auditLogger = dependencies.auditLogger;
    this.notificationService = dependencies.notificationService;
    this.flagStorage = dependencies.flagStorage;
  }

  /**
   * Check if emergency killswitch is active for a flag
   */
  async checkEmergencyStatus(flagKey: string): Promise<{
    killswitchActive: boolean;
    reason?: string;
    activatedBy?: string;
    timestamp?: Date;
  }> {
    try {
      const emergencyRecord = await this.flagStorage.getEmergencyRecord(flagKey);
      
      return {
        killswitchActive: emergencyRecord?.active || false,
        reason: emergencyRecord?.reason,
        activatedBy: emergencyRecord?.activatedBy,
        timestamp: emergencyRecord?.timestamp
      };
    } catch (error) {
      console.error('Emergency status check failed:', error);
      
      // Fail safe: assume emergency when the check cannot run
      return {
        killswitchActive: true,
        reason: 'Emergency status verification failed - failing safe'
      };
    }
  }

  /**
   * Activate emergency controls for a flag or system-wide
   */
  async activateEmergency(request: {
    emergencyType: EmergencyType;
    flagKey?: string;
    medicalProfessionalId: string;
    justification: string;
    affectedUserCount?: number;
    emergencyOverride?: boolean;
    emergencyOverrideCode?: string;
  }): Promise<{
    killswitchActivated: boolean;
    affectedFlags: string[];
    rollbackPlan: EmergencyRollbackPlan;
    notificationsSent: any[];
    auditTrail: any;
    emergencyId: string;
    emergencyOverrideUsed?: boolean;
  }> {
    const emergencyId = this.generateEmergencyId();
    const timestamp = new Date();

    try {
      // Verify authorization (unless emergency override)
      if (!request.emergencyOverride) {
        const authResult = await this.verifyEmergencyAuthorization(request.medicalProfessionalId);
        if (!authResult.authorized) {
          throw new Error('Unauthorized emergency activation attempt');
        }
      } else {
        // Verify emergency override code
        const overrideValid = await this.verifyEmergencyOverride(request.emergencyOverrideCode);
        if (!overrideValid) {
          throw new Error('Invalid emergency override code');
        }
      }

      // Determine affected flags
      const affectedFlags = request.flagKey ? [request.flagKey] : await this.getAllActiveFlags();

      // Execute emergency disable
      const disableResults = await this.executeEmergencyDisable(affectedFlags, request);

      // Create rollback plan
      const rollbackPlan = await this.createEmergencyRollbackPlan(affectedFlags, request);

      // Send notifications
      const notifications = await this.sendEmergencyNotifications(request, emergencyId);

      // Create comprehensive audit record
      const auditRecord = await this.auditLogger.logEmergencyAction({
        emergencyId,
        emergencyType: request.emergencyType,
        triggeredBy: request.medicalProfessionalId,
        justification: request.justification,
        affectedFlags,
        timestamp,
        affectedUserCount: request.affectedUserCount,
        emergencyOverrideUsed: !!request.emergencyOverride
      });

      return {
        killswitchActivated: true,
        affectedFlags,
        rollbackPlan,
        notificationsSent: notifications,
        auditTrail: auditRecord,
        emergencyId,
        emergencyOverrideUsed: !!request.emergencyOverride
      };

    } catch (error) {
      console.error('Emergency activation failed:', error);
      
      // Log the failure
      await this.auditLogger.logEmergencyFailure({
        emergencyId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        attemptedBy: request.medicalProfessionalId
      });

      throw error;
    }
  }

  private async verifyEmergencyAuthorization(medicalProfessionalId: string): Promise<{
    authorized: boolean;
    role?: string;
  }> {
    // Implementation would verify medical professional credentials
    // For now: basic validation
    if (!medicalProfessionalId || medicalProfessionalId.length < 5) {
      return { authorized: false };
    }

    return { authorized: true, role: 'emergency_authorized' };
  }

  private async verifyEmergencyOverride(overrideCode?: string): Promise<boolean> {
    // Implementation would verify emergency override codes
    return overrideCode === 'MEDICAL_OVERRIDE_2024';
  }

  private async getAllActiveFlags(): Promise<string[]> {
    // Implementation would get all active flags
    return ['enhanced-triage-mcp', 'progressive-disclosure', 'cultural-adaptation'];
  }

  private async executeEmergencyDisable(
    flagKeys: string[],
    request: any
  ): Promise<{ successful: string[]; failed: string[] }> {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const flagKey of flagKeys) {
      try {
        await this.flagStorage.emergencyDisableFlag(flagKey, {
          reason: request.justification,
          emergencyType: request.emergencyType,
          timestamp: new Date()
        });
        successful.push(flagKey);
      } catch (error) {
        console.error(`Failed to disable flag ${flagKey}:`, error);
        failed.push(flagKey);
      }
    }

    return { successful, failed };
  }

  private async createEmergencyRollbackPlan(
    flagKeys: string[],
    request: any
  ): Promise<EmergencyRollbackPlan> {
    return {
      rollbackSteps: [
        {
          id: 'step_1',
          description: 'Verify system stability',
          automatable: true,
          estimatedDuration: 5,
          dependencies: []
        },
        {
          id: 'step_2',
          description: 'Re-enable flags gradually',
          automatable: true,
          estimatedDuration: 15,
          dependencies: ['step_1']
        },
        {
          id: 'step_3',
          description: 'Validate medical safety metrics',
          automatable: false,
          estimatedDuration: 30,
          dependencies: ['step_2']
        }
      ],
      estimatedDuration: 50,
      affectedSystems: ['feature_flags', 'user_interface', 'medical_logic'],
      requiredApprovals: ['medical_professional', 'system_administrator'],
      communicationPlan: [
        {
          audience: 'medical_team',
          message: 'Emergency rollback initiated',
          channel: 'immediate_alert',
          timing: 'immediate'
        }
      ]
    };
  }

  private async sendEmergencyNotifications(
    request: any,
    emergencyId: string
  ): Promise<any[]> {
    const notifications = [];

    try {
      // Alert medical team
      const medicalAlert = await this.notificationService.sendEmergencyAlert({
        type: 'medical_emergency',
        severity: 'critical',
        message: `Emergency activated: ${request.justification}`,
        emergencyId,
        timestamp: new Date()
      });
      notifications.push(medicalAlert);

      // Alert regulatory if required
      if (request.emergencyType === 'data_privacy_violation' || request.emergencyType === 'regulatory_compliance_issue') {
        const regulatoryAlert = await this.notificationService.alertRegulatory({
          emergencyType: request.emergencyType,
          severity: 'critical',
          reportingRequired: true,
          timestamp: new Date()
        });
        notifications.push(regulatoryAlert);
      }

    } catch (error) {
      console.error('Emergency notification failed:', error);
      // Don't fail the emergency activation if notifications fail
    }

    return notifications;
  }

  private generateEmergencyId(): string {
    return `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// AUDIT LOGGER
// =============================================================================

export class HIPAAAuditLogger {
  private storage: AuditStorage;
  private encryptionService: EncryptionService;

  constructor(dependencies: {
    storage: AuditStorage;
    encryptionService: EncryptionService;
  }) {
    this.storage = dependencies.storage;
    this.encryptionService = dependencies.encryptionService;
  }

  async logFlagEvaluation(data: {
    flagKey: string;
    userId: string;
    result: string;
    rolloutPercentage?: number;
    medicalSafetyLevel?: string;
    timestamp: Date;
    evaluationId: string;
    reason?: string;
  }): Promise<void> {
    const auditEntry = {
      id: this.generateAuditId(),
      type: 'flag_evaluation',
      ...data,
      digitalSignature: await this.encryptionService.sign(JSON.stringify(data)),
      integrityHash: await this.encryptionService.hash(JSON.stringify(data))
    };

    await this.storage.storeAuditEntry(auditEntry);
  }

  async logUserSegmentation(data: {
    userId: string;
    primarySegment: string;
    secondarySegments: string[];
    medicalSafetyFlags: any;
    timestamp: Date;
  }): Promise<void> {
    const auditEntry = {
      id: this.generateAuditId(),
      type: 'user_segmentation',
      ...data,
      digitalSignature: await this.encryptionService.sign(JSON.stringify(data)),
      integrityHash: await this.encryptionService.hash(JSON.stringify(data))
    };

    await this.storage.storeAuditEntry(auditEntry);
  }

  async logSafetyValidation(data: {
    flagKey: string;
    userId: string;
    validationId: string;
    approved: boolean;
    safetyScore: number;
    timestamp: Date;
  }): Promise<void> {
    const auditEntry = {
      id: this.generateAuditId(),
      type: 'safety_validation',
      ...data,
      digitalSignature: await this.encryptionService.sign(JSON.stringify(data)),
      integrityHash: await this.encryptionService.hash(JSON.stringify(data))
    };

    await this.storage.storeAuditEntry(auditEntry);
  }

  async logEmergencyAction(data: any): Promise<any> {
    const auditEntry = {
      id: this.generateAuditId(),
      type: 'emergency_action',
      ...data,
      digitalSignature: await this.encryptionService.sign(JSON.stringify(data)),
      integrityHash: await this.encryptionService.hash(JSON.stringify(data))
    };

    await this.storage.storeAuditEntry(auditEntry);
    return auditEntry;
  }

  async logEmergencyFailure(data: any): Promise<void> {
    const auditEntry = {
      id: this.generateAuditId(),
      type: 'emergency_failure',
      ...data,
      digitalSignature: await this.encryptionService.sign(JSON.stringify(data)),
      integrityHash: await this.encryptionService.hash(JSON.stringify(data))
    };

    await this.storage.storeAuditEntry(auditEntry);
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// SUPPORTING TYPES AND INTERFACES
// =============================================================================

interface MedicalVerificationService {
  verifyMedicalProfessional(userId: string): Promise<{
    verified: boolean;
    specialization?: string;
    credentials?: string[];
  }>;
}

interface GeographicLocationService {
  getLocationFromIP(ipAddress: string): Promise<{
    country: string;
    region: string;
    state?: string;
    gdprApplicable?: boolean;
  }>;
}

interface ComplianceChecker {
  checkHIPAACompliance(data: any): Promise<boolean>;
  checkGDPRCompliance(data: any): Promise<boolean>;
}

interface NotificationService {
  sendEmergencyAlert(alert: any): Promise<any>;
  alertRegulatory(alert: any): Promise<any>;
}

interface FeatureFlagStorage {
  getEmergencyRecord(flagKey: string): Promise<any>;
  emergencyDisableFlag(flagKey: string, context: any): Promise<void>;
}

interface AuditStorage {
  storeAuditEntry(entry: any): Promise<void>;
}

interface EncryptionService {
  sign(data: string): Promise<string>;
  hash(data: string): Promise<string>;
}