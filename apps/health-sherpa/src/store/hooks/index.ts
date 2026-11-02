/**
 * Typed hooks for accessing specific slices of the store
 * This provides better type safety and cleaner component code
 */

import { useAppStore } from '../index';
import type {
  ChatSlice,
  DocumentSlice,
  PhaseSlice,
  ProfileSlice,
  UISlice,
  TokenSlice,
} from '../index';

// Chat state hooks
export const useChatState = () => {
  return useAppStore((state: ChatSlice) => ({
    currentSession: state.currentSession,
    sessions: state.sessions,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    createSession: state.createSession,
    setCurrentSession: state.setCurrentSession,
    addMessage: state.addMessage,
    updateMessage: state.updateMessage,
    clearCurrentSession: state.clearCurrentSession,
    deleteSession: state.deleteSession,
    setLoading: state.setLoading,
    setError: state.setError,
    getMessagesForPhase: state.getMessagesForPhase,
    moveMessageToPhase: state.moveMessageToPhase,
  }));
};

// Document state hooks
export const useDocumentState = () => {
  return useAppStore((state: DocumentSlice) => ({
    activeDocument: state.activeDocument,
    uploadedDocuments: state.uploadedDocuments,
    processingStatus: state.processingStatus,
    isUploading: state.isUploading,
    uploadProgress: state.uploadProgress,
    error: state.error,

    // Actions
    uploadDocument: state.uploadDocument,
    setActiveDocument: state.setActiveDocument,
    updateDocument: state.updateDocument,
    removeDocument: state.removeDocument,
    setProcessingStatus: state.setProcessingStatus,
    setUploadProgress: state.setUploadProgress,
    setUploading: state.setUploading,
    setError: state.setError,
    clearActiveDocument: state.clearActiveDocument,
    deidentifyDocument: state.deidentifyDocument,
    generateLineNumbers: state.generateLineNumbers,
    markAnalysisComplete: state.markAnalysisComplete,
  }));
};

// Phase state hooks
export const usePhaseState = () => {
  return useAppStore((state: PhaseSlice) => ({
    currentPhase: state.currentPhase,
    phaseProgress: state.phaseProgress,
    sherpaOpinion: state.sherpaOpinion,
    phase1Summary: state.phase1Summary,
    phase2Insights: state.phase2Insights,
    phase3EvidenceGroups: state.phase3EvidenceGroups,
    phase4Actions: state.phase4Actions,
    canAdvanceToPhase: state.canAdvanceToPhase,
    phaseCompletionRequirements: state.phaseCompletionRequirements,

    // Actions
    setCurrentPhase: state.setCurrentPhase,
    advancePhase: state.advancePhase,
    goToPhase: state.goToPhase,
    markPhaseComplete: state.markPhaseComplete,
    markPhaseIncomplete: state.markPhaseIncomplete,
    updateSherpaOpinion: state.updateSherpaOpinion,
    setSherpaOpinion: state.setSherpaOpinion,
    setPhase1Summary: state.setPhase1Summary,
    addPhase2Insight: state.addPhase2Insight,
    updatePhase2Insight: state.updatePhase2Insight,
    removePhase2Insight: state.removePhase2Insight,
    addPhase3EvidenceGroup: state.addPhase3EvidenceGroup,
    updatePhase3EvidenceGroup: state.updatePhase3EvidenceGroup,
    removePhase3EvidenceGroup: state.removePhase3EvidenceGroup,
    addPhase4Action: state.addPhase4Action,
    updatePhase4Action: state.updatePhase4Action,
    removePhase4Action: state.removePhase4Action,
    reorderPhase4Actions: state.reorderPhase4Actions,
    validatePhaseCompletion: state.validatePhaseCompletion,
    getPhaseRequirements: state.getPhaseRequirements,
    moveInsightToPhase3: state.moveInsightToPhase3,
    moveEvidenceToPhase4: state.moveEvidenceToPhase4,
  }));
};

// Profile state hooks
export const useProfileState = () => {
  return useAppStore((state: ProfileSlice) => ({
    userProfile: state.userProfile,
    isProfileComplete: state.isProfileComplete,
    profileEvolutionHistory: state.profileEvolutionHistory,

    // Actions
    createProfile: state.createProfile,
    updateProfile: state.updateProfile,
    setRole: state.setRole,
    addGoal: state.addGoal,
    removeGoal: state.removeGoal,
    updateGoal: state.updateGoal,
    setExpertiseLevel: state.setExpertiseLevel,
    setCommunicationStyle: state.setCommunicationStyle,
    updateMirroringCues: state.updateMirroringCues,
    addAdditionalContext: state.addAdditionalContext,
    addOtherParty: state.addOtherParty,
    removeOtherParty: state.removeOtherParty,
    evolveProfile: state.evolveProfile,
    getProfileEvolution: state.getProfileEvolution,
    generateExportableProfile: state.generateExportableProfile,
    generateInternalProfile: state.generateInternalProfile,
    validateProfileCompletion: state.validateProfileCompletion,
    getIncompleteFields: state.getIncompleteFields,
  }));
};

// UI state hooks
export const useUIState = () => {
  return useAppStore((state: UISlice) => ({
    isProviderMode: state.isProviderMode,
    currentAccordionSection: state.currentAccordionSection,
    notificationTokens: state.notificationTokens,
    isLoading: state.isLoading,
    error: state.error,
    isPrivacyModalOpen: state.isPrivacyModalOpen,
    isExportModalOpen: state.isExportModalOpen,
    isUploadModalOpen: state.isUploadModalOpen,
    sidebarCollapsed: state.sidebarCollapsed,
    theme: state.theme,
    phaseCanvasVisible: state.phaseCanvasVisible,
    insightsPaneVisible: state.insightsPaneVisible,
    showProgressIndicator: state.showProgressIndicator,
    progressMessage: state.progressMessage,

    // Actions
    toggleProviderMode: state.toggleProviderMode,
    setProviderMode: state.setProviderMode,
    setCurrentAccordionSection: state.setCurrentAccordionSection,
    toggleAccordionSection: state.toggleAccordionSection,
    addNotificationToken: state.addNotificationToken,
    clearNotificationTokens: state.clearNotificationTokens,
    clearAllNotificationTokens: state.clearAllNotificationTokens,
    getNotificationCount: state.getNotificationCount,
    openPrivacyModal: state.openPrivacyModal,
    closePrivacyModal: state.closePrivacyModal,
    openExportModal: state.openExportModal,
    closeExportModal: state.closeExportModal,
    openUploadModal: state.openUploadModal,
    closeUploadModal: state.closeUploadModal,
    closeAllModals: state.closeAllModals,
    toggleSidebar: state.toggleSidebar,
    setSidebarCollapsed: state.setSidebarCollapsed,
    setTheme: state.setTheme,
    showPhaseCanvas: state.showPhaseCanvas,
    hidePhaseCanvas: state.hidePhaseCanvas,
    togglePhaseCanvas: state.togglePhaseCanvas,
    showInsightsPane: state.showInsightsPane,
    hideInsightsPane: state.hideInsightsPane,
    toggleInsightsPane: state.toggleInsightsPane,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    showProgress: state.showProgress,
    hideProgress: state.hideProgress,
    updateProgressMessage: state.updateProgressMessage,
  }));
};

// Token state hooks
export const useTokenState = () => {
  return useAppStore((state: TokenSlice) => ({
    sessionInputTokens: state.sessionInputTokens,
    sessionOutputTokens: state.sessionOutputTokens,
    sessionTotalTokens: state.sessionTotalTokens,
    sessionCost: state.sessionCost,
    tokenLimit: state.tokenLimit,
    warningThreshold: state.warningThreshold,
    apiCalls: state.apiCalls,

    // Actions
    addTokenUsage: state.addTokenUsage,
    resetSession: state.resetSession,
    getUsagePercentage: state.getUsagePercentage,
    isNearLimit: state.isNearLimit,
    getCurrentUsage: state.getCurrentUsage,
  }));
};

// Convenience hooks for common combinations
export const usePhaseAndUI = () => {
  const phaseState = usePhaseState();
  const uiState = useUIState();

  return {
    ...phaseState,
    ...uiState,
  };
};

export const useChatAndPhase = () => {
  const chatState = useChatState();
  const phaseState = usePhaseState();

  return {
    ...chatState,
    ...phaseState,
  };
};

export const useDocumentAndPhase = () => {
  const documentState = useDocumentState();
  const phaseState = usePhaseState();

  return {
    ...documentState,
    ...phaseState,
  };
};
