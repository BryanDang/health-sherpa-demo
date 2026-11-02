import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ChatSlice, createChatSlice } from './slices/chatSlice';
import { DocumentSlice, createDocumentSlice } from './slices/documentSlice';
import { PhaseSlice, createPhaseSlice } from './slices/phaseSlice';
import { ProfileSlice, createProfileSlice } from './slices/profileSlice';
import { TokenSlice, createTokenSlice } from './slices/tokenSlice';
import { UISlice, createUISlice } from './slices/uiSlice';

// Combined store type
export type AppStore = ChatSlice &
  DocumentSlice &
  PhaseSlice &
  ProfileSlice &
  TokenSlice &
  UISlice;

// Create the main store with all slices - SSR safe
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createChatSlice(...args),
        ...createDocumentSlice(...args),
        ...createPhaseSlice(...args),
        ...createProfileSlice(...args),
        ...createTokenSlice(...args),
        ...createUISlice(...args),
      }),
      {
        name: 'health-sherpa-store',
        // SSR configuration
        skipHydration: true,
        // Only persist certain parts of the state
        partialize: (state) => ({
          // Chat state (except current session loading states)
          sessions: state.sessions,

          // Document state (except upload progress)
          uploadedDocuments: state.uploadedDocuments,
          activeDocument: state.activeDocument,

          // Phase state
          currentPhase: state.currentPhase,
          phaseProgress: state.phaseProgress,
          sherpaOpinion: state.sherpaOpinion,
          phase1Summary: state.phase1Summary,
          phase2Insights: state.phase2Insights,
          phase3EvidenceGroups: state.phase3EvidenceGroups,
          phase4Actions: state.phase4Actions,

          // Profile state
          userProfile: state.userProfile,
          profileEvolutionHistory: state.profileEvolutionHistory,

          // UI preferences (not modal states)
          isProviderMode: state.isProviderMode,
          sidebarCollapsed: state.sidebarCollapsed,
          theme: state.theme,
        }),
      }
    ),
    {
      name: 'health-sherpa-store',
    }
  )
);

// SSR-safe hook wrapper
export const createSSRSafeStore = () => {
  if (typeof window === 'undefined') {
    // Server-side: return a temporary store
    return create<AppStore>()((...args) => ({
      ...createChatSlice(...args),
      ...createDocumentSlice(...args),
      ...createPhaseSlice(...args),
      ...createProfileSlice(...args),
      ...createTokenSlice(...args),
      ...createUISlice(...args),
    }));
  }

  // Client-side: return the real store
  return useAppStore;
};

// Utility function to reset the entire store
export const resetStore = () => {
  useAppStore.setState({
    // Reset chat state
    currentSession: null,
    sessions: [],
    isLoading: false,
    error: null,

    // Reset document state
    activeDocument: null,
    uploadedDocuments: [],
    processingStatus: 'uploaded',
    isUploading: false,
    uploadProgress: 0,

    // Reset phase state
    currentPhase: 0,
    phaseProgress: { 0: false, 1: false, 2: false, 3: false, 4: false },
    sherpaOpinion: null,
    phase1Summary: null,
    phase2Insights: [],
    phase3EvidenceGroups: [],
    phase4Actions: [],
    canAdvanceToPhase: { 0: false, 1: false, 2: false, 3: false, 4: false },

    // Reset profile state
    userProfile: null,
    isProfileComplete: false,
    profileEvolutionHistory: [],

    // Reset UI state
    isProviderMode: false,
    currentAccordionSection: null,
    notificationTokens: {
      'clinical-summary': 0,
      'gathered-insights': 0,
      'synthesized-evidence': 0,
      'prioritized-actions': 0,
    },
    isPrivacyModalOpen: false,
    isExportModalOpen: false,
    isUploadModalOpen: false,
    phaseCanvasVisible: true,
    insightsPaneVisible: true,
    showProgressIndicator: false,
    progressMessage: '',
  });
};

// Export individual slice types for component usage
export type {
  ChatSlice,
  DocumentSlice,
  PhaseSlice,
  ProfileSlice,
  TokenSlice,
  UISlice,
};
