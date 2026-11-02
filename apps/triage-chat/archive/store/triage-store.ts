/**
 * Enhanced Zustand Store for Health Sherpa Triage System
 *
 * Supports new JSON structure with internal thoughts, cultural assessment,
 * and progressive disclosure features
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  GeminiTriageResponse,
  ConversationMessage,
  UserStatus,
  TriageError,
  ValidationResult,
} from '@/types/gemini-response';

// Store state interface
interface TriageState {
  // Current conversation
  currentResponse?: GeminiTriageResponse;
  conversationHistory: ConversationMessage[];
  isLoading: boolean;
  error?: TriageError;

  // User status tracking
  userStatus: UserStatus;

  // UI state
  debugMode: boolean;
  showInternalThoughts: boolean;
  markdownVariant: 'routine' | 'urgent' | 'emergency' | 'explanatory';

  // Session management
  sessionId: string;
  lastUpdated: string;
  totalMessages: number;

  // Tool integration state
  toolsUsed: string[];
  providerSearchPerformed: boolean;
  pricingDataRetrieved: boolean;
  lastLocationSearch?: {
    zipCode?: string;
    coordinates?: { latitude: number; longitude: number };
    timestamp: string;
  };

  // Cultural adaptation tracking
  culturalProfile: {
    indicators: string[];
    communicationStyle: string;
    personalityAdaptation: string;
    confidenceLevel: 'high' | 'medium' | 'low';
  };

  // Emergency state
  emergencyState: {
    active: boolean;
    level?: 'emergency' | 'urgent';
    redFlags: string[];
    escalationRecommended: boolean;
    nearestProviders?: Array<{
      name: string;
      distance: number;
      type: string;
    }>;
  };
}

// Store actions interface
interface TriageActions {
  // Message management
  sendMessage: (message: string) => Promise<void>;
  addResponse: (response: GeminiTriageResponse) => void;
  retryLastMessage: () => Promise<void>;

  // State management
  updateUserStatus: (updates: Partial<UserStatus>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: TriageError | undefined) => void;
  clearError: () => void;

  // UI controls
  toggleDebugMode: () => void;
  toggleInternalThoughts: () => void;
  setMarkdownVariant: (
    variant: 'routine' | 'urgent' | 'emergency' | 'explanatory'
  ) => void;

  // Tool integration
  recordToolUsage: (toolName: string) => void;
  updateLocationSearch: (location: {
    zipCode?: string;
    coordinates?: { latitude: number; longitude: number };
  }) => void;

  // Cultural adaptation
  updateCulturalProfile: (
    updates: Partial<TriageState['culturalProfile']>
  ) => void;

  // Emergency management
  activateEmergencyMode: (
    level: 'emergency' | 'urgent',
    redFlags: string[]
  ) => void;
  deactivateEmergencyMode: () => void;
  updateNearestProviders: (
    providers: Array<{ name: string; distance: number; type: string }>
  ) => void;

  // Session management
  clearConversation: () => void;
  exportSession: () => Promise<string>;
  importSession: (sessionData: string) => void;

  // Validation
  validateResponse: (response: any) => ValidationResult;
}

// Default user status
const defaultUserStatus: UserStatus = {
  emergency_assessment: {
    level: 'routine',
    confidence: 'medium',
    red_flags: [],
    escalation_needed: false,
  },
  medical_context: {
    primary_concern: '',
    symptoms_reported: [],
    duration: '',
    severity_scale: 1,
    relevant_history: [],
  },
  session_context: {
    conversation_stage: 'initial',
    questions_asked: 0,
    tools_used: [],
    provider_search_performed: false,
    pricing_data_retrieved: false,
  },
};

// Default cultural profile
const defaultCulturalProfile = {
  indicators: [],
  communicationStyle: 'adaptive',
  personalityAdaptation: 'neutral',
  confidenceLevel: 'medium' as const,
};

// Default emergency state
const defaultEmergencyState = {
  active: false,
  redFlags: [],
  escalationRecommended: false,
};

/**
 * Main Triage Store
 */
export const useTriageStore = create<TriageState & TriageActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentResponse: undefined,
    conversationHistory: [],
    isLoading: false,
    error: undefined,

    userStatus: defaultUserStatus,

    debugMode: false,
    showInternalThoughts: false,
    markdownVariant: 'routine',

    sessionId: generateSessionId(),
    lastUpdated: new Date().toISOString(),
    totalMessages: 0,

    toolsUsed: [],
    providerSearchPerformed: false,
    pricingDataRetrieved: false,

    culturalProfile: defaultCulturalProfile,
    emergencyState: defaultEmergencyState,

    // Actions
    sendMessage: async (message: string) => {
      const state = get();

      try {
        set({ isLoading: true, error: undefined });

        // Add user message to history
        const userMessage: ConversationMessage = {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
          message_id: generateMessageId(),
        };

        set({
          conversationHistory: [...state.conversationHistory, userMessage],
          totalMessages: state.totalMessages + 1,
        });

        // Prepare request payload
        const requestPayload = {
          message,
          conversationHistory: state.conversationHistory,
          userStatus: state.userStatus,
          sessionContext: {
            sessionId: state.sessionId,
            debugMode: state.debugMode,
            toolsUsed: state.toolsUsed,
            culturalProfile: state.culturalProfile,
          },
        };

        // Call triage API
        console.log(
          '>>>>> Sending to API:',
          JSON.stringify(requestPayload, null, 2)
        );
        const response = await fetch('/api/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const triageResponse: GeminiTriageResponse = await response.json();
        console.log(
          '<<<<< Received from API:',
          JSON.stringify(triageResponse, null, 2)
        );

        // Validate response
        const validation = get().validateResponse(triageResponse);
        if (!validation.isValid) {
          throw new Error(`Invalid response: ${validation.errors.join(', ')}`);
        }

        // Add response and update state
        get().addResponse(triageResponse);
      } catch (error) {
        const triageError: TriageError = {
          type: 'api',
          message: error.message,
          timestamp: new Date().toISOString(),
        };

        set({ error: triageError, isLoading: false });
      }
    },

    addResponse: (response: GeminiTriageResponse) => {
      const state = get();

      // Create assistant message
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: response.user_message,
        timestamp: new Date().toISOString(),
        message_id: generateMessageId(),
        metadata: {
          model_used: 'gemini-enhanced',
          tools_called:
            response.internal_thoughts.tool_usage?.tools_considered || [],
          emergency_flag:
            response.internal_thoughts.medical_reasoning
              .emergency_protocol_triggered,
        },
      };

      // Update conversation history
      set({
        currentResponse: response,
        conversationHistory: [...state.conversationHistory, assistantMessage],
        userStatus: response.user_status,
        isLoading: false,
        lastUpdated: new Date().toISOString(),
        totalMessages: state.totalMessages + 1,
      });

      // Update tool usage tracking
      if (response.internal_thoughts.tool_usage?.tool_selected) {
        get().recordToolUsage(
          response.internal_thoughts.tool_usage.tool_selected
        );
      }

      // Update cultural profile
      get().updateCulturalProfile({
        indicators:
          response.internal_thoughts.cultural_assessment
            .cultural_indicators_detected,
        communicationStyle:
          response.internal_thoughts.cultural_assessment
            .communication_style_preference,
        personalityAdaptation:
          response.internal_thoughts.cultural_assessment
            .personality_adaptation_needed,
        confidenceLevel: response.user_status.emergency_assessment.confidence,
      });

      // Handle emergency activation
      if (
        response.internal_thoughts.medical_reasoning
          .emergency_protocol_triggered
      ) {
        get().activateEmergencyMode(
          response.user_status.emergency_assessment.level as
            | 'emergency'
            | 'urgent',
          response.user_status.emergency_assessment.red_flags
        );
      }

      // Update markdown variant based on response depth
      const variant =
        response.internal_thoughts.response_strategy.information_depth ===
        'explanatory_500_words'
          ? 'explanatory'
          : response.user_status.emergency_assessment.level === 'emergency'
            ? 'emergency'
            : response.user_status.emergency_assessment.level === 'urgent'
              ? 'urgent'
              : 'routine';

      set({ markdownVariant: variant });
    },

    retryLastMessage: async () => {
      const state = get();
      const lastUserMessage = state.conversationHistory
        .filter((msg) => msg.role === 'user')
        .pop();

      if (lastUserMessage) {
        // Remove last assistant response if exists
        const filteredHistory = state.conversationHistory.filter(
          (msg) => msg.timestamp <= lastUserMessage.timestamp
        );

        set({ conversationHistory: filteredHistory });
        await get().sendMessage(lastUserMessage.content);
      }
    },

    updateUserStatus: (updates: Partial<UserStatus>) => {
      set((state) => ({
        userStatus: {
          ...state.userStatus,
          ...updates,
        },
        lastUpdated: new Date().toISOString(),
      }));
    },

    setLoading: (loading: boolean) => set({ isLoading: loading }),
    setError: (error: TriageError | undefined) => set({ error }),
    clearError: () => set({ error: undefined }),

    toggleDebugMode: () =>
      set((state) => ({
        debugMode: !state.debugMode,
        showInternalThoughts: !state.debugMode,
      })),

    toggleInternalThoughts: () =>
      set((state) => ({
        showInternalThoughts: !state.showInternalThoughts,
      })),

    setMarkdownVariant: (variant) => set({ markdownVariant: variant }),

    recordToolUsage: (toolName: string) => {
      set((state) => ({
        toolsUsed: [...new Set([...state.toolsUsed, toolName])],
        providerSearchPerformed:
          state.providerSearchPerformed ||
          toolName.includes('maps') ||
          toolName.includes('provider'),
        pricingDataRetrieved:
          state.pricingDataRetrieved ||
          toolName.includes('pricing') ||
          toolName.includes('cost'),
      }));
    },

    updateLocationSearch: (location) => {
      set({
        lastLocationSearch: {
          ...location,
          timestamp: new Date().toISOString(),
        },
      });
    },

    updateCulturalProfile: (updates) => {
      set((state) => ({
        culturalProfile: {
          ...state.culturalProfile,
          ...updates,
        },
      }));
    },

    activateEmergencyMode: (level, redFlags) => {
      set({
        emergencyState: {
          active: true,
          level,
          redFlags,
          escalationRecommended: level === 'emergency',
        },
      });
    },

    deactivateEmergencyMode: () => {
      set({ emergencyState: defaultEmergencyState });
    },

    updateNearestProviders: (providers) => {
      set((state) => ({
        emergencyState: {
          ...state.emergencyState,
          nearestProviders: providers,
        },
      }));
    },

    clearConversation: () => {
      set({
        currentResponse: undefined,
        conversationHistory: [],
        userStatus: defaultUserStatus,
        totalMessages: 0,
        toolsUsed: [],
        providerSearchPerformed: false,
        pricingDataRetrieved: false,
        culturalProfile: defaultCulturalProfile,
        emergencyState: defaultEmergencyState,
        sessionId: generateSessionId(),
        lastUpdated: new Date().toISOString(),
        error: undefined,
      });
    },

    exportSession: async () => {
      const state = get();
      const sessionData = {
        sessionId: state.sessionId,
        conversationHistory: state.conversationHistory,
        userStatus: state.userStatus,
        culturalProfile: state.culturalProfile,
        toolsUsed: state.toolsUsed,
        exportedAt: new Date().toISOString(),
      };

      return JSON.stringify(sessionData, null, 2);
    },

    importSession: (sessionData: string) => {
      try {
        const data = JSON.parse(sessionData);

        set({
          sessionId: data.sessionId || generateSessionId(),
          conversationHistory: data.conversationHistory || [],
          userStatus: data.userStatus || defaultUserStatus,
          culturalProfile: data.culturalProfile || defaultCulturalProfile,
          toolsUsed: data.toolsUsed || [],
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to import session:', error);
        get().setError({
          type: 'parsing',
          message: 'Invalid session data format',
          timestamp: new Date().toISOString(),
        });
      }
    },

    validateResponse: (response: any): ValidationResult => {
      const errors: any[] = [];
      const warnings: any[] = [];

      // Check required fields
      if (!response.user_message) {
        errors.push({
          field: 'user_message',
          message: 'Missing user message',
          code: 'MISSING_FIELD',
          severity: 'error',
        });
      }

      if (!response.internal_thoughts) {
        errors.push({
          field: 'internal_thoughts',
          message: 'Missing internal thoughts',
          code: 'MISSING_FIELD',
          severity: 'error',
        });
      }

      if (!response.user_status) {
        errors.push({
          field: 'user_status',
          message: 'Missing user status',
          code: 'MISSING_FIELD',
          severity: 'error',
        });
      }

      // Validate emergency consistency
      if (
        response.internal_thoughts?.medical_reasoning
          ?.emergency_protocol_triggered &&
        response.user_status?.emergency_assessment?.level !== 'emergency'
      ) {
        warnings.push({
          field: 'emergency_consistency',
          message:
            'Emergency protocol triggered but level not set to emergency',
          suggestion: 'Ensure emergency level matches protocol activation',
        });
      }

      // Validate word count
      if (
        response.user_message &&
        response.internal_thoughts?.response_strategy?.information_depth
      ) {
        const wordCount = response.user_message.split(/\s+/).length;
        const isRoutine =
          response.internal_thoughts.response_strategy.information_depth ===
          'routine_300_words';
        const limit = isRoutine ? 300 : 500;

        if (wordCount > limit + 50) {
          // Allow 50 word buffer
          warnings.push({
            field: 'word_count',
            message: `Response exceeds ${limit} word limit: ${wordCount} words`,
            suggestion: `Consider condensing response to meet ${limit} word guideline`,
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        data: errors.length === 0 ? response : undefined,
      };
    },
  }))
);

// Utility functions
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Selector hooks for optimized rerenders
export const useConversationHistory = () =>
  useTriageStore((state) => state.conversationHistory);
export const useCurrentResponse = () =>
  useTriageStore((state) => state.currentResponse);
export const useUserStatus = () => useTriageStore((state) => state.userStatus);
export const useEmergencyState = () =>
  useTriageStore((state) => state.emergencyState);
export const useCulturalProfile = () =>
  useTriageStore((state) => state.culturalProfile);
export const useDebugMode = () => useTriageStore((state) => state.debugMode);
export const useIsLoading = () => useTriageStore((state) => state.isLoading);
export const useTriageError = () => useTriageStore((state) => state.error);

// Action hooks
export const useTriageActions = () =>
  useTriageStore((state) => ({
    sendMessage: state.sendMessage,
    retryLastMessage: state.retryLastMessage,
    toggleDebugMode: state.toggleDebugMode,
    clearConversation: state.clearConversation,
    exportSession: state.exportSession,
  }));
