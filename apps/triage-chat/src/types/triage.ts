export interface TriageSymptom {
  name: string;
  severity: number; // 1-10 scale
  duration: 'less_than_3_days' | '3_to_7_days' | 'more_than_7_days';
  description: string;
}

export interface EmergencySymptom {
  symptom: string;
  description: string;
  action: string;
}

export type CareLevel = 'emergency' | 'urgent' | 'primary' | 'self_care';

export interface TriageAssessment {
  careLevel: CareLevel;
  reasoning: string;
  timeframe: string;
  nextSteps: string[];
  selfCareAdvice?: SelfCareGuidance;
}

export interface SelfCareGuidance {
  recommendations: string[];
  citations: Citation[];
  redFlags: string[];
  followUpCriteria: string[];
}

export interface Citation {
  source: string;
  url: string;
  title: string;
  excerpt?: string;
  credibility?: 'high' | 'medium' | 'low';
  relevance?: 'high' | 'medium' | 'low';
}

export interface TriageResponse {
  message: string;
  care_level?: CareLevel;
  careLevel?: CareLevel;
  confidence: number;
  reasoning: any;
  red_flags?: string[];
  immediate_actions?: string[];
  citations?: Citation[];
  needs_more_info?: boolean;
  needsMoreInfo?: boolean;
  follow_up_questions?: string[];
  followUpQuestions?: string[];
  medical_disclaimer?: string;
  medicalDisclaimer?: string;
  emergency_instructions?: string;
  emergencyInstructions?: string;
  culturalAdaptation?: boolean;
}

export interface ProviderRecommendation {
  name: string;
  address: string;
  phone?: string;
  distance: number; // in miles
  estimatedCost: number; // cash pay price
  appointmentAvailability: string;
  providerType: 'urgent_care' | 'primary_care' | 'specialist' | 'emergency';
}

export interface TriageConversation {
  id: string;
  messages: TriageMessage[];
  currentStep: number;
  patientData: PatientData;
  assessment?: TriageAssessment;
  providers?: ProviderRecommendation[];
}

export interface TriageMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  step?: number;
  type?: 'user' | 'assistant' | 'system' | 'thinking';
  isStreaming?: boolean;
  careLevel?: CareLevel;
  reasoning?: {
    symptomsAnalyzed?: string[];
    redFlags?: string[];
    careLevelJustification?: string;
    timeframe?: string;
    nextSteps?: string[];
    modelsUsed?: {
      extraction: string;
      response: string;
    };
  };
}

export interface PatientData {
  symptoms: TriageSymptom[];
  hasInsurance: boolean;
  location?: {
    latitude: number;
    longitude: number;
    zipCode?: string;
  };
  emergencyContactHistory: boolean;
  demographicGroup: '26_40_uninsured';
}
