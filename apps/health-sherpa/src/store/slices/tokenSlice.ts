import { StateCreator } from 'zustand';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface TokenState {
  // Session totals
  sessionInputTokens: number;
  sessionOutputTokens: number;
  sessionTotalTokens: number;
  sessionCost: number;

  // Limits and warnings
  tokenLimit: number;
  warningThreshold: number; // percentage

  // Usage history
  apiCalls: TokenUsage[];

  // Actions
  addTokenUsage: (usage: TokenUsage) => void;
  resetSession: () => void;
  getUsagePercentage: () => number;
  isNearLimit: () => boolean;
  getCurrentUsage: () => {
    input: number;
    output: number;
    total: number;
    cost: number;
    limit: number;
  };
}

export type TokenSlice = TokenState;

export const createTokenSlice: StateCreator<TokenSlice, [], [], TokenSlice> = (
  set,
  get
) => ({
  // Initial state
  sessionInputTokens: 0,
  sessionOutputTokens: 0,
  sessionTotalTokens: 0,
  sessionCost: 0,
  tokenLimit: 10000,
  warningThreshold: 80,
  apiCalls: [],

  // Actions
  addTokenUsage: (usage: TokenUsage) => {
    set((state) => ({
      sessionInputTokens: state.sessionInputTokens + usage.inputTokens,
      sessionOutputTokens: state.sessionOutputTokens + usage.outputTokens,
      sessionTotalTokens: state.sessionTotalTokens + usage.totalTokens,
      sessionCost: state.sessionCost + usage.estimatedCost,
      apiCalls: [...state.apiCalls, usage],
    }));
  },

  resetSession: () => {
    set({
      sessionInputTokens: 0,
      sessionOutputTokens: 0,
      sessionTotalTokens: 0,
      sessionCost: 0,
      apiCalls: [],
    });
  },

  getUsagePercentage: () => {
    const state = get();
    return (state.sessionTotalTokens / state.tokenLimit) * 100;
  },

  isNearLimit: () => {
    const state = get();
    return state.getUsagePercentage() >= state.warningThreshold;
  },

  getCurrentUsage: () => {
    const state = get();
    return {
      input: state.sessionInputTokens,
      output: state.sessionOutputTokens,
      total: state.sessionTotalTokens,
      cost: state.sessionCost,
      limit: state.tokenLimit,
    };
  },
});
