// Legacy types module for backward compatibility
// Re-exports from the main core types

export type {
  // Legacy compatibility types
  Message,
  Document,

  // Core types
  ChatMessage,
  HealthDocument,
  UserProfile,
  UserRole,
  ExpertiseLevel,
  PhaseNumber,
  SherpaOpinion,
  Insight,
  EvidenceGroup,
  Action,
  ChatSession,

  // UI types
  UIState,
} from '@/types/core';

// Additional legacy compatibility
export interface DeidentifiedDocument {
  id: string;
  name: string;
  content: string;
  deidentifiedText: string;
  uploadedAt: string;
}

export interface AppState {
  currentDocument: import('@/types/core').HealthDocument | null;
  isProviderMode: boolean;
  messages: import('@/types/core').Message[];
}

// Additional legacy types that some old files might expect
export interface DocumentAnalysisData {
  id: string;
  findings: string[];
  confidence: number;
}

export interface PhaseContent {
  phase: number;
  content: string;
  completed: boolean;
}
