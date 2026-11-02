/**
 * Contract for Chat Integration with Progressive Disclosure
 * Defines how TriageChat integrates progressive disclosure components
 * Based on medical workflow integration patterns and accessibility requirements
 */

export interface ChatIntegrationContract {
  /**
   * Input: Chat integration configuration and data flow
   */
  inputs: {
    /** Message data structure */
    message: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;

      /** Enhanced medical data */
      reasoning?: {
        plan: string;
        steps: string[];
        observations: string[];
        confidence: number;
      };
      memory?: {
        symptoms: Array<{
          description: string;
          severity: number;
          onset: string;
          timestamp: string;
        }>;
        medicalHistory: string[];
        medications: string[];
        allergies: string[];
        emergencyFlags: string[];
        lastUpdate: string;
      };
      careLevel?: 'emergency' | 'urgent' | 'primary' | 'self_care';
      emergencyDetected?: boolean;
    };

    /** Integration configuration */
    integrationConfig: {
      /** Progressive disclosure settings */
      progressiveDisclosure: {
        enabled: boolean;
        defaultExpanded: boolean;
        expandOnEmergency: boolean;
        roleBasedExpansion: boolean;
      };

      /** Medical display settings */
      medicalDisplay: {
        showReasoning: boolean;
        showMemory: boolean;
        showConfidence: boolean;
        emergencyAlerts: boolean;
        colorCoding: boolean;
      };

      /** User context */
      userContext: {
        role: 'physician' | 'nurse' | 'patient' | 'admin';
        accessLevel: 'full' | 'limited' | 'emergency_only';
        preferences: {
          autoExpand: boolean;
          detailLevel: 'minimal' | 'standard' | 'detailed';
          alertThreshold: number;
        };
      };

      /** Clinical workflow */
      clinicalWorkflow: {
        sessionType: 'triage' | 'consultation' | 'review';
        emergencyMode: boolean;
        auditMode: boolean;
        timeConstraints: boolean;
      };
    };

    /** Accessibility requirements */
    accessibility: {
      screenReaderOptimized: boolean;
      highContrast: boolean;
      keyboardNavigation: boolean;
      voiceControl: boolean;
      emergencyAnnouncements: boolean;
    };
  };

  /**
   * Output: Integrated chat interface with medical progressive disclosure
   */
  outputs: {
    /** Chat message rendering */
    messageRendering: {
      /** Basic message display */
      basicMessage: {
        content: string;
        role: 'user' | 'assistant';
        timestamp: string;
        emergency: boolean;
      };

      /** Progressive disclosure integration */
      progressiveElements: {
        /** Reasoning disclosure */
        reasoningDisclosure?: {
          visible: boolean;
          expanded: boolean;
          emergencyPriority: boolean;
          confidenceWarning: boolean;
        };

        /** Memory disclosure */
        memoryDisclosure?: {
          visible: boolean;
          expanded: boolean;
          emergencyFlags: number;
          criticalAlerts: string[];
        };

        /** Emergency override */
        emergencyOverride: {
          available: boolean;
          triggered: boolean;
          showAllInfo: boolean;
        };
      };

      /** Medical workflow integration */
      workflowIntegration: {
        careLevel: 'emergency' | 'urgent' | 'primary' | 'self_care';
        clinicalAlerts: string[];
        actionableItems: string[];
        nextSteps: string[];
      };
    };

    /** Chat state management */
    chatState: {
      messages: Array<{
        id: string;
        basicContent: string;
        enhancedData: any;
        disclosureState: {
          reasoningExpanded: boolean;
          memoryExpanded: boolean;
          emergencyMode: boolean;
        };
      }>;
      currentMemory: any;
      emergencyActive: boolean;
      sessionMetrics: {
        totalMessages: number;
        emergencyAlerts: number;
        disclosureInteractions: number;
      };
    };

    /** Medical integration features */
    medicalIntegration: {
      /** Emergency detection */
      emergencyHandling: {
        alertsTriggered: number;
        overrideActivated: boolean;
        emergencyProtocols: string[];
        notificationsSent: boolean;
      };

      /** Clinical decision support */
      clinicalSupport: {
        confidenceTracking: boolean;
        reasoningAudit: boolean;
        memoryValidation: boolean;
        workflowGuidance: string[];
      };

      /** Data persistence */
      dataPersistence: {
        sessionSaved: boolean;
        memoryPersisted: boolean;
        auditTrailMaintained: boolean;
        complianceValidated: boolean;
      };
    };

    /** Accessibility integration */
    accessibilityFeatures: {
      screenReaderSupport: {
        messageAnnouncements: boolean;
        emergencyAlerts: boolean;
        navigationCues: boolean;
        contextualHelp: boolean;
      };
      keyboardControls: {
        disclosureToggle: string; // keyboard shortcut
        emergencyOverride: string;
        navigationSupport: boolean;
        focusManagement: boolean;
      };
      visualAccessibility: {
        highContrastMode: boolean;
        colorCoding: boolean;
        iconSupport: boolean;
        textScaling: boolean;
      };
    };
  };

  /**
   * Side effects: Chat and clinical workflow impacts
   */
  sideEffects: [
    'Progressive disclosure state affects message display complexity',
    'Emergency detection triggers immediate visual/audio alerts',
    'Memory persistence saves patient data across sessions',
    'Clinical audit logs record all disclosure interactions',
    'Screen readers announce emergency state changes',
    'Role-based access controls filter displayed information',
    'Emergency mode overrides normal progressive disclosure',
    'Chat history grows with enhanced medical data',
    'Performance impact from complex medical data rendering',
  ];

  /**
   * Failure modes: Integration and safety risks
   */
  failureModes: [
    'Progressive disclosure component crashes breaking chat display',
    'Emergency detection fails hiding critical patient alerts',
    'Memory integration corruption causes data loss',
    'Reasoning display errors confuse clinical decision-making',
    'Role-based access fails exposing inappropriate information',
    'Screen reader integration fails preventing clinician access',
    'Chat state synchronization errors cause UI inconsistency',
    'Emergency override fails when critical access needed',
    'Performance degradation from large medical datasets',
    'Accessibility features malfunction during emergency situations',
    'Data persistence fails losing important session information',
    'Clinical workflow integration breaks disrupting patient care',
  ];

  /**
   * Dependencies: Chat and medical system integration
   */
  dependencies: [
    'TriageChat main component architecture',
    'ProgressiveDisclosure component implementation',
    'ReasoningDisplay component for AI reasoning',
    'MemoryDisplay component for patient data',
    'React state management for chat and disclosure state',
    'HIPAA-compliant data handling and persistence',
    'Medical emergency detection algorithms',
    'Clinical workflow management systems',
    'Accessibility compliance frameworks (WCAG 2.1)',
    'Screen reader compatibility libraries',
    'Medical audit logging infrastructure',
    'Role-based access control systems',
    'Emergency notification and alert systems',
    'Performance monitoring for medical data rendering',
  ];
}

/**
 * Type definitions for chat integration
 */
export type ChatIntegrationProps = ChatIntegrationContract['inputs'];
export type ProgressiveDisclosureState = {
  reasoningExpanded: boolean;
  memoryExpanded: boolean;
  emergencyMode: boolean;
};
export type MedicalWorkflowType = 'triage' | 'consultation' | 'review';
export type ClinicalAccessLevel = 'full' | 'limited' | 'emergency_only';

/**
 * Integration event handlers
 */
export interface ChatIntegrationEvents {
  onDisclosureToggle: (
    messageId: string,
    type: 'reasoning' | 'memory',
    expanded: boolean
  ) => void;
  onEmergencyOverride: (messageId: string) => void;
  onMemoryUpdate: (newMemory: any) => void;
  onClinicalAlert: (
    alert: string,
    severity: 'emergency' | 'urgent' | 'warning'
  ) => void;
  onReasoningReview: (messageId: string, reasoning: any) => void;
  onAccessibilityRequest: (feature: string, enabled: boolean) => void;
}

/**
 * Chat message with medical enhancement
 */
export interface EnhancedChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;

  /** Medical enhancements */
  reasoning?: any;
  memory?: any;
  careLevel?: 'emergency' | 'urgent' | 'primary' | 'self_care';
  emergencyDetected?: boolean;

  /** Progressive disclosure state */
  disclosureState: ProgressiveDisclosureState;

  /** Accessibility state */
  accessibilityState: {
    announced: boolean;
    focusable: boolean;
    emergencyAlert: boolean;
  };
}
