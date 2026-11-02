/**
 * Enhanced Memory Schema for Session Persistence
 * Includes user-readable summaries and doctor handoff information
 */

export interface SessionSummary {
  patientConcerns: string[];
  keyFindings: string[];
  assessmentProgression: string;
  outstandingQuestions: string[];
  recommendedActions: string[];
  nextSteps: string[];
}

export interface DoctorHandoff {
  chiefComplaint: string;
  symptomTimeline: string;
  redFlags: string[];
  assessmentSummary: string;
  patientQuestions: string[];
  recommendedEvaluation: string;
  urgencyLevel: 'routine' | 'urgent' | 'emergency';
}

export interface AnticipatedQuestions {
  forPatient: string[];
  forProvider: string[];
  diagnosticConsiderations: string[];
  treatmentOptions: string[];
}

export interface EnhancedMedicalMemory {
  // Core medical data
  symptoms: Array<{
    description: string;
    severity: number;
    onset: string;
    duration: string;
    context: string;
    timestamp: string;
  }>;
  medicalHistory: string[];
  medications: string[];
  allergies: string[];
  emergencyFlags: string[];

  // Enhanced session tracking
  sessionSummary: SessionSummary;
  doctorHandoff: DoctorHandoff;
  anticipatedQuestions: AnticipatedQuestions;

  // Conversation evolution
  assessmentProgression: Array<{
    timestamp: string;
    careLevel: string;
    reasoning: string;
    confidence: number;
  }>;

  // Metadata
  lastUpdate: string;
  sessionId: string;
  totalExchanges: number;
}

export interface SessionExport {
  // Core conversation data (what goes to Gemini)
  recentExchanges: Array<{
    userMessage: string;
    assistantReasoning: {
      plan: string;
      steps: string[];
      observations: string[];
      confidence: number;
    };
    assistantMemory: EnhancedMedicalMemory;
    assistantMessage: string;
    timestamp: string;
  }>;

  // User-readable session summary
  sessionSummary: {
    title: string;
    date: string;
    duration: string;
    mainConcerns: string[];
    keyFindings: string[];
    recommendedActions: string[];
    nextSteps: string[];
    urgencyLevel: string;
  };

  // Questions for next visit
  upcomingQuestions: {
    forDoctor: string[];
    forSpecialist: string[];
    followUpSymptoms: string[];
    treatmentQuestions: string[];
  };

  // Doctor handoff document
  providerHandoff: {
    patientName: string;
    sessionDate: string;
    chiefComplaint: string;
    historyOfPresentIllness: string;
    relevantHistory: string[];
    currentMedications: string[];
    allergies: string[];
    assessmentAndPlan: string;
    redFlags: string[];
    patientQuestions: string[];
    recommendedWorkup: string[];
    urgencyLevel: string;
    triageAssessment: string;
  };

  // Metadata
  exportVersion: string;
  exportDate: string;
  sessionId: string;
}

/**
 * Enhanced reasoning with slot-filling awareness
 */
export interface EnhancedReasoning {
  plan: string;
  steps: string[];
  observations: string[];
  confidence: number;

  // Slot-filling enhancements
  missingInformation: string[];
  nextQuestions: string[];
  assessmentComplete: boolean;

  // Medical-specific reasoning
  differentialDiagnosis: string[];
  redFlagAssessment: string;
  urgencyRationale: string;

  // Semantic understanding
  semanticAnalysis: {
    primaryConcern: string;
    secondaryConcerns: string[];
    emotionalTone: string;
    urgencyPerception: string;
  };
}

/**
 * Full stateful response with enhanced capabilities
 */
export interface EnhancedStatefulResponse {
  updated_reasoning: EnhancedReasoning;
  assistant_message: string;
  updated_memory: EnhancedMedicalMemory;

  // Additional response metadata
  responseMetadata: {
    emergencyDetected: boolean;
    careLevel: 'emergency' | 'urgent' | 'primary' | 'self_care';
    needsFollowUp: boolean;
    slotFillingComplete: boolean;
    semanticConfidence: number;
    modelUsed: string;
  };
}
