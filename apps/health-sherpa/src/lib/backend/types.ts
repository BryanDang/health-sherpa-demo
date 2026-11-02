/**
 * Backend interface. Every LLM call goes through ChatBackend. The mock is the
 * default; the live implementation is selected with BACKEND_MODE=live.
 */

import type { ChatMessage, PhaseNumber } from '@/types/core';

export interface ChatContext {
  documentContent?: string;
  currentPhase: PhaseNumber;
  conversationHistory: ChatMessage[];
  isProviderMode: boolean;
}

export interface ChatReply {
  content: string;
  confidence: number;
  citations: unknown[];
  searchQueries: string[];
  groundingSources: unknown[];
  reasoning: string;
  modelUsed: string;
  suggestedActions: string[];
}

export interface ChatBackend {
  reply(message: string, context: ChatContext): Promise<ChatReply>;
}

export interface Backend {
  mode: 'mock' | 'live';
  chat: ChatBackend;
}
