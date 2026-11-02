import { StateCreator } from 'zustand';
import {
  UserProfile,
  UserRole,
  ExpertiseLevel,
  CommunicationStyle,
  MirroringCues,
  ProfileUpdate,
} from '@/types/core';

export interface ProfileSlice {
  // State
  userProfile: UserProfile | null;
  isProfileComplete: boolean;
  profileEvolutionHistory: ProfileUpdate[];

  // Actions
  createProfile: (
    role: UserRole,
    goals: string[],
    expertiseLevel?: ExpertiseLevel
  ) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setRole: (role: UserRole) => void;
  addGoal: (goal: string) => void;
  removeGoal: (goalIndex: number) => void;
  updateGoal: (goalIndex: number, newGoal: string) => void;
  setExpertiseLevel: (level: ExpertiseLevel) => void;
  setCommunicationStyle: (style: CommunicationStyle) => void;
  updateMirroringCues: (cues: Partial<MirroringCues>) => void;
  addAdditionalContext: (context: string) => void;
  addOtherParty: (party: string) => void;
  removeOtherParty: (partyIndex: number) => void;

  // Profile evolution
  evolveProfile: (
    field: keyof UserProfile,
    oldValue: any,
    newValue: any
  ) => void;
  getProfileEvolution: () => ProfileUpdate[];

  // Export functionality
  generateExportableProfile: () => string;
  generateInternalProfile: () => string;

  // Validation
  validateProfileCompletion: () => boolean;
  getIncompleteFields: () => string[];
}

export const createProfileSlice: StateCreator<
  ProfileSlice,
  [],
  [],
  ProfileSlice
> = (set, get) => ({
  // Initial state
  userProfile: null,
  isProfileComplete: false,
  profileEvolutionHistory: [],

  // Actions
  createProfile: (
    role: UserRole,
    goals: string[],
    expertiseLevel: ExpertiseLevel = 'novice'
  ) => {
    const newProfile: UserProfile = {
      role,
      goals,
      otherPartiesInvolved: [],
      expertiseLevel,
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
    };

    set({
      userProfile: newProfile,
      isProfileComplete: get().validateProfileCompletion(),
    });
  },

  updateProfile: (updates: Partial<UserProfile>) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    // Track all changes for evolution history
    Object.entries(updates).forEach(([field, newValue]) => {
      const oldValue = currentProfile[field as keyof UserProfile];
      if (oldValue !== newValue) {
        get().evolveProfile(field as keyof UserProfile, oldValue, newValue);
      }
    });

    const updatedProfile = {
      ...currentProfile,
      ...updates,
      profileUpdates: [
        ...currentProfile.profileUpdates,
        {
          timestamp: new Date().toISOString(),
          field: 'multiple',
          oldValue: 'various',
          newValue: 'updated',
        },
      ],
    };

    set({
      userProfile: updatedProfile,
      isProfileComplete: get().validateProfileCompletion(),
    });
  },

  setRole: (role: UserRole) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    get().evolveProfile('role', currentProfile.role, role);
    get().updateProfile({ role });
  },

  addGoal: (goal: string) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    const newGoals = [...currentProfile.goals, goal];
    get().updateProfile({ goals: newGoals });
  },

  removeGoal: (goalIndex: number) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    const newGoals = currentProfile.goals.filter(
      (_, index) => index !== goalIndex
    );
    get().updateProfile({ goals: newGoals });
  },

  updateGoal: (goalIndex: number, newGoal: string) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    const newGoals = currentProfile.goals.map((goal, index) =>
      index === goalIndex ? newGoal : goal
    );
    get().updateProfile({ goals: newGoals });
  },

  setExpertiseLevel: (level: ExpertiseLevel) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    get().evolveProfile('expertiseLevel', currentProfile.expertiseLevel, level);
    get().updateProfile({ expertiseLevel: level });
  },

  setCommunicationStyle: (style: CommunicationStyle) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    get().evolveProfile(
      'communicationStyle',
      currentProfile.communicationStyle,
      style
    );
    get().updateProfile({ communicationStyle: style });
  },

  updateMirroringCues: (cues: Partial<MirroringCues>) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    const updatedCues = {
      ...currentProfile.mirroringCues,
      ...cues,
    };

    get().updateProfile({ mirroringCues: updatedCues });
  },

  addAdditionalContext: (context: string) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    const newContext = [...currentProfile.additionalContext, context];
    get().updateProfile({ additionalContext: newContext });
  },

  addOtherParty: (party: string) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    const newParties = [...currentProfile.otherPartiesInvolved, party];
    get().updateProfile({ otherPartiesInvolved: newParties });
  },

  removeOtherParty: (partyIndex: number) => {
    const currentProfile = get().userProfile;
    if (!currentProfile) return;

    const newParties = currentProfile.otherPartiesInvolved.filter(
      (_, index) => index !== partyIndex
    );
    get().updateProfile({ otherPartiesInvolved: newParties });
  },

  // Profile evolution
  evolveProfile: (field: keyof UserProfile, oldValue: any, newValue: any) => {
    const update: ProfileUpdate = {
      timestamp: new Date().toISOString(),
      field: field.toString(),
      oldValue,
      newValue,
    };

    set((state) => ({
      profileEvolutionHistory: [...state.profileEvolutionHistory, update],
    }));
  },

  getProfileEvolution: () => {
    return get().profileEvolutionHistory;
  },

  // Export functionality
  generateExportableProfile: () => {
    const profile = get().userProfile;
    if (!profile) return '';

    const exportableData = {
      role: profile.role,
      goals: profile.goals,
      expertiseLevel: profile.expertiseLevel,
      communicationPreferences: {
        style: profile.communicationStyle,
        preferredTone: profile.mirroringCues.emotionalTone,
      },
      contextualInformation: profile.additionalContext,
      involvedParties: profile.otherPartiesInvolved,
    };

    return JSON.stringify(exportableData, null, 2);
  },

  generateInternalProfile: () => {
    const profile = get().userProfile;
    if (!profile) return '';

    // Base64 encode the full profile for system continuity
    const internalData = JSON.stringify(profile);
    return btoa(internalData);
  },

  // Validation
  validateProfileCompletion: () => {
    const profile = get().userProfile;
    if (!profile) return false;

    const requiredFields = [
      profile.role,
      profile.goals.length > 0,
      profile.expertiseLevel,
      profile.communicationStyle,
    ];

    return requiredFields.every(Boolean);
  },

  getIncompleteFields: () => {
    const profile = get().userProfile;
    if (!profile) return ['All fields'];

    const incompleteFields: string[] = [];

    if (!profile.role) incompleteFields.push('Role');
    if (profile.goals.length === 0) incompleteFields.push('Goals');
    if (!profile.expertiseLevel) incompleteFields.push('Expertise Level');
    if (!profile.communicationStyle)
      incompleteFields.push('Communication Style');

    return incompleteFields;
  },
});
