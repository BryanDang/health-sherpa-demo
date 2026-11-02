import { StateCreator } from 'zustand';
import { ChatMessage, ChatSession, PhaseNumber } from '@/types/core';

export interface ChatSlice {
  // State
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  isLoading: boolean;
  error: string | null;

  // Actions
  createSession: (userGoals: string[], phase?: PhaseNumber) => string;
  setCurrentSession: (sessionId: string) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  clearCurrentSession: () => void;
  deleteSession: (sessionId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Phase-specific message management
  getMessagesForPhase: (phase: PhaseNumber) => ChatMessage[];
  moveMessageToPhase: (messageId: string, targetPhase: PhaseNumber) => void;
}

export const createChatSlice: StateCreator<ChatSlice, [], [], ChatSlice> = (
  set,
  get
) => ({
  // Initial state
  currentSession: null,
  sessions: [],
  isLoading: false,
  error: null,

  // Actions
  createSession: (userGoals: string[], phase: PhaseNumber = 0) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newSession: ChatSession = {
      id: sessionId,
      messages: [],
      currentPhase: phase,
      sherpaOpinion: {
        id: `opinion_${sessionId}`,
        lastUpdated: new Date().toISOString(),
        clinicalFindings: [],
        knowledgeGaps: [],
        assumptions: [],
        riskAssessment: 'low',
        documentCitations: [],
        webSourceCitations: [],
        confidence: {
          overallConfidence: 0,
          findingConfidence: {},
          knowledgeGapSeverity: {},
          confidenceThreshold: 70,
          lastReanalysisReason: '',
          readyForNextPhase: false,
          phaseCompletionConfidence: 0,
        },
        userProfileInfluence: '',
      },
      userProfile: {
        role: 'patient',
        goals: userGoals,
        otherPartiesInvolved: [],
        expertiseLevel: 'novice',
        communicationStyle: 'conversational',
        mirroringCues: {
          vocabularyLevel: [],
          sentenceLength: 'medium',
          questioningStyle: 'clarifying',
          emotionalTone: 'empathetic',
        },
        additionalContext: [],
        profileUpdates: [],
        exportableProfile: '',
        internalProfile: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      sessions: [...state.sessions, newSession],
      currentSession: newSession,
    }));

    return sessionId;
  },

  setCurrentSession: (sessionId: string) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (session) {
      set({ currentSession: session });
    }
  },

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const currentSession = get().currentSession;
    if (!currentSession) return;

    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    const updatedSession: ChatSession = {
      ...currentSession,
      messages: [...currentSession.messages, newMessage],
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      currentSession: updatedSession,
      sessions: state.sessions.map((s) =>
        s.id === currentSession.id ? updatedSession : s
      ),
    }));
  },

  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => {
    const currentSession = get().currentSession;
    if (!currentSession) return;

    const updatedMessages = currentSession.messages.map((msg) =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );

    const updatedSession: ChatSession = {
      ...currentSession,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      currentSession: updatedSession,
      sessions: state.sessions.map((s) =>
        s.id === currentSession.id ? updatedSession : s
      ),
    }));
  },

  clearCurrentSession: () => {
    set({ currentSession: null });
  },

  deleteSession: (sessionId: string) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      currentSession:
        state.currentSession?.id === sessionId ? null : state.currentSession,
    }));
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  // Phase-specific message management
  getMessagesForPhase: (phase: PhaseNumber) => {
    const currentSession = get().currentSession;
    if (!currentSession) return [];

    return currentSession.messages.filter((msg) => msg.phase === phase);
  },

  moveMessageToPhase: (messageId: string, targetPhase: PhaseNumber) => {
    const currentSession = get().currentSession;
    if (!currentSession) return;

    const updatedMessages = currentSession.messages.map((msg) =>
      msg.id === messageId ? { ...msg, phase: targetPhase } : msg
    );

    const updatedSession: ChatSession = {
      ...currentSession,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      currentSession: updatedSession,
      sessions: state.sessions.map((s) =>
        s.id === currentSession.id ? updatedSession : s
      ),
    }));
  },
});
