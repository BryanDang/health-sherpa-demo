// Store-specific types
// Re-exports from core types for store slices

export type {
  // Core types
  ChatMessage,
  HealthDocument,
  UserProfile,
  PhaseNumber,
  SherpaOpinion,
  Insight,
  EvidenceGroup,
  Action,
  ChatSession,
  DocumentProcessingStatus,

  // UI types
  UIState,

  // Phase types
  Phase0State,
  Phase1Input,
  Phase1Output,
  Phase2Input,
  Phase2Output,
  Phase3Input,
  Phase3Output,
  Phase4Input,
  Phase4Output,

  // Store state
  AppState,
} from '@/types/core';

// Store-specific interfaces
export interface StoreSlice {
  // Marker interface for store slices
}

export interface ModularStoreState {
  // Combined state from all slices
  [key: string]: any;
}
