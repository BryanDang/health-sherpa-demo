/**
 * Centralized Store Hooks for Health Sherpa
 *
 * Provides typed hooks for accessing store state and actions
 * Following modular slice architecture
 */

export {
  useTriageStore,
  useConversationHistory,
  useCurrentResponse,
  useUserStatus,
  useEmergencyState,
  useCulturalProfile,
  useDebugMode,
  useIsLoading,
  useTriageError,
  useTriageActions,
} from '../triage-store';

// Re-export types for convenience
export type {
  GeminiTriageResponse,
  ConversationMessage,
  UserStatus,
  InternalThoughts,
  TriageError,
} from '@/types/gemini-response';
