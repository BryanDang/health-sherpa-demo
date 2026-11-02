/**
 * Contract Definition: Gemini JSON Response Structure
 *
 * Following TDD + Contract-Driven Development framework
 * Defines clear input/output contracts for AI + deterministic systems
 */

export interface GeminiJSONResponseContract {
  inputs: {
    userMessage: string;
    conversationHistory: ConversationMessage[];
    userStatus: UserStatusObject;
    systemPrompt: string;
    modelConfig: GeminiModelConfig;
  };
  outputs: {
    user_message: string;
    internal_thoughts: InternalThoughtsObject;
    user_status: UserStatusObject;
  };
  sideEffects: string[];
  failureModes: string[];
  dependencies: string[];
}

/**
 * Input Contracts
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface UserStatusObject {
  emergency_assessment: {
    level: 'emergency' | 'urgent' | 'routine' | 'wellness';
    confidence: 'high' | 'medium' | 'low';
    red_flags: string[];
    escalation_needed: boolean;
  };
  medical_context: {
    primary_concern: string;
    symptoms_reported: string[];
    duration: string;
    severity_scale: number; // 1-10
    relevant_history: string[];
  };
  demographic_context: {
    age_range?: string;
    insurance_status: 'uninsured' | 'insured' | 'underinsured' | 'unknown';
    location?: {
      zipCode?: string;
      state?: string;
      coordinates?: { latitude: number; longitude: number };
    };
  };
  communication_preferences: {
    cultural_indicators: string[];
    personality_cues: string[];
    preferred_communication_style: string;
    information_depth_preference: 'brief' | 'detailed' | 'adaptive';
  };
  session_context: {
    conversation_stage:
      | 'initial'
      | 'gathering'
      | 'assessment'
      | 'recommendations'
      | 'followup';
    questions_asked: number;
    tools_used: string[];
    provider_search_performed: boolean;
  };
}

export interface GeminiModelConfig {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  responseMimeType: 'application/json';
  responseSchema?: object;
  systemInstruction: string;
}

/**
 * Output Contracts
 */
export interface InternalThoughtsObject {
  medical_reasoning: {
    symptom_analysis: string;
    differential_considerations: string[];
    severity_assessment: string;
    emergency_protocol_triggered: boolean;
  };
  cultural_assessment: {
    cultural_indicators_detected: string[];
    communication_style_preference: string;
    personality_adaptation_needed: string;
  };
  tool_usage?: {
    tools_considered: string[];
    tool_selected?: string;
    reason_for_selection?: string;
    parameters_used?: Record<string, any>;
    results_summary?: string;
  };
  response_strategy: {
    communication_approach: string;
    information_depth: 'routine_300_words' | 'explanatory_500_words';
    follow_up_questions: string[];
    markdown_formatting_plan: string;
  };
  continuity_check: {
    conversation_context_maintained: boolean;
    user_status_updates: string[];
    next_interaction_preparation: string;
  };
}

/**
 * Contract Implementation: Gemini JSON Response
 */
export const GEMINI_JSON_RESPONSE_CONTRACT: GeminiJSONResponseContract = {
  inputs: {
    userMessage: "User's current message requiring triage response",
    conversationHistory: [],
    userStatus: {} as UserStatusObject,
    systemPrompt:
      'Enhanced Health Sherpa system prompt with JSON structure requirements',
    modelConfig: {} as GeminiModelConfig,
  },

  outputs: {
    user_message:
      '300-word routine or 500-word explanatory response with markdown formatting',
    internal_thoughts: {} as InternalThoughtsObject,
    user_status: {} as UserStatusObject,
  },

  sideEffects: [
    'Updates user_status object with new medical context',
    'Triggers emergency protocols if red flags detected',
    'Calls external tools (Google Maps, Turquoise Health) if needed',
    'Logs conversation state for continuity',
    'Updates cultural and personality profiles',
  ],

  failureModes: [
    'Malformed JSON response from Gemini API',
    'Missing required fields in JSON structure',
    'Token limit exceeded (context window overflow)',
    'API rate limits exceeded (429 errors)',
    'Emergency assessment false negatives',
    'Cultural sensitivity failures',
    'Tool integration failures',
    'Context compression errors',
  ],

  dependencies: [
    'Google Gemini API with structured JSON support',
    'Google Maps MCP server for provider search',
    'Turquoise Health API for pricing data',
    'Supabase Edge Functions for tool orchestration',
    'react-markdown for frontend rendering',
    'Zustand store for state management',
  ],
};

/**
 * JSON Schema Contract for Gemini API
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    user_message: {
      type: 'string',
      maxLength: 2500, // ~500 words
      description: 'User-facing response with markdown formatting',
    },
    internal_thoughts: {
      type: 'object',
      properties: {
        medical_reasoning: {
          type: 'object',
          properties: {
            symptom_analysis: { type: 'string' },
            differential_considerations: {
              type: 'array',
              items: { type: 'string' },
            },
            severity_assessment: { type: 'string' },
            emergency_protocol_triggered: { type: 'boolean' },
          },
          required: [
            'symptom_analysis',
            'severity_assessment',
            'emergency_protocol_triggered',
          ],
        },
        cultural_assessment: {
          type: 'object',
          properties: {
            cultural_indicators_detected: {
              type: 'array',
              items: { type: 'string' },
            },
            communication_style_preference: { type: 'string' },
            personality_adaptation_needed: { type: 'string' },
          },
          required: ['communication_style_preference'],
        },
        response_strategy: {
          type: 'object',
          properties: {
            communication_approach: { type: 'string' },
            information_depth: {
              type: 'string',
              enum: ['routine_300_words', 'explanatory_500_words'],
            },
            follow_up_questions: {
              type: 'array',
              items: { type: 'string' },
            },
            markdown_formatting_plan: { type: 'string' },
          },
          required: ['communication_approach', 'information_depth'],
        },
        continuity_check: {
          type: 'object',
          properties: {
            conversation_context_maintained: { type: 'boolean' },
            user_status_updates: {
              type: 'array',
              items: { type: 'string' },
            },
            next_interaction_preparation: { type: 'string' },
          },
          required: ['conversation_context_maintained'],
        },
      },
      required: ['medical_reasoning', 'response_strategy', 'continuity_check'],
    },
    user_status: {
      type: 'object',
      properties: {
        emergency_assessment: {
          type: 'object',
          properties: {
            level: {
              type: 'string',
              enum: ['emergency', 'urgent', 'routine', 'wellness'],
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
            },
            red_flags: {
              type: 'array',
              items: { type: 'string' },
            },
            escalation_needed: { type: 'boolean' },
          },
          required: ['level', 'confidence', 'escalation_needed'],
        },
        session_context: {
          type: 'object',
          properties: {
            conversation_stage: {
              type: 'string',
              enum: [
                'initial',
                'gathering',
                'assessment',
                'recommendations',
                'followup',
              ],
            },
            questions_asked: { type: 'number' },
            tools_used: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['conversation_stage'],
        },
      },
      required: ['emergency_assessment', 'session_context'],
    },
  },
  required: ['user_message', 'internal_thoughts', 'user_status'],
} as const;

/**
 * Test Cases Contract
 */
export interface TestCasesContract {
  unitTests: {
    jsonParsing: TestCase[];
    schemaValidation: TestCase[];
    emergencyDetection: TestCase[];
    culturalAdaptation: TestCase[];
  };
  integrationTests: {
    geminiApiIntegration: TestCase[];
    toolIntegration: TestCase[];
    stateManagement: TestCase[];
  };
  failureModeTests: {
    malformedJson: TestCase[];
    apiRateLimits: TestCase[];
    contextOverflow: TestCase[];
    emergencyFalseNegatives: TestCase[];
  };
  endToEndTests: {
    completeTriageWorkflow: TestCase[];
    multiMessageConversation: TestCase[];
    toolAssistedRecommendations: TestCase[];
  };
}

export interface TestCase {
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
  assertions: string[];
  tags: string[];
}
