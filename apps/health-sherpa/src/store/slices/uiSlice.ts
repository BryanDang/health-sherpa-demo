import { StateCreator } from 'zustand';

export type AccordionSection =
  | 'clinical-summary'
  | 'gathered-insights'
  | 'synthesized-evidence'
  | 'prioritized-actions'
  | null;

export interface NotificationTokens {
  'clinical-summary': number;
  'gathered-insights': number;
  'synthesized-evidence': number;
  'prioritized-actions': number;
}

export interface UISlice {
  // State
  isProviderMode: boolean;
  currentAccordionSection: AccordionSection;
  notificationTokens: NotificationTokens;
  isLoading: boolean;
  error: string | null;

  // Modal and dialog states
  isPrivacyModalOpen: boolean;
  isExportModalOpen: boolean;
  isUploadModalOpen: boolean;

  // Layout and display preferences
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';

  // Phase-specific UI state
  phaseCanvasVisible: boolean;
  insightsPaneVisible: boolean;

  // Progress indicators
  showProgressIndicator: boolean;
  progressMessage: string;

  // Actions
  toggleProviderMode: () => void;
  setProviderMode: (enabled: boolean) => void;

  // Accordion management
  setCurrentAccordionSection: (section: AccordionSection) => void;
  toggleAccordionSection: (section: AccordionSection) => void;

  // Notification management
  addNotificationToken: (
    section: keyof NotificationTokens,
    count?: number
  ) => void;
  clearNotificationTokens: (section: keyof NotificationTokens) => void;
  clearAllNotificationTokens: () => void;
  getNotificationCount: (section: keyof NotificationTokens) => number;

  // Modal management
  openPrivacyModal: () => void;
  closePrivacyModal: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  openUploadModal: () => void;
  closeUploadModal: () => void;
  closeAllModals: () => void;

  // Layout management
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Phase UI management
  showPhaseCanvas: () => void;
  hidePhaseCanvas: () => void;
  togglePhaseCanvas: () => void;
  showInsightsPane: () => void;
  hideInsightsPane: () => void;
  toggleInsightsPane: () => void;

  // Loading and error states
  setLoading: (loading: boolean, message?: string) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Progress indicators
  showProgress: (message: string) => void;
  hideProgress: () => void;
  updateProgressMessage: (message: string) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (
  set,
  get
) => ({
  // Initial state
  isProviderMode: false,
  currentAccordionSection: null,
  notificationTokens: {
    'clinical-summary': 0,
    'gathered-insights': 0,
    'synthesized-evidence': 0,
    'prioritized-actions': 0,
  },
  isLoading: false,
  error: null,

  // Modal and dialog states
  isPrivacyModalOpen: false,
  isExportModalOpen: false,
  isUploadModalOpen: false,

  // Layout and display preferences
  sidebarCollapsed: false,
  theme: 'system',

  // Phase-specific UI state
  phaseCanvasVisible: true,
  insightsPaneVisible: true,

  // Progress indicators
  showProgressIndicator: false,
  progressMessage: '',

  // Actions
  toggleProviderMode: () => {
    set((state) => ({ isProviderMode: !state.isProviderMode }));
  },

  setProviderMode: (enabled: boolean) => {
    set({ isProviderMode: enabled });
  },

  // Accordion management
  setCurrentAccordionSection: (section: AccordionSection) => {
    set({ currentAccordionSection: section });

    // Clear notification tokens for the opened section
    if (section) {
      get().clearNotificationTokens(section);
    }
  },

  toggleAccordionSection: (section: AccordionSection) => {
    const { currentAccordionSection } = get();
    const newSection = currentAccordionSection === section ? null : section;
    get().setCurrentAccordionSection(newSection);
  },

  // Notification management
  addNotificationToken: (
    section: keyof NotificationTokens,
    count: number = 1
  ) => {
    set((state) => ({
      notificationTokens: {
        ...state.notificationTokens,
        [section]: state.notificationTokens[section] + count,
      },
    }));
  },

  clearNotificationTokens: (section: keyof NotificationTokens) => {
    set((state) => ({
      notificationTokens: {
        ...state.notificationTokens,
        [section]: 0,
      },
    }));
  },

  clearAllNotificationTokens: () => {
    set({
      notificationTokens: {
        'clinical-summary': 0,
        'gathered-insights': 0,
        'synthesized-evidence': 0,
        'prioritized-actions': 0,
      },
    });
  },

  getNotificationCount: (section: keyof NotificationTokens) => {
    return get().notificationTokens[section];
  },

  // Modal management
  openPrivacyModal: () => {
    set({ isPrivacyModalOpen: true });
  },

  closePrivacyModal: () => {
    set({ isPrivacyModalOpen: false });
  },

  openExportModal: () => {
    set({ isExportModalOpen: true });
  },

  closeExportModal: () => {
    set({ isExportModalOpen: false });
  },

  openUploadModal: () => {
    set({ isUploadModalOpen: true });
  },

  closeUploadModal: () => {
    set({ isUploadModalOpen: false });
  },

  closeAllModals: () => {
    set({
      isPrivacyModalOpen: false,
      isExportModalOpen: false,
      isUploadModalOpen: false,
    });
  },

  // Layout management
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed });
  },

  setTheme: (theme: 'light' | 'dark' | 'system') => {
    set({ theme });
  },

  // Phase UI management
  showPhaseCanvas: () => {
    set({ phaseCanvasVisible: true });
  },

  hidePhaseCanvas: () => {
    set({ phaseCanvasVisible: false });
  },

  togglePhaseCanvas: () => {
    set((state) => ({ phaseCanvasVisible: !state.phaseCanvasVisible }));
  },

  showInsightsPane: () => {
    set({ insightsPaneVisible: true });
  },

  hideInsightsPane: () => {
    set({ insightsPaneVisible: false });
  },

  toggleInsightsPane: () => {
    set((state) => ({ insightsPaneVisible: !state.insightsPaneVisible }));
  },

  // Loading and error states
  setLoading: (loading: boolean, message?: string) => {
    set({
      isLoading: loading,
      progressMessage: message || '',
      showProgressIndicator: loading && !!message,
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  // Progress indicators
  showProgress: (message: string) => {
    set({
      showProgressIndicator: true,
      progressMessage: message,
    });
  },

  hideProgress: () => {
    set({
      showProgressIndicator: false,
      progressMessage: '',
    });
  },

  updateProgressMessage: (message: string) => {
    set({ progressMessage: message });
  },
});
