import { StateCreator } from 'zustand';
import {
  PhaseNumber,
  SherpaOpinion,
  Insight,
  EvidenceGroup,
  Action,
} from '@/types/core';

export interface PhaseSlice {
  // State
  currentPhase: PhaseNumber;
  phaseProgress: { [key in PhaseNumber]: boolean };
  sherpaOpinion: SherpaOpinion | null;

  // Phase-specific data
  phase1Summary: string | null;
  phase2Insights: Insight[];
  phase3EvidenceGroups: EvidenceGroup[];
  phase4Actions: Action[];

  // Phase transitions
  canAdvanceToPhase: { [key in PhaseNumber]: boolean };
  phaseCompletionRequirements: { [key in PhaseNumber]: string[] };

  // Actions
  setCurrentPhase: (phase: PhaseNumber) => void;
  advancePhase: () => boolean;
  goToPhase: (phase: PhaseNumber) => boolean;
  markPhaseComplete: (phase: PhaseNumber) => void;
  markPhaseIncomplete: (phase: PhaseNumber) => void;

  // Sherpa Opinion management
  updateSherpaOpinion: (updates: Partial<SherpaOpinion>) => void;
  setSherpaOpinion: (opinion: SherpaOpinion) => void;

  // Phase-specific data management
  setPhase1Summary: (summary: string) => void;
  addPhase2Insight: (insight: Insight) => void;
  updatePhase2Insight: (insightId: string, updates: Partial<Insight>) => void;
  removePhase2Insight: (insightId: string) => void;

  addPhase3EvidenceGroup: (group: EvidenceGroup) => void;
  updatePhase3EvidenceGroup: (
    groupId: string,
    updates: Partial<EvidenceGroup>
  ) => void;
  removePhase3EvidenceGroup: (groupId: string) => void;

  addPhase4Action: (action: Action) => void;
  updatePhase4Action: (actionId: string, updates: Partial<Action>) => void;
  removePhase4Action: (actionId: string) => void;
  reorderPhase4Actions: (actionIds: string[]) => void;

  // Phase validation
  validatePhaseCompletion: (phase: PhaseNumber) => boolean;
  getPhaseRequirements: (phase: PhaseNumber) => string[];

  // Cross-phase content routing
  moveInsightToPhase3: (insightId: string) => void;
  moveEvidenceToPhase4: (groupId: string) => void;
}

export const createPhaseSlice: StateCreator<PhaseSlice, [], [], PhaseSlice> = (
  set,
  get
) => ({
  // Initial state
  currentPhase: 0,
  phaseProgress: {
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
  },
  sherpaOpinion: null,

  // Phase-specific data
  phase1Summary: null,
  phase2Insights: [],
  phase3EvidenceGroups: [],
  phase4Actions: [],

  // Phase transitions
  canAdvanceToPhase: {
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
  },
  phaseCompletionRequirements: {
    0: [
      'User profile established',
      'Document uploaded and processed',
      'Goals identified',
    ],
    1: ['Clinical summary generated', 'Summary acknowledged by user'],
    2: [
      '5-7 insights gathered',
      'Knowledge gaps identified',
      'Current goal focused',
    ],
    3: ['Insights synthesized into evidence groups', 'Connections established'],
    4: ['Actions prioritized', 'Evidence-to-action rationale established'],
  },

  // Actions
  setCurrentPhase: (phase: PhaseNumber) => {
    set({ currentPhase: phase });
  },

  advancePhase: () => {
    const { currentPhase, canAdvanceToPhase } = get();
    const nextPhase = (currentPhase + 1) as PhaseNumber;

    if (nextPhase <= 4 && canAdvanceToPhase[nextPhase]) {
      set({ currentPhase: nextPhase });
      return true;
    }
    return false;
  },

  goToPhase: (phase: PhaseNumber) => {
    const { canAdvanceToPhase } = get();

    if (canAdvanceToPhase[phase]) {
      set({ currentPhase: phase });
      return true;
    }
    return false;
  },

  markPhaseComplete: (phase: PhaseNumber) => {
    set((state) => ({
      phaseProgress: {
        ...state.phaseProgress,
        [phase]: true,
      },
      canAdvanceToPhase: {
        ...state.canAdvanceToPhase,
        [phase + 1]:
          phase < 4
            ? true
            : state.canAdvanceToPhase[(phase + 1) as PhaseNumber],
      },
    }));
  },

  markPhaseIncomplete: (phase: PhaseNumber) => {
    set((state) => ({
      phaseProgress: {
        ...state.phaseProgress,
        [phase]: false,
      },
    }));
  },

  // Sherpa Opinion management
  updateSherpaOpinion: (updates: Partial<SherpaOpinion>) => {
    const currentOpinion = get().sherpaOpinion;
    if (currentOpinion) {
      set({
        sherpaOpinion: {
          ...currentOpinion,
          ...updates,
          lastUpdated: new Date().toISOString(),
        },
      });
    }
  },

  setSherpaOpinion: (opinion: SherpaOpinion) => {
    set({ sherpaOpinion: opinion });
  },

  // Phase-specific data management
  setPhase1Summary: (summary: string) => {
    set({ phase1Summary: summary });
  },

  addPhase2Insight: (insight: Insight) => {
    set((state) => ({
      phase2Insights: [...state.phase2Insights, insight],
    }));
  },

  updatePhase2Insight: (insightId: string, updates: Partial<Insight>) => {
    set((state) => ({
      phase2Insights: state.phase2Insights.map((insight) =>
        insight.id === insightId ? { ...insight, ...updates } : insight
      ),
    }));
  },

  removePhase2Insight: (insightId: string) => {
    set((state) => ({
      phase2Insights: state.phase2Insights.filter(
        (insight) => insight.id !== insightId
      ),
    }));
  },

  addPhase3EvidenceGroup: (group: EvidenceGroup) => {
    set((state) => ({
      phase3EvidenceGroups: [...state.phase3EvidenceGroups, group],
    }));
  },

  updatePhase3EvidenceGroup: (
    groupId: string,
    updates: Partial<EvidenceGroup>
  ) => {
    set((state) => ({
      phase3EvidenceGroups: state.phase3EvidenceGroups.map((group) =>
        group.id === groupId ? { ...group, ...updates } : group
      ),
    }));
  },

  removePhase3EvidenceGroup: (groupId: string) => {
    set((state) => ({
      phase3EvidenceGroups: state.phase3EvidenceGroups.filter(
        (group) => group.id !== groupId
      ),
    }));
  },

  addPhase4Action: (action: Action) => {
    set((state) => ({
      phase4Actions: [...state.phase4Actions, action],
    }));
  },

  updatePhase4Action: (actionId: string, updates: Partial<Action>) => {
    set((state) => ({
      phase4Actions: state.phase4Actions.map((action) =>
        action.id === actionId ? { ...action, ...updates } : action
      ),
    }));
  },

  removePhase4Action: (actionId: string) => {
    set((state) => ({
      phase4Actions: state.phase4Actions.filter(
        (action) => action.id !== actionId
      ),
    }));
  },

  reorderPhase4Actions: (actionIds: string[]) => {
    const { phase4Actions } = get();
    const reorderedActions = actionIds
      .map((id) => phase4Actions.find((action) => action.id === id))
      .filter(Boolean) as Action[];

    set({ phase4Actions: reorderedActions });
  },

  // Phase validation
  validatePhaseCompletion: (phase: PhaseNumber) => {
    const state = get();

    switch (phase) {
      case 0:
        return !!(
          state.sherpaOpinion && state.sherpaOpinion.userProfileInfluence
        );
      case 1:
        return !!(state.phase1Summary && state.sherpaOpinion);
      case 2:
        return (
          state.phase2Insights.length >= 5 && state.phase2Insights.length <= 7
        );
      case 3:
        return state.phase3EvidenceGroups.length > 0;
      case 4:
        return state.phase4Actions.length > 0;
      default:
        return false;
    }
  },

  getPhaseRequirements: (phase: PhaseNumber) => {
    return get().phaseCompletionRequirements[phase];
  },

  // Cross-phase content routing
  moveInsightToPhase3: (insightId: string) => {
    const insight = get().phase2Insights.find((i) => i.id === insightId);
    if (!insight) return;

    // Create evidence group from insight
    const evidenceGroup: EvidenceGroup = {
      id: `group_${insightId}`,
      heading: `Evidence: ${insight.content.substring(0, 50)}...`,
      insights: [insight],
      synthesizedContent: insight.content,
      confidence: insight.confidence,
    };

    get().addPhase3EvidenceGroup(evidenceGroup);
  },

  moveEvidenceToPhase4: (groupId: string) => {
    const evidenceGroup = get().phase3EvidenceGroups.find(
      (g) => g.id === groupId
    );
    if (!evidenceGroup) return;

    // Create action from evidence group
    const action: Action = {
      id: `action_${groupId}`,
      content: `Action based on: ${evidenceGroup.heading}`,
      priority: 1,
      urgency: 'medium',
      actionability: 'short_term',
      relatedGoals: [],
      evidenceSupport: [groupId],
      causalChain: {
        actionId: `action_${groupId}`,
        evidenceGroups: [groupId],
        reasoning: evidenceGroup.synthesizedContent,
        confidence: evidenceGroup.confidence,
      },
    };

    get().addPhase4Action(action);
  },
});
