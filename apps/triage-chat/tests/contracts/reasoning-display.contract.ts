/**
 * Contract for ReasoningDisplay Component
 * Displays AI reasoning steps, confidence scores, and clinical observations
 * Based on medical UI research and clinical decision support patterns
 */

export interface ReasoningDisplayContract {
  /**
   * Input: AI reasoning data and clinical context
   */
  inputs: {
    /** Core reasoning data */
    reasoning: {
      plan: string;
      steps: string[];
      observations: string[];
      confidence: number; // 0.0 to 1.0
    };

    /** Clinical context */
    severity?: 'emergency' | 'urgent' | 'routine';
    careLevel?: 'emergency' | 'urgent' | 'primary' | 'self_care';
    emergencyFlags?: string[];

    /** Display configuration */
    expandable?: boolean;
    showConfidence?: boolean;
    showEvidence?: boolean;
    compact?: boolean;

    /** Medical role-based display */
    userRole?: 'physician' | 'nurse' | 'patient' | 'admin';

    /** Accessibility configuration */
    announceChanges?: boolean;
    emergencyOverride?: boolean;
  };

  /**
   * Output: Rendered reasoning display with medical safety features
   */
  outputs: {
    /** Visual rendering with medical UI patterns */
    rendering: {
      /** Confidence indicator with clinical context */
      confidenceIndicator: {
        value: number;
        visualLevel: 'high' | 'medium' | 'low';
        colorCode: 'green' | 'amber' | 'red';
        accessible: boolean;
      };

      /** Reasoning steps display */
      reasoningSteps: {
        steps: Array<{
          content: string;
          index: number;
          expanded: boolean;
          evidence?: string[];
        }>;
        expandable: boolean;
        tieredDisplay: boolean;
      };

      /** Clinical observations */
      observations: {
        items: string[];
        prioritized: boolean;
        emergencyHighlighted: boolean;
      };

      /** Medical alerts and warnings */
      alerts: {
        emergencyFlags: string[];
        confidenceWarnings: boolean;
        clinicalWarnings: string[];
      };
    };

    /** Component state for medical workflows */
    state: {
      expanded: boolean;
      confidence: number;
      severity: 'emergency' | 'urgent' | 'routine';
      emergencyMode: boolean;
      alertsVisible: boolean;
    };

    /** Medical-grade accessibility */
    accessibility: {
      ariaExpanded: boolean;
      ariaLabel: string;
      liveRegion: 'off' | 'polite' | 'assertive';
      emergencyAnnouncement: boolean;
      confidenceAnnouncement: string;
      roleBasedAccess: boolean;
    };

    /** Clinical workflow events */
    events: {
      onExpand?: () => void;
      onConfidenceAlert?: (level: string) => void;
      onEmergencyFlag?: (flags: string[]) => void;
      onClinicalReview?: (reasoning: any) => void;
    };
  };

  /**
   * Side effects: Clinical workflow impacts
   */
  sideEffects: [
    'Screen reader announces confidence changes',
    'Emergency alerts trigger immediate visual/audio notifications',
    'Clinical audit logs record reasoning access',
    'Role-based access controls filter displayed information',
    'Emergency mode overrides normal display restrictions',
    'Confidence alerts may trigger clinical review workflows',
    'ARIA live regions announce critical reasoning updates',
  ];

  /**
   * Failure modes: Medical safety considerations
   */
  failureModes: [
    'Confidence score renders incorrectly causing clinical misinterpretation',
    'Emergency flags not prominently displayed risking patient safety',
    'Reasoning steps fail to load causing diagnostic uncertainty',
    'Accessibility features fail preventing clinician access',
    'Role-based access fails exposing inappropriate information',
    'Emergency override fails when critical access needed',
    'Screen reader fails to announce confidence changes',
    'Component crashes during emergency situation',
    'Color-coding fails for colorblind clinicians',
    'Low confidence scores not visually highlighted',
    'Clinical observations truncated or hidden inappropriately',
  ];

  /**
   * Dependencies: Medical software requirements
   */
  dependencies: [
    'React useState for expansion and emergency state',
    'React useCallback for clinical event handlers',
    'React useRef for screen reader announcements',
    'ARIA live regions for emergency notifications',
    'Medical color coding standards (red/amber/green)',
    'Clinical confidence scoring algorithms',
    'Medical terminology standardization',
    'HIPAA-compliant audit logging',
    'Role-based access control system',
    'Emergency override authorization system',
  ];
}

/**
 * Type definitions for medical reasoning display
 */
export type ReasoningDisplayProps = ReasoningDisplayContract['inputs'];
export type ClinicalSeverity = 'emergency' | 'urgent' | 'routine';
export type MedicalUserRole = 'physician' | 'nurse' | 'patient' | 'admin';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
