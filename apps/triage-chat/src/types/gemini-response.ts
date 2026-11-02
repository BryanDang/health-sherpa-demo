/**
 * TypeScript Interfaces for Gemini JSON Response Structure
 *
 * Complete type definitions for Health Sherpa enhanced triage system
 * Ensures type safety across frontend and backend components
 */

// ==================== CORE RESPONSE STRUCTURE ====================

export interface GeminiTriageResponse {
  user_message: string;
  internal_thoughts: InternalThoughts;
  user_status: UserStatus;
}

// ==================== INTERNAL THOUGHTS ====================

export interface InternalThoughts {
  medical_reasoning: MedicalReasoning;
  cultural_assessment: CulturalAssessment;
  tool_usage?: ToolUsage;
  response_strategy: ResponseStrategy;
  continuity_check: ContinuityCheck;
}

export interface MedicalReasoning {
  symptom_analysis: string;
  differential_considerations: string[];
  severity_assessment: string;
  emergency_protocol_triggered: boolean;
  clinical_indicators?: string[];
  risk_factors_identified?: string[];
}

export interface CulturalAssessment {
  cultural_indicators_detected: string[];
  communication_style_preference: string;
  personality_adaptation_needed: string;
  language_preferences?: string[];
  cultural_sensitivity_notes?: string[];
}

export interface ToolUsage {
  tools_considered: string[];
  tool_selected?: string;
  reason_for_selection?: string;
  parameters_used?: Record<string, any>;
  results_summary?: string;
  pricing_insights?: PricingInsights;
  location_insights?: LocationInsights;
}

export interface PricingInsights {
  cost_range?: string;
  affordability_assessment: string;
  payment_options: PaymentOption[];
  financial_assistance_available?: boolean;
  comparison_data?: PriceComparison[];
}

export interface LocationInsights {
  providers_found: number;
  distance_range?: string;
  transportation_considerations?: string[];
  accessibility_notes?: string[];
}

export interface ResponseStrategy {
  communication_approach: string;
  information_depth: 'routine_300_words' | 'explanatory_500_words';
  follow_up_questions: string[];
  markdown_formatting_plan: string;
  urgency_indicators?: string[];
  educational_content_included?: boolean;
}

export interface ContinuityCheck {
  conversation_context_maintained: boolean;
  user_status_updates: string[];
  next_interaction_preparation: string;
  key_information_preserved: string[];
  context_gaps_identified?: string[];
}

// ==================== USER STATUS ====================

export interface UserStatus {
  emergency_assessment: EmergencyAssessment;
  medical_context: MedicalContext;
  demographic_context?: DemographicContext;
  communication_preferences?: CommunicationPreferences;
  session_context: SessionContext;
}

export interface EmergencyAssessment {
  level: EmergencyLevel;
  confidence: ConfidenceLevel;
  red_flags: string[];
  escalation_needed: boolean;
  time_sensitivity?: TimeSensitivity;
  provider_type_needed?: ProviderType;
}

export interface MedicalContext {
  primary_concern: string;
  symptoms_reported: string[];
  duration: string;
  severity_scale: number; // 1-10 scale
  relevant_history: string[];
  medications_mentioned?: string[];
  allergies_noted?: string[];
  previous_treatments?: string[];
}

export interface DemographicContext {
  age_range?: AgeRange;
  insurance_status: InsuranceStatus;
  location?: LocationContext;
  social_determinants?: SocialDeterminants;
}

export interface CommunicationPreferences {
  cultural_indicators: string[];
  personality_cues: string[];
  preferred_communication_style: CommunicationStyle;
  information_depth_preference: InformationDepth;
  language_accommodation_needed?: boolean;
}

export interface SessionContext {
  conversation_stage: ConversationStage;
  questions_asked: number;
  tools_used: string[];
  provider_search_performed: boolean;
  pricing_data_retrieved: boolean;
  follow_ups_completed: number;
  session_duration_minutes?: number;
}

// ==================== ENUMS AND UNION TYPES ====================

export type EmergencyLevel = 'emergency' | 'urgent' | 'routine' | 'wellness';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type TimeSensitivity =
  | 'immediate'
  | 'same_day'
  | 'within_week'
  | 'routine';
export type ProviderType =
  | 'emergency_room'
  | 'urgent_care'
  | 'primary_care'
  | 'specialist'
  | 'telehealth';

export type AgeRange =
  | 'pediatric'
  | 'adolescent'
  | 'young_adult'
  | 'adult'
  | 'senior';
export type InsuranceStatus =
  | 'uninsured'
  | 'insured'
  | 'underinsured'
  | 'medicaid'
  | 'medicare'
  | 'unknown';

export type CommunicationStyle =
  | 'direct'
  | 'empathetic'
  | 'educational'
  | 'reassuring'
  | 'technical'
  | 'simplified';
export type InformationDepth =
  | 'brief'
  | 'detailed'
  | 'comprehensive'
  | 'adaptive';

export type ConversationStage =
  | 'initial'
  | 'gathering'
  | 'assessment'
  | 'recommendations'
  | 'followup'
  | 'referral';

export type PaymentOption =
  | 'cash_pay'
  | 'payment_plan'
  | 'sliding_scale'
  | 'charity_care'
  | 'insurance'
  | 'medicaid';

// ==================== SUPPORTING INTERFACES ====================

export interface LocationContext {
  zipCode?: string;
  city?: string;
  state?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  rural_urban_designation?: 'urban' | 'suburban' | 'rural';
}

export interface SocialDeterminants {
  transportation_access?: 'reliable' | 'limited' | 'none';
  work_schedule_flexibility?: 'flexible' | 'limited' | 'none';
  childcare_responsibilities?: boolean;
  language_barriers?: string[];
  health_literacy_level?: 'high' | 'medium' | 'low';
}

export interface PriceComparison {
  provider_name: string;
  cash_price: number;
  negotiated_rate?: number;
  distance_miles: number;
  quality_rating?: number;
  availability?: string;
}

// ==================== API CONFIGURATION TYPES ====================

export interface GeminiModelConfig {
  model: string;
  generationConfig: GenerationConfig;
  systemInstruction: string;
  safetySettings?: SafetySetting[];
}

export interface GenerationConfig {
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  responseMimeType: 'application/json';
  responseSchema: ResponseSchema;
  stopSequences?: string[];
}

export interface SafetySetting {
  category: string;
  threshold: string;
}

export interface ResponseSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required: string[];
}

export interface SchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

// ==================== CONVERSATION HISTORY ====================

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  message_id?: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  response_time_ms?: number;
  model_used?: string;
  token_count?: number;
  tools_called?: string[];
  emergency_flag?: boolean;
  compressed?: boolean;
}

// ==================== ERROR HANDLING ====================

export interface TriageError {
  type: 'parsing' | 'validation' | 'api' | 'timeout' | 'rate_limit';
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
  recovery_attempted?: boolean;
}

export interface FallbackResponse {
  user_message: string;
  fallback_reason: string;
  original_error: TriageError;
  basic_assessment: {
    emergency_level: EmergencyLevel;
    next_steps: string[];
  };
}

// ==================== VALIDATION UTILITIES ====================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  data?: GeminiTriageResponse;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
}

// ==================== STATE MANAGEMENT ====================

export interface TriageState {
  currentResponse?: GeminiTriageResponse;
  conversationHistory: ConversationMessage[];
  userStatus: UserStatus;
  isLoading: boolean;
  error?: TriageError;
  lastUpdated: string;
  debugMode: boolean;
}

export interface TriageActions {
  sendMessage: (message: string) => Promise<void>;
  updateUserStatus: (updates: Partial<UserStatus>) => void;
  clearConversation: () => void;
  toggleDebugMode: () => void;
  exportSession: () => Promise<string>;
  retryLastMessage: () => Promise<void>;
}

// ==================== TESTING TYPES ====================

export interface MockTriageResponse extends GeminiTriageResponse {
  _mock: true;
  _scenario: string;
  _timestamp: string;
}

export interface TestScenario {
  name: string;
  description: string;
  input: {
    user_message: string;
    conversation_history: ConversationMessage[];
    user_status: Partial<UserStatus>;
  };
  expected_output: Partial<GeminiTriageResponse>;
  assertions: TestAssertion[];
  tags: string[];
}

export interface TestAssertion {
  field: string;
  condition: 'equals' | 'contains' | 'exists' | 'type' | 'range';
  expected: any;
  description: string;
}

// ==================== EXPORT HELPERS ====================

// Type guards
export function isEmergencyResponse(response: GeminiTriageResponse): boolean {
  return (
    response.user_status.emergency_assessment.level === 'emergency' ||
    response.internal_thoughts.medical_reasoning.emergency_protocol_triggered
  );
}

export function isValidTriageResponse(data: any): data is GeminiTriageResponse {
  return (
    typeof data === 'object' &&
    typeof data.user_message === 'string' &&
    typeof data.internal_thoughts === 'object' &&
    typeof data.user_status === 'object'
  );
}

// Utility type for partial updates
export type PartialTriageResponse = {
  [K in keyof GeminiTriageResponse]?: K extends 'internal_thoughts'
    ? Partial<InternalThoughts>
    : K extends 'user_status'
      ? Partial<UserStatus>
      : GeminiTriageResponse[K];
};

// Response transformation utilities
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: TriageError;
  metadata: {
    timestamp: string;
    model_used: string;
    response_time_ms: number;
    token_usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
};
