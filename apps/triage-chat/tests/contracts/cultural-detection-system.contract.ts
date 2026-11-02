/**
 * Contract Definition: Cultural Detection & Personality Adaptation System
 *
 * Defines input/output contracts, side effects, and failure modes for
 * cultural competency and personality adaptation in healthcare triage
 */

export interface CulturalDetectionContract {
  componentName: 'CulturalDetectionSystem';

  inputs: {
    conversationHistory: {
      type: 'ConversationMessage[]';
      required: true;
      description: 'Array of user messages and AI responses for cultural pattern analysis';
      validation: {
        minLength: 1;
        maxLength: 50;
        messageValidation: {
          content: 'string (required, 1-2000 chars)';
          timestamp: 'ISO 8601 string (required)';
          role: 'user | assistant (required)';
          metadata?: 'Record<string, any> (optional)';
        };
      };
    };

    userProfile: {
      type: 'UserProfile';
      required: false;
      description: 'Existing user profile data for enhancement';
      validation: {
        culturalMarkers?: 'string[] (optional cultural identifiers)';
        communicationPreferences?: 'CommunicationPreferences (optional)';
        demographicData?: 'DemographicData (optional, privacy-compliant)';
        healthBeliefs?: 'HealthBelief[] (optional cultural health practices)';
      };
    };

    detectionConfig: {
      type: 'CulturalDetectionConfig';
      required: true;
      description: 'Configuration for cultural detection algorithms';
      validation: {
        enabledDetectors: 'string[] (required: language, communication_style, health_beliefs)';
        confidenceThreshold: 'number (0.0-1.0, default: 0.7)';
        privacyLevel: 'strict | moderate | permissive (default: strict)';
        biasMonitoring: 'boolean (default: true)';
        maxCulturalMarkers: 'number (1-20, default: 10)';
      };
    };

    medicalContext: {
      type: 'MedicalContext';
      required: true;
      description: 'Current medical conversation context';
      validation: {
        symptoms: 'string[] (required)';
        urgencyLevel: 'emergency | urgent | routine (required)';
        specialtyArea: 'string (optional)';
        culturalSensitivity: 'high | medium | low (default: high)';
      };
    };
  };

  outputs: {
    culturalProfile: {
      type: 'CulturalProfile';
      description: 'Detected cultural characteristics and preferences';
      structure: {
        detectedCultures: {
          type: 'CulturalMarker[]';
          validation: {
            culture: 'string (required)';
            confidence: 'number (0.0-1.0, required)';
            evidence: 'string[] (required, cultural indicators found)';
            biasRisk: 'low | medium | high (required)';
          };
        };

        communicationStyle: {
          type: 'CommunicationStyle';
          validation: {
            directness: 'number (0.0-1.0, direct vs indirect)';
            formality: 'number (0.0-1.0, formal vs informal)';
            emotionalExpression: 'number (0.0-1.0, reserved vs expressive)';
            decisionMaking: 'individual | family | community (required)';
            timeOrientation: 'linear | flexible (required)';
          };
        };

        healthBeliefs: {
          type: 'HealthBelief[]';
          validation: {
            category: 'traditional | religious | biomedical | holistic (required)';
            description: 'string (required)';
            impact: 'high | medium | low (required)';
            accommodations: 'string[] (required, how to accommodate)';
          };
        };

        adaptationRecommendations: {
          type: 'AdaptationRecommendation[]';
          validation: {
            area: 'communication | treatment | scheduling | family_involvement (required)';
            recommendation: 'string (required)';
            priority: 'high | medium | low (required)';
            implementation: 'string (required, how to implement)';
          };
        };
      };
    };

    personalityProfile: {
      type: 'PersonalityProfile';
      description: 'Detected personality traits affecting medical communication';
      structure: {
        traits: {
          type: 'PersonalityTrait[]';
          validation: {
            trait: 'anxious | analytical | collaborative | direct | empathetic (required)';
            score: 'number (0.0-1.0, required)';
            evidence: 'string[] (required)';
            communicationImpact: 'string (required)';
          };
        };

        preferredCommunicationStyle: {
          type: 'PreferredCommunicationStyle';
          validation: {
            informationDepth: 'brief | moderate | detailed (required)';
            explanationStyle: 'technical | conversational | metaphorical (required)';
            reassuranceLevel: 'minimal | moderate | high (required)';
            questioningStyle: 'direct | guided | open_ended (required)';
          };
        };

        stressIndicators: {
          type: 'StressIndicator[]';
          validation: {
            indicator: 'string (required)';
            severity: 'low | medium | high (required)';
            recommendedResponse: 'string (required)';
          };
        };
      };
    };

    adaptationStrategy: {
      type: 'AdaptationStrategy';
      description: 'Comprehensive strategy for cultural and personality adaptation';
      structure: {
        communicationAdjustments: {
          type: 'CommunicationAdjustment[]';
          validation: {
            adjustment: 'string (required)';
            rationale: 'string (required)';
            implementation: 'immediate | gradual | conditional (required)';
          };
        };

        culturalAccommodations: {
          type: 'CulturalAccommodation[]';
          validation: {
            accommodation: 'string (required)';
            culturalBasis: 'string (required)';
            medicalImpact: 'none | low | medium | high (required)';
            alternatives: 'string[] (required if medicalImpact > low)';
          };
        };

        personalityAdaptations: {
          type: 'PersonalityAdaptation[]';
          validation: {
            adaptation: 'string (required)';
            personalityBasis: 'string (required)';
            expectedOutcome: 'string (required)';
          };
        };

        monitoringPlan: {
          type: 'MonitoringPlan';
          validation: {
            biasChecks: 'BiasCheck[] (required)';
            effectivenessMetrics: 'string[] (required)';
            feedbackMechanisms: 'string[] (required)';
            reviewFrequency: 'per_interaction | daily | weekly (required)';
          };
        };
      };
    };

    metadata: {
      type: 'CulturalDetectionMetadata';
      description: 'Processing metadata and quality metrics';
      structure: {
        processingTime: 'number (required, milliseconds)';
        confidenceScore: 'number (0.0-1.0, required)';
        biasRiskLevel: 'low | medium | high (required)';
        dataQuality: 'poor | fair | good | excellent (required)';
        recommendedActions: 'string[] (required)';
        privacyCompliance: 'boolean (required)';
        algorithmVersion: 'string (required)';
      };
    };
  };

  sideEffects: [
    'Updates user cultural profile in persistent storage',
    'Logs cultural detection events for bias monitoring',
    'Triggers bias alert if high-risk cultural assumptions detected',
    'Updates communication preference learning model',
    'Increments cultural interaction counters for analytics',
    'Stores anonymized cultural patterns for system improvement',
    'Updates cultural competency training data if user consents',
  ];

  failureModes: [
    {
      mode: 'cultural_bias_detected';
      description: 'System detects potential cultural bias in analysis';
      triggers: [
        'Confidence score for single culture > 0.95 with limited evidence',
        'Stereotypical cultural assumptions detected',
        'Cultural markers contradict user self-identification',
        'Bias monitoring algorithm flags cultural profiling',
      ];
      recovery: [
        'Fall back to culturally neutral communication',
        'Log bias incident for review',
        'Request user feedback on cultural assumptions',
        'Disable specific cultural detectors if bias confirmed',
      ];
    },

    {
      mode: 'insufficient_data';
      description: 'Not enough conversation data for reliable cultural detection';
      triggers: [
        'Conversation history < 3 messages',
        'Messages too short (< 20 words average)',
        'No cultural markers detected in conversation',
        'User explicitly requests privacy',
      ];
      recovery: [
        'Use baseline cultural competency without specific adaptations',
        'Focus on personality traits rather than cultural markers',
        'Implement progressive cultural learning over multiple sessions',
        'Provide general cultural sensitivity in communication',
      ];
    },

    {
      mode: 'privacy_violation_risk';
      description: 'Cultural detection may violate user privacy expectations';
      triggers: [
        'Sensitive cultural information detected without consent',
        'User profile contains conflicting privacy settings',
        'Cultural markers reveal protected characteristics',
        'Regulatory compliance check fails',
      ];
      recovery: [
        'Immediately halt cultural profiling',
        'Delete any sensitive cultural data collected',
        'Revert to baseline communication without cultural adaptation',
        'Obtain explicit user consent before re-enabling cultural detection',
      ];
    },

    {
      mode: 'medical_cultural_conflict';
      description: 'Detected cultural beliefs conflict with medical recommendations';
      triggers: [
        'Cultural health beliefs contradict evidence-based medicine',
        'Religious restrictions conflict with urgent medical care',
        'Traditional remedies may interact with recommended treatments',
        'Cultural decision-making process delays emergency care',
      ];
      recovery: [
        'Prioritize medical safety over cultural accommodation',
        'Provide culturally sensitive explanation of medical necessity',
        'Offer alternative approaches that respect cultural beliefs',
        'Escalate to human healthcare provider if conflict unresolvable',
      ];
    },

    {
      mode: 'system_performance_degradation';
      description: 'Cultural detection system performance below acceptable thresholds';
      triggers: [
        'Processing time > 5 seconds',
        'Confidence scores consistently < 0.5',
        'Bias detection false positive rate > 20%',
        'Cultural accuracy validation fails',
      ];
      recovery: [
        'Fall back to simplified cultural detection',
        'Use cached cultural profiles if available',
        'Implement graceful degradation to personality-only adaptation',
        'Alert system administrators for performance optimization',
      ];
    },
  ];

  dependencies: [
    'Google Gemini API (gemini-2.5-flash or gemini-2.5-pro for cultural analysis)',
    'User profile storage system (Zustand store with persistence)',
    'Bias monitoring service (internal algorithm + external validation)',
    'Privacy compliance validator (GDPR, HIPAA, cultural data protection)',
    'Cultural competency knowledge base (healthcare-specific cultural frameworks)',
    'Natural language processing pipeline (for cultural marker extraction)',
    'Conversation history management system',
    'Medical context analyzer (for cultural-medical conflict detection)',
    'Performance monitoring system (for system health and bias detection)',
    'Anonymization service (for cultural pattern learning while preserving privacy)',
  ];

  integrationPoints: [
    'Triage system prompt enhancement (cultural context injection)',
    'Response generation pipeline (cultural adaptation of medical advice)',
    'User interface components (cultural preference display)',
    'Conversation flow management (cultural communication style adaptation)',
    'Medical recommendation system (cultural accommodation suggestions)',
    'Emergency protocol system (cultural sensitivity in urgent situations)',
    'Provider handoff system (cultural profile transmission)',
    'Analytics and reporting system (cultural competency metrics)',
    'Training data collection (cultural interaction learning)',
    'Quality assurance system (cultural bias prevention and detection)',
  ];

  performanceRequirements: {
    maxProcessingTime: '3000ms for cultural analysis';
    minConfidenceThreshold: '0.7 for cultural adaptations';
    maxBiasRate: '5% false positive rate for bias detection';
    culturalAccuracyTarget: '85% accuracy in cultural accommodation recommendations';
    privacyComplianceTarget: '100% compliance with cultural data protection regulations';
    systemAvailability: '99.9% uptime for cultural detection services';
    scalabilityTarget: '1000 concurrent cultural analyses';
  };

  qualityMetrics: [
    'Cultural detection accuracy (validated against user feedback)',
    'Bias detection sensitivity and specificity',
    'Cultural accommodation effectiveness (measured by user satisfaction)',
    'Privacy compliance audit results',
    'System performance metrics (latency, throughput, error rates)',
    'Medical safety maintenance (no compromise of medical recommendations)',
    'Cultural competency improvement over time',
    'User acceptance of cultural adaptations',
    'Provider satisfaction with cultural intelligence',
    'Regulatory compliance with cultural AI standards',
  ];
}

// Enhanced Medical Assessment Contract
export interface EnhancedMedicalAssessmentContract {
  componentName: 'EnhancedMedicalAssessmentSystem';

  inputs: {
    medicalInput: {
      type: 'MedicalInput';
      required: true;
      description: 'User medical information and symptoms';
      validation: {
        symptoms: 'string[] (required, 1-20 symptoms)';
        duration: 'string (required, temporal description)';
        severity: 'string (required, user-described severity)';
        additionalInfo: 'string (optional, additional context)';
        previousMedicalHistory: 'string[] (optional)';
      };
    };

    culturalContext: {
      type: 'CulturalProfile';
      required: false;
      description: 'Cultural context from cultural detection system';
    };

    personalityContext: {
      type: 'PersonalityProfile';
      required: false;
      description: 'Personality context for communication adaptation';
    };

    conversationHistory: {
      type: 'ConversationMessage[]';
      required: true;
      description: 'Previous conversation for context-aware assessment';
    };

    toolResults: {
      type: 'ToolResult[]';
      required: false;
      description: 'Results from MCP tools (pricing, provider search, etc.)';
    };
  };

  outputs: {
    medicalAssessment: {
      type: 'EnhancedMedicalAssessment';
      description: 'Comprehensive medical assessment with cultural sensitivity';
      structure: {
        emergencyLevel: 'emergency | urgent | routine (required)';
        assessment: 'string (required, culturally-adapted assessment)';
        recommendations: 'string[] (required, actionable recommendations)';
        followUpQuestions: 'string[] (required, context-aware questions)';
        redFlags: 'string[] (required, warning signs to monitor)';
        culturalConsiderations: 'string[] (optional, cultural accommodations)';
        personalityAdaptations: 'string[] (optional, communication adaptations)';
        toolIntegrations: 'ToolIntegration[] (optional, tool-enhanced recommendations)';
      };
    };

    responseStrategy: {
      type: 'ResponseStrategy';
      description: 'Strategy for delivering medical assessment';
      structure: {
        communicationStyle: 'direct | gentle | detailed | simplified (required)';
        culturalAdaptations: 'CulturalAdaptation[] (optional)';
        personalityAdaptations: 'PersonalityAdaptation[] (optional)';
        informationDepth: 'brief | moderate | comprehensive (required)';
        reassuranceLevel: 'minimal | moderate | high (required)';
      };
    };
  };

  sideEffects: [
    'Updates medical assessment history',
    'Logs cultural accommodation decisions',
    'Updates personality adaptation learning',
    'Triggers emergency protocols if needed',
    'Records tool usage effectiveness',
    'Updates medical safety monitoring',
  ];

  failureModes: [
    {
      mode: 'cultural_medical_conflict';
      description: 'Cultural beliefs conflict with medical recommendations';
      recovery: [
        'Prioritize medical safety',
        'Provide culturally sensitive explanations',
        'Offer alternatives when medically safe',
      ];
    },
    {
      mode: 'insufficient_medical_context';
      description: 'Not enough medical information for assessment';
      recovery: [
        'Request additional symptoms information',
        'Focus on emergency detection',
        'Provide general health guidance',
      ];
    },
    {
      mode: 'emergency_detection_failure';
      description: 'System fails to detect emergency situation';
      recovery: [
        'Implement emergency detection failsafe',
        'Err on side of caution',
        'Recommend immediate medical attention',
      ];
    },
  ];

  dependencies: [
    'Cultural detection system',
    'Google Gemini API for medical reasoning',
    'Emergency detection algorithms',
    'MCP tool integration system',
    'Medical knowledge base',
    'Cultural health belief database',
  ];
}

export type CulturalDetectionSystemContracts = {
  culturalDetection: CulturalDetectionContract;
  enhancedMedicalAssessment: EnhancedMedicalAssessmentContract;
};
