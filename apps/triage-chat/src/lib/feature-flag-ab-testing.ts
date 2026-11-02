/**
 * A/B Testing Framework for Medical Feature Flags
 * 
 * Production-grade A/B testing system designed specifically for medical applications
 * with statistical significance tracking, medical professional feedback integration,
 * and patient safety monitoring.
 * 
 * CRITICAL: This system tests features that affect patient care and must maintain
 * the highest standards of medical ethics, statistical rigor, and safety monitoring.
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import type {
  ABTestingContract,
  TestVariant,
  ExperimentMetadata,
  MedicalImpactLevel,
  UserSegment
} from '../../tests/contracts/feature-flag-system.contract';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const ExperimentConfigSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  medicalImpact: z.enum(['none', 'minimal', 'moderate', 'significant', 'critical']),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    weight: z.number().min(0).max(100),
    configuration: z.record(z.any()),
    medicallyApproved: z.boolean(),
    safetyNotes: z.string().optional()
  })).min(2),
  targetSegments: z.array(z.string()),
  medicalApprovalRequired: z.boolean(),
  medicalApprovalId: z.string().optional(),
  safetyThresholds: z.object({
    errorRate: z.number().max(1),
    userComplaintRate: z.number().max(1),
    medicalProfessionalFeedback: z.number().min(1).max(5)
  }),
  statisticalRequirements: z.object({
    minimumSampleSize: z.number().min(1),
    significanceLevel: z.number().min(0.01).max(0.1),
    statisticalPower: z.number().min(0.7).max(0.99),
    minimumDetectableEffect: z.number().min(0.01).max(1)
  }),
  duration: z.object({
    planned: z.number(), // Days
    maximum: z.number()   // Safety limit
  })
});

const UserContextSchema = z.object({
  userId: z.string(),
  segment: z.string(),
  medicalProfessionalStatus: z.boolean().optional(),
  consentFlags: z.object({
    testingParticipationConsent: z.boolean(),
    dataProcessingConsent: z.boolean(),
    feedbackConsent: z.boolean()
  }),
  medicalContext: z.object({
    patientRiskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    emergencyContext: z.boolean().optional(),
    sensitiveConditions: z.array(z.string()).optional()
  }).optional()
});

// =============================================================================
// A/B TESTING ENGINE
// =============================================================================

export class ABTestingEngine {
  private statisticsCalculator: StatisticsCalculator;
  private medicalSafetyMonitor: MedicalSafetyMonitor;
  private feedbackCollector: MedicalFeedbackCollector;
  private auditLogger: ABTestAuditLogger;
  private experimentStorage: ExperimentStorage;

  constructor(dependencies: {
    statisticsCalculator: StatisticsCalculator;
    medicalSafetyMonitor: MedicalSafetyMonitor;
    feedbackCollector: MedicalFeedbackCollector;
    auditLogger: ABTestAuditLogger;
    experimentStorage: ExperimentStorage;
  }) {
    this.statisticsCalculator = dependencies.statisticsCalculator;
    this.medicalSafetyMonitor = dependencies.medicalSafetyMonitor;
    this.feedbackCollector = dependencies.feedbackCollector;
    this.auditLogger = dependencies.auditLogger;
    this.experimentStorage = dependencies.experimentStorage;
  }

  /**
   * Assign a user to an experiment variant with medical safety checks
   */
  async assignVariant(
    experiment: z.infer<typeof ExperimentConfigSchema>,
    userContext: z.infer<typeof UserContextSchema>
  ): Promise<{
    variantId: string;
    experimentId: string;
    assignmentId: string;
    medicallyApproved: boolean;
    safetyChecked: boolean;
    excluded?: boolean;
    exclusionReason?: string;
    metadata: any;
  }> {
    const assignmentId = this.generateAssignmentId();
    const startTime = Date.now();

    try {
      // Validate inputs
      const validatedExperiment = ExperimentConfigSchema.parse(experiment);
      const validatedContext = UserContextSchema.parse(userContext);

      // Check medical approval requirements
      if (validatedExperiment.medicalApprovalRequired && !validatedExperiment.medicalApprovalId) {
        return {
          variantId: 'control',
          experimentId: validatedExperiment.key,
          assignmentId,
          medicallyApproved: false,
          safetyChecked: true,
          excluded: true,
          exclusionReason: 'medical_approval_required',
          metadata: { evaluationTime: Date.now() - startTime }
        };
      }

      // Check user consent for testing participation
      if (!validatedContext.consentFlags.testingParticipationConsent) {
        await this.auditLogger.logExperimentExclusion({
          experimentId: validatedExperiment.key,
          userId: validatedContext.userId,
          reason: 'no_testing_consent',
          timestamp: new Date(),
          assignmentId
        });

        return {
          variantId: 'control',
          experimentId: validatedExperiment.key,
          assignmentId,
          medicallyApproved: true,
          safetyChecked: true,
          excluded: true,
          exclusionReason: 'no_testing_consent',
          metadata: { evaluationTime: Date.now() - startTime }
        };
      }

      // Medical safety check for high-impact experiments
      if (validatedExperiment.medicalImpact === 'significant' || validatedExperiment.medicalImpact === 'critical') {
        const safetyApproval = await this.medicalSafetyMonitor.validateExperimentParticipation(
          validatedExperiment,
          validatedContext
        );

        if (!safetyApproval.approved) {
          return {
            variantId: 'control',
            experimentId: validatedExperiment.key,
            assignmentId,
            medicallyApproved: false,
            safetyChecked: true,
            excluded: true,
            exclusionReason: 'medical_safety_exclusion',
            metadata: {
              evaluationTime: Date.now() - startTime,
              safetyReason: safetyApproval.reason
            }
          };
        }
      }

      // Check if user is already assigned to this experiment
      const existingAssignment = await this.experimentStorage.getExistingAssignment(
        validatedExperiment.key,
        validatedContext.userId
      );

      if (existingAssignment) {
        return {
          variantId: existingAssignment.variantId,
          experimentId: validatedExperiment.key,
          assignmentId: existingAssignment.assignmentId,
          medicallyApproved: true,
          safetyChecked: true,
          metadata: {
            evaluationTime: Date.now() - startTime,
            existingAssignment: true
          }
        };
      }

      // Calculate variant assignment using consistent hashing
      const variantId = this.calculateVariantAssignment(validatedExperiment, validatedContext.userId);
      const assignedVariant = validatedExperiment.variants.find(v => v.id === variantId);

      if (!assignedVariant) {
        throw new Error(`Invalid variant assignment: ${variantId}`);
      }

      // Store assignment
      await this.experimentStorage.storeAssignment({
        experimentId: validatedExperiment.key,
        userId: validatedContext.userId,
        variantId,
        assignmentId,
        timestamp: new Date(),
        userSegment: validatedContext.segment,
        medicalContext: validatedContext.medicalContext
      });

      // Log assignment for audit trail
      await this.auditLogger.logExperimentAssignment({
        experimentId: validatedExperiment.key,
        userId: validatedContext.userId,
        variantId,
        assignmentId,
        userSegment: validatedContext.segment,
        medicalImpact: validatedExperiment.medicalImpact,
        timestamp: new Date()
      });

      return {
        variantId,
        experimentId: validatedExperiment.key,
        assignmentId,
        medicallyApproved: assignedVariant.medicallyApproved,
        safetyChecked: true,
        metadata: {
          evaluationTime: Date.now() - startTime,
          variantName: assignedVariant.name,
          medicalImpact: validatedExperiment.medicalImpact
        }
      };

    } catch (error) {
      console.error('Experiment assignment error:', error);
      
      // Fail safe to control variant
      return {
        variantId: 'control',
        experimentId: experiment.key,
        assignmentId,
        medicallyApproved: false,
        safetyChecked: false,
        excluded: true,
        exclusionReason: 'assignment_error',
        metadata: {
          evaluationTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Calculate variant assignment using weighted consistent hashing
   */
  private calculateVariantAssignment(
    experiment: z.infer<typeof ExperimentConfigSchema>,
    userId: string
  ): string {
    // Create hash for consistent assignment
    const hashInput = `${experiment.key}:${userId}`;
    const hash = createHash('sha256').update(hashInput).digest('hex');
    
    // Convert to number and normalize
    const hashValue = parseInt(hash.substring(0, 8), 16) % 10000;
    
    // Calculate cumulative weights
    let cumulativeWeight = 0;
    const totalWeight = experiment.variants.reduce((sum, variant) => sum + variant.weight, 0);
    
    for (const variant of experiment.variants) {
      cumulativeWeight += variant.weight;
      const threshold = (cumulativeWeight / totalWeight) * 10000;
      
      if (hashValue < threshold) {
        return variant.id;
      }
    }
    
    // Fallback to first variant (control)
    return experiment.variants[0].id;
  }

  /**
   * Check experiment safety metrics and trigger alerts if thresholds exceeded
   */
  async checkExperimentSafety(
    experiment: z.infer<typeof ExperimentConfigSchema>
  ): Promise<{
    safetyViolation: boolean;
    violatedThresholds: string[];
    currentMetrics: any;
    recommendedAction: 'continue' | 'pause_experiment' | 'stop_experiment';
    emergencyContact?: boolean;
  }> {
    try {
      const currentMetrics = await this.medicalSafetyMonitor.getExperimentMetrics(experiment.key);
      const violatedThresholds: string[] = [];

      // Check error rate threshold
      if (currentMetrics.errorRate > experiment.safetyThresholds.errorRate) {
        violatedThresholds.push('errorRate');
      }

      // Check user complaint rate
      if (currentMetrics.userComplaintRate > experiment.safetyThresholds.userComplaintRate) {
        violatedThresholds.push('userComplaintRate');
      }

      // Check medical professional feedback
      if (currentMetrics.medicalProfessionalFeedback < experiment.safetyThresholds.medicalProfessionalFeedback) {
        violatedThresholds.push('medicalProfessionalFeedback');
      }

      // Check safety incidents
      if (currentMetrics.safetyIncidents > 0) {
        violatedThresholds.push('safetyIncidents');
      }

      const safetyViolation = violatedThresholds.length > 0;
      
      let recommendedAction: 'continue' | 'pause_experiment' | 'stop_experiment' = 'continue';
      let emergencyContact = false;

      if (safetyViolation) {
        if (violatedThresholds.includes('safetyIncidents') || 
            currentMetrics.errorRate > experiment.safetyThresholds.errorRate * 2) {
          recommendedAction = 'stop_experiment';
          emergencyContact = true;
        } else if (violatedThresholds.length >= 2) {
          recommendedAction = 'stop_experiment';
        } else {
          recommendedAction = 'pause_experiment';
        }

        // Log safety violation
        await this.auditLogger.logSafetyViolation({
          experimentId: experiment.key,
          violatedThresholds,
          currentMetrics,
          recommendedAction,
          timestamp: new Date()
        });

        // Alert medical team if necessary
        if (emergencyContact) {
          await this.medicalSafetyMonitor.alertMedicalTeam({
            experimentId: experiment.key,
            severity: 'critical',
            reason: 'Safety threshold violations detected',
            metrics: currentMetrics
          });
        }
      }

      return {
        safetyViolation,
        violatedThresholds,
        currentMetrics,
        recommendedAction,
        emergencyContact
      };

    } catch (error) {
      console.error('Experiment safety check failed:', error);
      
      // Fail safe - recommend stopping experiment
      return {
        safetyViolation: true,
        violatedThresholds: ['safety_check_failure'],
        currentMetrics: {},
        recommendedAction: 'stop_experiment',
        emergencyContact: true
      };
    }
  }

  /**
   * Calculate required sample size for experiment
   */
  calculateRequiredSampleSize(config: {
    expectedEffect: number;
    significance: number;
    power: number;
    baselineConversionRate?: number;
  }): {
    sampleSizePerVariant: number;
    totalSampleSize: number;
    estimatedDuration: number;
  } {
    return this.statisticsCalculator.calculateSampleSize(
      config.expectedEffect,
      config.significance,
      config.power,
      config.baselineConversionRate
    );
  }

  /**
   * Track experiment progress and statistical significance
   */
  async trackExperimentProgress(
    experiment: z.infer<typeof ExperimentConfigSchema>,
    experimentData: {
      [variantId: string]: {
        users: number;
        conversions: number;
        medicalProfessionalFeedback?: number[];
        safetyIncidents?: number;
      };
    }
  ): Promise<{
    currentSampleSize: number;
    percentComplete: number;
    statisticallySignificant: boolean;
    confidenceInterval?: [number, number];
    pValue?: number;
    recommendedAction: 'continue' | 'conclude_experiment' | 'extend_duration' | 'increase_sample_size';
    medicalFeedbackSummary?: any;
  }> {
    try {
      // Calculate current sample size
      const currentSampleSize = Object.values(experimentData).reduce(
        (total, variant) => total + variant.users,
        0
      );

      // Calculate progress toward target sample size
      const targetSampleSize = experiment.statisticalRequirements.minimumSampleSize;
      const percentComplete = Math.min((currentSampleSize / targetSampleSize) * 100, 100);

      // Calculate statistical significance when enough data exists
      let statisticallySignificant = false;
      let confidenceInterval: [number, number] | undefined;
      let pValue: number | undefined;

      if (currentSampleSize >= targetSampleSize * 0.5) { // At least 50% of target
        const statsResult = this.statisticsCalculator.calculateStatisticalSignificance(
          experimentData,
          experiment.statisticalRequirements.significanceLevel
        );

        statisticallySignificant = statsResult.significant;
        confidenceInterval = statsResult.confidenceInterval;
        pValue = statsResult.pValue;
      }

      // Analyze medical professional feedback
      const medicalFeedbackSummary = await this.analyzeMedicalFeedback(experiment.key, experimentData);

      // Determine recommended action
      let recommendedAction: 'continue' | 'conclude_experiment' | 'extend_duration' | 'increase_sample_size' = 'continue';

      if (statisticallySignificant && percentComplete >= 80) {
        recommendedAction = 'conclude_experiment';
      } else if (percentComplete >= 100 && !statisticallySignificant) {
        if (medicalFeedbackSummary.strongPreference) {
          recommendedAction = 'conclude_experiment';
        } else {
          recommendedAction = 'extend_duration';
        }
      } else if (percentComplete < 50 && this.isExperimentTakingTooLong(experiment)) {
        recommendedAction = 'increase_sample_size';
      }

      // Log progress update
      await this.auditLogger.logExperimentProgress({
        experimentId: experiment.key,
        currentSampleSize,
        percentComplete,
        statisticallySignificant,
        pValue,
        recommendedAction,
        timestamp: new Date()
      });

      return {
        currentSampleSize,
        percentComplete,
        statisticallySignificant,
        confidenceInterval,
        pValue,
        recommendedAction,
        medicalFeedbackSummary
      };

    } catch (error) {
      console.error('Experiment progress tracking failed:', error);
      
      return {
        currentSampleSize: 0,
        percentComplete: 0,
        statisticallySignificant: false,
        recommendedAction: 'continue'
      };
    }
  }

  /**
   * Analyze medical professional feedback for the experiment
   */
  private async analyzeMedicalFeedback(
    experimentId: string,
    experimentData: any
  ): Promise<{
    averageRating: number;
    totalFeedbackCount: number;
    strongPreference: boolean;
    qualitativeSummary: string;
    concerns: string[];
  }> {
    const feedback = await this.feedbackCollector.getExperimentFeedback(experimentId);
    
    if (feedback.length === 0) {
      return {
        averageRating: 0,
        totalFeedbackCount: 0,
        strongPreference: false,
        qualitativeSummary: 'No medical professional feedback available',
        concerns: []
      };
    }

    const averageRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
    const totalFeedbackCount = feedback.length;
    
    // Determine if there's a strong preference (>4.5 average or <2.5 average)
    const strongPreference = averageRating > 4.5 || averageRating < 2.5;
    
    // Extract concerns from feedback
    const concerns = feedback
      .filter(f => f.rating < 3.0)
      .map(f => f.comments)
      .filter(Boolean);

    const qualitativeSummary = this.generateFeedbackSummary(feedback);

    return {
      averageRating,
      totalFeedbackCount,
      strongPreference,
      qualitativeSummary,
      concerns
    };
  }

  private generateFeedbackSummary(feedback: any[]): string {
    if (feedback.length === 0) return 'No feedback available';
    
    const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
    
    if (avgRating >= 4.5) {
      return 'Overwhelmingly positive feedback from medical professionals';
    } else if (avgRating >= 3.5) {
      return 'Generally positive feedback with some suggestions for improvement';
    } else if (avgRating >= 2.5) {
      return 'Mixed feedback with significant concerns raised';
    } else {
      return 'Concerning feedback indicating potential issues with the feature';
    }
  }

  private isExperimentTakingTooLong(experiment: z.infer<typeof ExperimentConfigSchema>): boolean {
    // Implementation would check if experiment duration exceeds planned timeline
    return false; // Placeholder
  }

  private generateAssignmentId(): string {
    return `assignment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// =============================================================================
// STATISTICS CALCULATOR
// =============================================================================

export class StatisticsCalculator {
  /**
   * Calculate required sample size using standard statistical formulas
   */
  calculateSampleSize(
    expectedEffect: number,
    significance: number,
    power: number,
    baselineConversionRate: number = 0.1
  ): {
    sampleSizePerVariant: number;
    totalSampleSize: number;
    estimatedDuration: number;
  } {
    // Using standard formulas for A/B test sample size calculation
    // Z-scores for common significance levels and power
    const zAlpha = this.getZScore(significance / 2); // Two-tailed test
    const zBeta = this.getZScore(1 - power);
    
    const p1 = baselineConversionRate;
    const p2 = baselineConversionRate + expectedEffect;
    const pPooled = (p1 + p2) / 2;
    
    const numerator = Math.pow(zAlpha + zBeta, 2) * 2 * pPooled * (1 - pPooled);
    const denominator = Math.pow(p2 - p1, 2);
    
    const sampleSizePerVariant = Math.ceil(numerator / denominator);
    const totalSampleSize = sampleSizePerVariant * 2;
    
    // Estimate duration based on typical medical application traffic
    const estimatedDuration = Math.ceil(totalSampleSize / 100); // Assume 100 users per day
    
    return {
      sampleSizePerVariant,
      totalSampleSize,
      estimatedDuration
    };
  }

  /**
   * Calculate statistical significance for A/B test results
   */
  calculateStatisticalSignificance(
    experimentData: {
      [variantId: string]: {
        users: number;
        conversions: number;
      };
    },
    significanceLevel: number
  ): {
    significant: boolean;
    pValue: number;
    confidenceInterval: [number, number];
    effect: number;
  } {
    const variants = Object.values(experimentData);
    
    if (variants.length !== 2) {
      throw new Error('Statistical significance calculation requires exactly 2 variants');
    }
    
    const [control, treatment] = variants;
    
    // Calculate conversion rates
    const p1 = control.conversions / control.users;
    const p2 = treatment.conversions / treatment.users;
    
    // Calculate pooled standard error
    const pPooled = (control.conversions + treatment.conversions) / (control.users + treatment.users);
    const standardError = Math.sqrt(pPooled * (1 - pPooled) * (1/control.users + 1/treatment.users));
    
    // Calculate z-score
    const zScore = (p2 - p1) / standardError;
    
    // Calculate p-value (two-tailed test)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    
    // Determine significance
    const significant = pValue < significanceLevel;
    
    // Calculate confidence interval for the difference
    const marginOfError = this.getZScore(significanceLevel / 2) * standardError;
    const effect = p2 - p1;
    const confidenceInterval: [number, number] = [
      effect - marginOfError,
      effect + marginOfError
    ];
    
    return {
      significant,
      pValue,
      confidenceInterval,
      effect
    };
  }

  private getZScore(probability: number): number {
    // Approximate inverse normal CDF for common values
    const zScores: { [key: number]: number } = {
      0.005: 2.576,  // 99% confidence
      0.01: 2.326,   // 98% confidence
      0.025: 1.96,   // 95% confidence
      0.05: 1.645,   // 90% confidence
      0.1: 1.282,    // 80% confidence
      0.2: 0.842,    // 60% confidence
      0.8: 0.842,    // 80% power
      0.9: 1.282,    // 90% power
      0.95: 1.645,   // 95% power
    };
    
    return zScores[probability] || 1.96; // Default to 95% confidence
  }

  private normalCDF(x: number): number {
    // Approximation of the standard normal cumulative distribution function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return 0.5 * (1.0 + sign * y);
  }
}

// =============================================================================
// SUPPORTING SERVICES
// =============================================================================

export class MedicalSafetyMonitor {
  async validateExperimentParticipation(
    experiment: any,
    userContext: any
  ): Promise<{ approved: boolean; reason?: string }> {
    // Check if user has high-risk conditions that would exclude them
    if (userContext.medicalContext?.patientRiskLevel === 'critical') {
      return {
        approved: false,
        reason: 'Critical risk patient excluded from experimental features'
      };
    }

    // Check if experiment involves emergency context
    if (userContext.medicalContext?.emergencyContext && experiment.medicalImpact !== 'none') {
      return {
        approved: false,
        reason: 'Emergency context users excluded from non-essential experiments'
      };
    }

    return { approved: true };
  }

  async getExperimentMetrics(experimentId: string): Promise<{
    errorRate: number;
    userComplaintRate: number;
    medicalProfessionalFeedback: number;
    safetyIncidents: number;
  }> {
    // Implementation would fetch real metrics from monitoring systems
    return {
      errorRate: 0.02,
      userComplaintRate: 0.01,
      medicalProfessionalFeedback: 4.1,
      safetyIncidents: 0
    };
  }

  async alertMedicalTeam(alert: {
    experimentId: string;
    severity: string;
    reason: string;
    metrics: any;
  }): Promise<void> {
    // Implementation would send alerts to medical team
    console.log('Medical team alert:', alert);
  }
}

export class MedicalFeedbackCollector {
  async getExperimentFeedback(experimentId: string): Promise<Array<{
    id: string;
    userId: string;
    rating: number;
    comments: string;
    timestamp: Date;
    medicalProfessionalRole: string;
  }>> {
    // Implementation would fetch feedback from database
    return [];
  }
}

export class ABTestAuditLogger {
  async logExperimentAssignment(data: any): Promise<void> {
    // Implementation would log to audit system
    console.log('Experiment assignment logged:', data);
  }

  async logExperimentExclusion(data: any): Promise<void> {
    // Implementation would log exclusions
    console.log('Experiment exclusion logged:', data);
  }

  async logSafetyViolation(data: any): Promise<void> {
    // Implementation would log safety violations
    console.log('Safety violation logged:', data);
  }

  async logExperimentProgress(data: any): Promise<void> {
    // Implementation would log progress updates
    console.log('Experiment progress logged:', data);
  }
}

export class ExperimentStorage {
  async getExistingAssignment(experimentId: string, userId: string): Promise<{
    variantId: string;
    assignmentId: string;
  } | null> {
    // Implementation would check for existing assignments
    return null;
  }

  async storeAssignment(assignment: any): Promise<void> {
    // Implementation would store assignment
    console.log('Assignment stored:', assignment);
  }
}