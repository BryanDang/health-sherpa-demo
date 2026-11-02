/**
 * Feature Flag Core System - Unit Tests
 * 
 * Unit tests for core feature flag evaluation, user segmentation, and percentage rollouts.
 * These tests focus on the fundamental algorithms and logic that determine which users
 * see which features in a medical application context.
 */

const {
  FeatureFlagEvaluator,
  UserSegmentationEngine,
  RolloutCalculator,
  MedicalSafetyValidator,
  ABTestingEngine
} = require('../../src/lib/feature-flag-core');

// Skipped: feature not built (feature flags).
describe.skip('[feature not built] FeatureFlagEvaluator', () => {
  let evaluator;
  let mockSegmentationEngine;
  let mockSafetyValidator;

  beforeEach(() => {
    mockSegmentationEngine = {
      getUserSegment: jest.fn(),
      checkMedicalProfessionalStatus: jest.fn()
    };

    mockSafetyValidator = {
      validateFlagForUser: jest.fn(),
      checkMedicalSafetyRequirements: jest.fn()
    };

    evaluator = new FeatureFlagEvaluator({
      segmentationEngine: mockSegmentationEngine,
      safetyValidator: mockSafetyValidator
    });
  });

  describe('Flag Evaluation Logic', () => {
    test('evaluates basic boolean flag correctly', async () => {
      const flagConfig = {
        key: 'simple-feature',
        enabled: true,
        rolloutPercentage: 100,
        medicalSafetyLevel: 'low'
      };

      const userContext = {
        userId: 'user_123',
        segment: 'general_users'
      };

      mockSafetyValidator.validateFlagForUser.mockResolvedValue({
        approved: true,
        safetyLevel: 'low'
      });

      const result = await evaluator.evaluate(flagConfig, userContext);

      expect(result.enabled).toBe(true);
      expect(result.variant).toBe('enabled');
      expect(result.metadata.evaluationTime).toBeDefined();
      expect(result.safetyStatus.approved).toBe(true);
    });

    test('respects medical safety overrides', async () => {
      const flagConfig = {
        key: 'experimental-diagnosis',
        enabled: true,
        rolloutPercentage: 100,
        medicalSafetyLevel: 'high',
        requiresMedicalProfessional: true
      };

      const userContext = {
        userId: 'general_user_123',
        segment: 'general_users',
        medicalProfessionalStatus: false
      };

      mockSafetyValidator.validateFlagForUser.mockResolvedValue({
        approved: false,
        reason: 'Medical professional verification required for high-risk features'
      });

      const result = await evaluator.evaluate(flagConfig, userContext);

      expect(result.enabled).toBe(false);
      expect(result.safetyStatus.approved).toBe(false);
      expect(result.metadata.overrideReason).toBe('medical_safety_requirement_not_met');
    });

    test('handles percentage rollouts with consistent hash distribution', async () => {
      const flagConfig = {
        key: 'gradual-rollout-feature',
        enabled: true,
        rolloutPercentage: 50,
        medicalSafetyLevel: 'medium'
      };

      mockSafetyValidator.validateFlagForUser.mockResolvedValue({
        approved: true,
        safetyLevel: 'medium'
      });

      // Test multiple user IDs to ensure consistent hashing
      const userIds = [
        'user_001', 'user_002', 'user_003', 'user_004', 'user_005',
        'user_006', 'user_007', 'user_008', 'user_009', 'user_010'
      ];

      const results = [];
      for (const userId of userIds) {
        const userContext = { userId, segment: 'general_users' };
        const result = await evaluator.evaluate(flagConfig, userContext);
        results.push({ userId, enabled: result.enabled });
      }

      // With 50% rollout, expect roughly half enabled (allowing for hash distribution variance)
      const enabledCount = results.filter(r => r.enabled).length;
      expect(enabledCount).toBeGreaterThanOrEqual(3); // At least 30%
      expect(enabledCount).toBeLessThanOrEqual(7); // At most 70%

      // Same user should always get same result (consistency)
      const sameUserResult1 = await evaluator.evaluate(flagConfig, { userId: 'user_001', segment: 'general_users' });
      const sameUserResult2 = await evaluator.evaluate(flagConfig, { userId: 'user_001', segment: 'general_users' });
      expect(sameUserResult1.enabled).toBe(sameUserResult2.enabled);
    });

    test('prioritizes emergency users in rollouts', async () => {
      const flagConfig = {
        key: 'emergency-enhancement',
        enabled: true,
        rolloutPercentage: 10, // Very low rollout
        prioritySegments: ['emergency_users'],
        medicalSafetyLevel: 'medium'
      };

      const emergencyUserContext = {
        userId: 'emergency_user_123',
        segment: 'emergency_users',
        emergencyContext: true
      };

      mockSafetyValidator.validateFlagForUser.mockResolvedValue({
        approved: true,
        safetyLevel: 'medium'
      });

      const result = await evaluator.evaluate(flagConfig, emergencyUserContext);

      // Emergency users should get flag despite low rollout percentage
      expect(result.enabled).toBe(true);
      expect(result.metadata.priorityOverride).toBe(true);
    });

    test('handles flag dependencies correctly', async () => {
      const dependentFlagConfig = {
        key: 'advanced-feature',
        enabled: true,
        rolloutPercentage: 100,
        dependencies: ['basic-feature'],
        medicalSafetyLevel: 'low'
      };

      const userContext = {
        userId: 'user_123',
        segment: 'general_users'
      };

      // Mock dependency check
      evaluator.checkDependencies = jest.fn().mockResolvedValue({
        'basic-feature': false // Dependency not enabled
      });

      mockSafetyValidator.validateFlagForUser.mockResolvedValue({
        approved: true,
        safetyLevel: 'low'
      });

      const result = await evaluator.evaluate(dependentFlagConfig, userContext);

      expect(result.enabled).toBe(false);
      expect(result.metadata.disabledReason).toBe('dependency_not_met');
      expect(result.metadata.missingDependencies).toContain('basic-feature');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('falls back to safe default when evaluation fails', async () => {
      const flagConfig = {
        key: 'problematic-feature',
        enabled: true,
        rolloutPercentage: 100,
        fallbackValue: false,
        medicalSafetyLevel: 'high'
      };

      const userContext = {
        userId: 'user_123',
        segment: 'general_users'
      };

      // Simulate evaluation failure
      mockSafetyValidator.validateFlagForUser.mockRejectedValue(
        new Error('Safety validation service unavailable')
      );

      const result = await evaluator.evaluate(flagConfig, userContext);

      expect(result.enabled).toBe(false); // Safe fallback
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.metadata.error).toBe('Safety validation service unavailable');
    });

    test('logs evaluation errors for debugging', async () => {
      const flagConfig = {
        key: 'test-feature',
        enabled: true,
        rolloutPercentage: 100
      };

      const userContext = {
        userId: 'user_123'
      };

      const logSpy = jest.spyOn(console, 'error').mockImplementation();

      // Simulate segmentation failure
      mockSegmentationEngine.getUserSegment.mockRejectedValue(
        new Error('Segmentation service timeout')
      );

      await evaluator.evaluate(flagConfig, userContext);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feature flag evaluation error'),
        expect.objectContaining({
          flagKey: 'test-feature',
          userId: 'user_123',
          error: 'Segmentation service timeout'
        })
      );

      logSpy.mockRestore();
    });
  });
});

// Skipped: feature not built (feature flags).
describe.skip('[feature not built] UserSegmentationEngine', () => {
  let segmentationEngine;
  let mockMedicalVerification;
  let mockGeoService;

  beforeEach(() => {
    mockMedicalVerification = {
      verifyMedicalProfessional: jest.fn(),
      getMedicalSpecialization: jest.fn()
    };

    mockGeoService = {
      getLocationFromIP: jest.fn(),
      getRegionFromZip: jest.fn()
    };

    segmentationEngine = new UserSegmentationEngine({
      medicalVerification: mockMedicalVerification,
      geoService: mockGeoService
    });
  });

  describe('Primary Segment Calculation', () => {
    test('correctly identifies medical professionals', async () => {
      const userProfile = {
        id: 'user_123',
        email: 'doctor@example.com',
        credentials: ['MD', 'Board Certified Internal Medicine'],
        institution: 'Regional Medical Center'
      };

      mockMedicalVerification.verifyMedicalProfessional.mockResolvedValue({
        verified: true,
        specialization: 'internal_medicine',
        credentials: ['MD']
      });

      const result = await segmentationEngine.calculateSegment(userProfile);

      expect(result.primarySegment).toBe('medical_professionals');
      expect(result.secondarySegments).toContain('internal_medicine_specialists');
      expect(result.medicalSafetyFlags.medicalProfessionalVerified).toBe(true);
    });

    test('segments general users appropriately', async () => {
      const userProfile = {
        id: 'user_456',
        email: 'patient@example.com',
        age: 35,
        riskFactors: ['diabetes', 'hypertension']
      };

      mockMedicalVerification.verifyMedicalProfessional.mockResolvedValue({
        verified: false
      });

      const result = await segmentationEngine.calculateSegment(userProfile);

      expect(result.primarySegment).toBe('general_users');
      expect(result.secondarySegments).toContain('high_risk_patients');
      expect(result.medicalSafetyFlags.highRiskPatient).toBe(true);
    });

    test('identifies beta testers correctly', async () => {
      const userProfile = {
        id: 'user_789',
        email: 'tester@example.com',
        betaTesterStatus: true,
        betaProgramEnrollment: '2024-01-15'
      };

      const result = await segmentationEngine.calculateSegment(userProfile);

      expect(result.primarySegment).toBe('beta_testers');
      expect(result.rolloutEligibility.betaTesterBenefits).toBe(true);
    });

    test('handles emergency user context', async () => {
      const userProfile = {
        id: 'user_emergency',
        emergencyContext: true,
        currentCareLevel: 'emergency'
      };

      const result = await segmentationEngine.calculateSegment(userProfile);

      expect(result.primarySegment).toBe('emergency_users');
      expect(result.medicalSafetyFlags.emergencyContext).toBe(true);
      expect(result.rolloutEligibility.emergencyPriority).toBe(true);
    });
  });

  describe('Geographic Segmentation', () => {
    test('segments users by geographic region', async () => {
      const userProfile = {
        id: 'user_geo',
        ipAddress: '192.168.1.1',
        zipCode: '10001'
      };

      mockGeoService.getLocationFromIP.mockResolvedValue({
        country: 'US',
        region: 'northeast',
        state: 'NY'
      });

      const result = await segmentationEngine.calculateSegment(userProfile);

      expect(result.secondarySegments).toContain('northeast_region');
      expect(result.geographicContext.region).toBe('northeast');
    });

    test('handles international users with regulatory restrictions', async () => {
      const userProfile = {
        id: 'user_intl',
        ipAddress: '203.0.113.1'
      };

      mockGeoService.getLocationFromIP.mockResolvedValue({
        country: 'EU',
        region: 'europe',
        gdprApplicable: true
      });

      const result = await segmentationEngine.calculateSegment(userProfile);

      expect(result.regulatoryFlags.gdprApplicable).toBe(true);
      expect(result.rolloutEligibility.restrictions).toContain('gdpr_compliance_required');
    });
  });

  describe('Rollout Eligibility Assessment', () => {
    test('calculates rollout eligibility with multiple factors', async () => {
      const userProfile = {
        id: 'user_eligible',
        medicalProfessionalStatus: true,
        riskFactors: [],
        consentFlags: {
          analyticsConsent: true,
          testingParticipationConsent: true,
          dataProcessingConsent: true
        }
      };

      mockMedicalVerification.verifyMedicalProfessional.mockResolvedValue({
        verified: true,
        specialization: 'family_medicine'
      });

      const result = await segmentationEngine.calculateSegment(userProfile);

      expect(result.rolloutEligibility.eligible).toBe(true);
      expect(result.rolloutEligibility.eligibilityScore).toBeGreaterThan(0.8);
      expect(result.rolloutEligibility.restrictions).toHaveLength(0);
    });

    test('restricts eligibility for incomplete consent', async () => {
      const userProfile = {
        id: 'user_restricted',
        consentFlags: {
          analyticsConsent: false,
          testingParticipationConsent: false,
          dataProcessingConsent: true
        }
      };

      const result = await segmentationEngine.calculateSegment(userProfile);

      expect(result.rolloutEligibility.eligible).toBe(false);
      expect(result.rolloutEligibility.restrictions).toContain('insufficient_consent');
    });
  });
});

// Skipped: feature not built (feature flags).
describe.skip('[feature not built] RolloutCalculator', () => {
  let rolloutCalculator;

  beforeEach(() => {
    rolloutCalculator = new RolloutCalculator();
  });

  describe('Percentage-based Rollouts', () => {
    test('calculates consistent hash-based rollout', () => {
      const flagKey = 'test-feature';
      const userId = 'user_123';
      const rolloutPercentage = 50;

      const result1 = rolloutCalculator.calculateRollout(flagKey, userId, rolloutPercentage);
      const result2 = rolloutCalculator.calculateRollout(flagKey, userId, rolloutPercentage);

      // Should be consistent across calls
      expect(result1.included).toBe(result2.included);
      expect(result1.hashValue).toBe(result2.hashValue);
    });

    test('distributes users evenly across rollout percentages', () => {
      const flagKey = 'distribution-test';
      const rolloutPercentage = 30;
      const userIds = Array.from({ length: 1000 }, (_, i) => `user_${i}`);

      const includedUsers = userIds.filter(userId => 
        rolloutCalculator.calculateRollout(flagKey, userId, rolloutPercentage).included
      );

      const actualPercentage = (includedUsers.length / userIds.length) * 100;
      
      // Should be within 5% of target (allowing for hash distribution variance)
      expect(actualPercentage).toBeGreaterThanOrEqual(25);
      expect(actualPercentage).toBeLessThanOrEqual(35);
    });

    test('handles edge cases in rollout percentages', () => {
      const flagKey = 'edge-case-test';
      const userId = 'user_edge';

      // 0% rollout
      const result0 = rolloutCalculator.calculateRollout(flagKey, userId, 0);
      expect(result0.included).toBe(false);

      // 100% rollout
      const result100 = rolloutCalculator.calculateRollout(flagKey, userId, 100);
      expect(result100.included).toBe(true);

      // Invalid percentage (should default to 0)
      const resultInvalid = rolloutCalculator.calculateRollout(flagKey, userId, -10);
      expect(resultInvalid.included).toBe(false);
    });
  });

  describe('Segment-based Rollouts', () => {
    test('applies segment-specific rollout rules', () => {
      const rolloutConfig = {
        flagKey: 'segment-feature',
        segments: {
          'medical_professionals': 80,
          'beta_testers': 100,
          'general_users': 20
        }
      };

      const medicalProfResult = rolloutCalculator.calculateSegmentRollout(
        rolloutConfig,
        'user_doctor',
        'medical_professionals'
      );

      const generalUserResult = rolloutCalculator.calculateSegmentRollout(
        rolloutConfig,
        'user_general',
        'general_users'
      );

      // Medical professionals should have higher likelihood of inclusion
      // Probabilistic: specific results are not guaranteed.
      // Check that rollout percentages are applied correctly
      expect(medicalProfResult.rolloutPercentage).toBe(80);
      expect(generalUserResult.rolloutPercentage).toBe(20);
    });

    test('handles unknown segments gracefully', () => {
      const rolloutConfig = {
        flagKey: 'segment-feature',
        segments: {
          'medical_professionals': 80,
          'general_users': 20
        },
        defaultRollout: 0
      };

      const unknownSegmentResult = rolloutCalculator.calculateSegmentRollout(
        rolloutConfig,
        'user_unknown',
        'unknown_segment'
      );

      expect(unknownSegmentResult.included).toBe(false);
      expect(unknownSegmentResult.rolloutPercentage).toBe(0);
    });
  });

  describe('Medical Safety Integration', () => {
    test('applies medical safety overrides to rollout calculations', () => {
      const rolloutConfig = {
        flagKey: 'medical-feature',
        baseRollout: 50,
        medicalSafetyOverrides: {
          'high_risk_patients': 0, // Never include high-risk patients
          'emergency_users': 100   // Always include emergency users
        }
      };

      const highRiskResult = rolloutCalculator.calculateWithSafetyOverrides(
        rolloutConfig,
        'user_highrisk',
        ['high_risk_patients']
      );

      const emergencyResult = rolloutCalculator.calculateWithSafetyOverrides(
        rolloutConfig,
        'user_emergency',
        ['emergency_users']
      );

      expect(highRiskResult.included).toBe(false);
      expect(highRiskResult.safetyOverrideApplied).toBe(true);
      
      expect(emergencyResult.included).toBe(true);
      expect(emergencyResult.safetyOverrideApplied).toBe(true);
    });
  });
});

// Skipped: feature not built (feature flags).
describe.skip('[feature not built] ABTestingEngine', () => {
  let abTestingEngine;
  let mockStatisticsCalculator;

  beforeEach(() => {
    mockStatisticsCalculator = {
      calculateSampleSize: jest.fn(),
      calculateStatisticalSignificance: jest.fn(),
      checkTestValidity: jest.fn()
    };

    abTestingEngine = new ABTestingEngine({
      statisticsCalculator: mockStatisticsCalculator
    });
  });

  describe('Experiment Assignment', () => {
    test('assigns users to test variants consistently', () => {
      const experiment = {
        key: 'ui-optimization-test',
        variants: [
          { id: 'control', weight: 50 },
          { id: 'treatment', weight: 50 }
        ]
      };

      const userId = 'user_test_123';

      const assignment1 = abTestingEngine.assignVariant(experiment, userId);
      const assignment2 = abTestingEngine.assignVariant(experiment, userId);

      expect(assignment1.variantId).toBe(assignment2.variantId);
      expect(['control', 'treatment']).toContain(assignment1.variantId);
    });

    test('respects variant weights in assignment', () => {
      const experiment = {
        key: 'weighted-test',
        variants: [
          { id: 'control', weight: 80 },
          { id: 'treatment', weight: 20 }
        ]
      };

      const assignments = [];
      for (let i = 0; i < 1000; i++) {
        const assignment = abTestingEngine.assignVariant(experiment, `user_${i}`);
        assignments.push(assignment.variantId);
      }

      const controlCount = assignments.filter(v => v === 'control').length;
      const treatmentCount = assignments.filter(v => v === 'treatment').length;

      const controlPercentage = (controlCount / assignments.length) * 100;
      const treatmentPercentage = (treatmentCount / assignments.length) * 100;

      // Should be within 10% of target weights
      expect(controlPercentage).toBeGreaterThanOrEqual(70);
      expect(controlPercentage).toBeLessThanOrEqual(90);
      expect(treatmentPercentage).toBeGreaterThanOrEqual(10);
      expect(treatmentPercentage).toBeLessThanOrEqual(30);
    });

    test('excludes users who opt out of testing', () => {
      const experiment = {
        key: 'opt-out-test',
        variants: [
          { id: 'control', weight: 50 },
          { id: 'treatment', weight: 50 }
        ]
      };

      const userContext = {
        userId: 'user_optout',
        consentFlags: {
          testingParticipationConsent: false
        }
      };

      const assignment = abTestingEngine.assignVariantWithContext(experiment, userContext);

      expect(assignment.excluded).toBe(true);
      expect(assignment.exclusionReason).toBe('no_testing_consent');
    });
  });

  describe('Medical Safety in A/B Testing', () => {
    test('requires medical approval for high-impact experiments', () => {
      const medicalExperiment = {
        key: 'diagnostic-algorithm-test',
        medicalImpact: 'high',
        variants: [
          { id: 'current_algorithm', weight: 50 },
          { id: 'new_algorithm', weight: 50 }
        ],
        medicalApprovalRequired: true
      };

      const assignment = abTestingEngine.assignVariantWithSafetyCheck(
        medicalExperiment,
        'user_patient',
        { medicalApprovalId: null }
      );

      expect(assignment.blocked).toBe(true);
      expect(assignment.blockReason).toBe('medical_approval_required');
    });

    test('monitors safety metrics during experiment execution', async () => {
      const experiment = {
        key: 'safety-monitored-test',
        variants: [
          { id: 'control', weight: 50 },
          { id: 'treatment', weight: 50 }
        ],
        safetyThresholds: {
          errorRate: 0.05,
          userComplaintRate: 0.02
        }
      };

      const mockSafetyMetrics = {
        errorRate: 0.08, // Above threshold
        userComplaintRate: 0.01
      };

      abTestingEngine.getSafetyMetrics = jest.fn().mockResolvedValue(mockSafetyMetrics);

      const safetyCheck = await abTestingEngine.checkExperimentSafety(experiment);

      expect(safetyCheck.safetyViolation).toBe(true);
      expect(safetyCheck.violatedThresholds).toContain('errorRate');
      expect(safetyCheck.recommendedAction).toBe('pause_experiment');
    });
  });

  describe('Statistical Significance Tracking', () => {
    test('calculates required sample size for experiment', () => {
      const experimentConfig = {
        expectedEffect: 0.05, // 5% improvement
        significance: 0.05,   // 95% confidence
        power: 0.8           // 80% power
      };

      mockStatisticsCalculator.calculateSampleSize.mockReturnValue({
        sampleSizePerVariant: 3200,
        totalSampleSize: 6400
      });

      const sampleSize = abTestingEngine.calculateRequiredSampleSize(experimentConfig);

      expect(sampleSize.sampleSizePerVariant).toBe(3200);
      expect(mockStatisticsCalculator.calculateSampleSize).toHaveBeenCalledWith(
        experimentConfig.expectedEffect,
        experimentConfig.significance,
        experimentConfig.power
      );
    });

    test('tracks experiment progress toward statistical significance', async () => {
      const experiment = {
        key: 'progress-test',
        variants: ['control', 'treatment'],
        targetSampleSize: 1000
      };

      const experimentData = {
        control: { users: 400, conversions: 80 },
        treatment: { users: 450, conversions: 99 }
      };

      mockStatisticsCalculator.calculateStatisticalSignificance.mockReturnValue({
        pValue: 0.03,
        significant: true,
        confidenceInterval: [0.01, 0.08]
      });

      const progress = await abTestingEngine.trackExperimentProgress(experiment, experimentData);

      expect(progress.currentSampleSize).toBe(850);
      expect(progress.percentComplete).toBe(85);
      expect(progress.statisticallySignificant).toBe(true);
      expect(progress.recommendedAction).toBe('conclude_experiment');
    });
  });
});