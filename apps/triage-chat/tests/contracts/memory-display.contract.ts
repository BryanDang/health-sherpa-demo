/**
 * Contract for MemoryDisplay Component
 * Displays patient memory: symptoms, history, medications, allergies, emergency flags
 * Based on medical UI patterns and HIPAA-compliant information display
 */

export interface MemoryDisplayContract {
  /**
   * Input: Patient memory data and clinical context
   */
  inputs: {
    /** Core memory data structure */
    memory: {
      symptoms: Array<{
        description: string;
        severity: number; // 1-10 scale
        onset: string;
        timestamp: string;
      }>;
      medicalHistory: string[];
      medications: string[];
      allergies: string[];
      emergencyFlags: string[];
      lastUpdate: string;
    };

    /** Display configuration */
    layout?: 'timeline' | 'categorized' | 'compact';
    showTimestamps?: boolean;
    emergencyMode?: boolean;
    highlightCritical?: boolean;

    /** Medical role and permissions */
    userRole?: 'physician' | 'nurse' | 'patient' | 'admin';
    accessLevel?: 'full' | 'limited' | 'emergency_only';

    /** Interactive features */
    editable?: boolean;
    expandable?: boolean;
    filterable?: boolean;

    /** Clinical workflow context */
    careLevel?: 'emergency' | 'urgent' | 'primary' | 'self_care';
    sessionContext?: 'triage' | 'consultation' | 'review';
  };

  /**
   * Output: Rendered memory display with medical safety features
   */
  outputs: {
    /** Medical information rendering */
    rendering: {
      /** Emergency alerts - always prominent */
      emergencySection: {
        flags: string[];
        allergies: string[];
        criticalMedications: string[];
        visible: boolean;
        prominence: 'banner' | 'alert' | 'warning';
      };

      /** Categorized information display */
      categorizedSections: {
        symptoms: {
          items: Array<{
            description: string;
            severity: number;
            priority: 'critical' | 'moderate' | 'mild';
            timeframe: string;
          }>;
          sortedBySeverity: boolean;
          expandable: boolean;
        };
        medications: {
          items: string[];
          interactionWarnings: string[];
          criticalHighlighted: boolean;
        };
        allergies: {
          items: string[];
          severityLevels: Array<'severe' | 'moderate' | 'mild'>;
          prominentDisplay: boolean;
        };
        medicalHistory: {
          items: string[];
          chronological: boolean;
          relevanceFiltered: boolean;
        };
      };

      /** Timeline view for clinical progression */
      timeline: {
        events: Array<{
          timestamp: string;
          type: 'symptom' | 'medication' | 'allergy' | 'history';
          content: string;
          severity: number;
        }>;
        chronological: boolean;
        emergencyHighlighted: boolean;
      };

      /** Visual indicators and warnings */
      visualIndicators: {
        emergencyBadges: number;
        severityColors: boolean;
        interactionWarnings: number;
        dataFreshness: 'current' | 'stale' | 'unknown';
      };
    };

    /** Memory state management */
    state: {
      expandedSections: Set<string>;
      filteredCategories: string[];
      emergencyMode: boolean;
      lastRefresh: Date;
      dataIntegrity: 'valid' | 'warning' | 'error';
    };

    /** Medical-grade accessibility */
    accessibility: {
      emergencyAnnouncements: boolean;
      sectionLabeling: Record<string, string>;
      liveRegionUpdates: 'emergency' | 'all' | 'none';
      screenReaderOptimized: boolean;
      keyboardNavigation: boolean;
      highContrastSupport: boolean;
    };

    /** Clinical workflow integration */
    clinicalIntegration: {
      auditTrail: boolean;
      dataValidation: boolean;
      interactionChecking: boolean;
      allergyScreening: boolean;
      emergencyProtocols: boolean;
    };
  };

  /**
   * Side effects: Medical data handling impacts
   */
  sideEffects: [
    'Emergency flags trigger immediate visual/audio alerts',
    'Allergy information prominently displayed at all times',
    'Medication interactions automatically checked and warned',
    'Screen readers announce critical medical information changes',
    'Clinical audit logs record all memory data access',
    'Data freshness indicators update based on timestamp analysis',
    'Emergency mode overrides normal information hierarchy',
    'Role-based access controls filter sensitive information',
  ];

  /**
   * Failure modes: Patient safety risks
   */
  failureModes: [
    'Emergency flags not prominently displayed risking patient harm',
    'Allergy information hidden or truncated causing adverse reactions',
    'Medication list incomplete leading to dangerous interactions',
    'Symptoms misrepresented causing diagnostic errors',
    'Timeline chronology corrupted affecting treatment decisions',
    'Screen reader fails to announce critical allergy information',
    'Role-based access fails exposing inappropriate patient data',
    'Data integrity compromised showing outdated medical information',
    'Emergency mode activation fails when critical access needed',
    'Visual indicators fail for colorblind medical professionals',
    'Component crashes losing access to critical patient data',
    'Memory data becomes corrupted showing incorrect information',
  ];

  /**
   * Dependencies: Medical data and compliance requirements
   */
  dependencies: [
    'React useState for section expansion and filtering',
    'React useMemo for performance with large medical datasets',
    'React useCallback for clinical interaction handlers',
    'HIPAA-compliant data handling utilities',
    'Medical terminology standardization libraries',
    'Drug interaction checking APIs',
    'Allergy severity classification systems',
    'Clinical timeline formatting utilities',
    'Medical color coding standards',
    'Emergency alert notification systems',
    'Role-based access control framework',
    'Clinical audit logging infrastructure',
  ];
}

/**
 * Type definitions for memory display
 */
export type MemoryDisplayProps = MemoryDisplayContract['inputs'];
export type MedicalMemoryData = MemoryDisplayContract['inputs']['memory'];
export type MemoryLayout = 'timeline' | 'categorized' | 'compact';
export type ClinicalAccessLevel = 'full' | 'limited' | 'emergency_only';
export type SessionContext = 'triage' | 'consultation' | 'review';
