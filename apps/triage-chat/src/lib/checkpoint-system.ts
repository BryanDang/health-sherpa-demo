/**
 * Checkpoint System for Privacy-Focused Session Continuity
 *
 * Provides export/import functionality for conversation sessions
 * with zero persistent storage. Users control their own data.
 */

import React from 'react';
import { PersistentMemory, ConversationGoal } from './conversation-memory';

export interface SessionCheckpoint {
  version: string;
  sessionId: string;
  createdAt: string;
  exportedAt: string;

  // Current session data
  currentSession: {
    goal?: ConversationGoal;
    messagesExchanged: number;
    duration: number; // minutes
    accomplishments: string[];
    outcomes: {
      careLevel?: string;
      providersFound?: number;
      questionsAnswered: number;
      nextSteps: string[];
    };
  };

  // Evolving user profile across sessions
  evolvingProfile: {
    totalSessions: number;
    totalMessagesAcrossSessions: number;
    preferredCommunicationStyle: string;
    commonConcerns: Array<{
      concern: string;
      frequency: number;
      lastMentioned: string;
    }>;
    successfulGoalTypes: string[];
    learnedPreferences: {
      informationDepth: 'brief' | 'moderate' | 'comprehensive';
      wantsProgressUpdates: boolean;
      prefersDirectAnswers: boolean;
      culturalConsiderations: string[];
    };
  };

  // Accumulated medical context (user controls this)
  medicalHistory: {
    chronicConditions: string[];
    medications: string[];
    allergies: string[];
    pastSymptoms: Array<{
      symptom: string;
      resolved: boolean;
      firstReported: string;
      lastMentioned: string;
      maxSeverity: number;
    }>;
    healthcareProviders: Array<{
      name: string;
      type: string;
      lastContact: string;
      satisfaction: 'high' | 'medium' | 'low';
    }>;
  };

  // Session accomplishments for continuity
  previousSessions: Array<{
    sessionId: string;
    date: string;
    goal: string;
    outcome: string;
    satisfaction: number; // 1-10
    keyAccomplishments: string[];
  }>;
}

export interface CheckpointImportResult {
  success: boolean;
  merged: SessionCheckpoint | null;
  newSessionData: PersistentMemory | null;
  warnings: string[];
  errors: string[];
}

class CheckpointManager {
  private static instance: CheckpointManager;

  static getInstance(): CheckpointManager {
    if (!CheckpointManager.instance) {
      CheckpointManager.instance = new CheckpointManager();
    }
    return CheckpointManager.instance;
  }

  /**
   * Create checkpoint from current session memory
   */
  createCheckpoint(
    memory: PersistentMemory,
    sessionDuration: number,
    accomplishments: string[],
    previousCheckpoint?: SessionCheckpoint
  ): SessionCheckpoint {
    const checkpoint: SessionCheckpoint = {
      version: '1.0.0',
      sessionId: memory.sessionId,
      createdAt: memory.lastUpdated,
      exportedAt: new Date().toISOString(),

      currentSession: {
        goal: memory.currentGoal,
        messagesExchanged: memory.sessionProgress.messagesExchanged,
        duration: sessionDuration,
        accomplishments,
        outcomes: {
          careLevel: this.inferCareLevel(memory),
          providersFound: memory.sessionProgress.providersContacted.length,
          questionsAnswered:
            memory.conversationSummary.questionsAnswered.length,
          nextSteps: memory.conversationSummary.recommendationsMade,
        },
      },

      evolvingProfile: this.mergeEvolvingProfile(memory, previousCheckpoint),
      medicalHistory: this.mergeMedicalHistory(memory, previousCheckpoint),
      previousSessions: this.addCurrentSession(
        memory,
        accomplishments,
        previousCheckpoint
      ),
    };

    return checkpoint;
  }

  /**
   * Import checkpoint and merge with previous data
   */
  importCheckpoint(
    checkpointData: string,
    currentMemory?: PersistentMemory
  ): CheckpointImportResult {
    const result: CheckpointImportResult = {
      success: false,
      merged: null,
      newSessionData: null,
      warnings: [],
      errors: [],
    };

    try {
      const checkpoint: SessionCheckpoint = JSON.parse(checkpointData);

      // Validate checkpoint format
      const validation = this.validateCheckpoint(checkpoint);
      if (!validation.isValid) {
        result.errors = validation.errors;
        return result;
      }

      // Create new session memory from checkpoint
      const newMemory = this.createMemoryFromCheckpoint(
        checkpoint,
        currentMemory?.sessionId
      );

      result.merged = checkpoint;
      result.newSessionData = newMemory;
      result.success = true;
      result.warnings = validation.warnings;

      return result;
    } catch (error) {
      result.errors.push(`Failed to parse checkpoint: ${error.message}`);
      return result;
    }
  }

  /**
   * Merge evolving profile data across sessions
   */
  private mergeEvolvingProfile(
    memory: PersistentMemory,
    previousCheckpoint?: SessionCheckpoint
  ) {
    const existing = previousCheckpoint?.evolvingProfile || {
      totalSessions: 0,
      totalMessagesAcrossSessions: 0,
      preferredCommunicationStyle: 'empathetic',
      commonConcerns: [],
      successfulGoalTypes: [],
      learnedPreferences: {
        informationDepth: 'moderate',
        wantsProgressUpdates: true,
        prefersDirectAnswers: false,
        culturalConsiderations: [],
      },
    };

    // Update with current session data
    const updatedProfile = {
      ...existing,
      totalSessions: existing.totalSessions + 1,
      totalMessagesAcrossSessions:
        existing.totalMessagesAcrossSessions +
        memory.sessionProgress.messagesExchanged,
      preferredCommunicationStyle: memory.userPreferences.communicationStyle,
    };

    // Add successful goal type if goal was completed
    if (memory.currentGoal?.isCompleted) {
      const goalType = memory.currentGoal.type;
      if (!updatedProfile.successfulGoalTypes.includes(goalType)) {
        updatedProfile.successfulGoalTypes.push(goalType);
      }
    }

    // Update learned preferences
    updatedProfile.learnedPreferences = {
      ...updatedProfile.learnedPreferences,
      informationDepth: memory.userPreferences.informationDepthPreference,
      culturalConsiderations: [
        ...new Set([
          ...updatedProfile.learnedPreferences.culturalConsiderations,
          ...memory.userPreferences.culturalConsiderations,
        ]),
      ],
    };

    return updatedProfile;
  }

  /**
   * Merge medical history across sessions
   */
  private mergeMedicalHistory(
    memory: PersistentMemory,
    previousCheckpoint?: SessionCheckpoint
  ) {
    const existing = previousCheckpoint?.medicalHistory || {
      chronicConditions: [],
      medications: [],
      allergies: [],
      pastSymptoms: [],
      healthcareProviders: [],
    };

    // Merge symptoms with deduplication
    const existingSymptoms = existing.pastSymptoms;
    const newSymptoms = memory.medicalProfile.reportedSymptoms.map(
      (symptom) => ({
        symptom: symptom.symptom,
        resolved: false, // Assume not resolved unless user indicates
        firstReported: symptom.firstMentioned,
        lastMentioned: new Date().toISOString(),
        maxSeverity: symptom.severity,
      })
    );

    const mergedSymptoms = [...existingSymptoms];
    newSymptoms.forEach((newSymptom) => {
      const existingIndex = mergedSymptoms.findIndex(
        (s) => s.symptom.toLowerCase() === newSymptom.symptom.toLowerCase()
      );

      if (existingIndex >= 0) {
        // Update existing symptom
        mergedSymptoms[existingIndex] = {
          ...mergedSymptoms[existingIndex],
          lastMentioned: newSymptom.lastMentioned,
          maxSeverity: Math.max(
            mergedSymptoms[existingIndex].maxSeverity,
            newSymptom.maxSeverity
          ),
        };
      } else {
        // Add new symptom
        mergedSymptoms.push(newSymptom);
      }
    });

    return {
      chronicConditions: [
        ...new Set([
          ...existing.chronicConditions,
          ...memory.medicalProfile.medicalHistory,
        ]),
      ],
      medications: [
        ...new Set([
          ...existing.medications,
          ...memory.medicalProfile.currentMedications,
        ]),
      ],
      allergies: [
        ...new Set([...existing.allergies, ...memory.medicalProfile.allergies]),
      ],
      pastSymptoms: mergedSymptoms,
      healthcareProviders: existing.healthcareProviders, // TODO: Merge from provider search results
    };
  }

  /**
   * Add current session to previous sessions list
   */
  private addCurrentSession(
    memory: PersistentMemory,
    accomplishments: string[],
    previousCheckpoint?: SessionCheckpoint
  ) {
    const previousSessions = previousCheckpoint?.previousSessions || [];

    const currentSessionSummary = {
      sessionId: memory.sessionId,
      date: memory.lastUpdated,
      goal: memory.currentGoal?.description || 'General health inquiry',
      outcome: this.summarizeOutcome(memory),
      satisfaction: this.calculateSatisfaction(memory), // Simple heuristic
      keyAccomplishments: accomplishments,
    };

    return [...previousSessions, currentSessionSummary].slice(-10); // Keep last 10 sessions
  }

  /**
   * Create memory object from imported checkpoint
   */
  private createMemoryFromCheckpoint(
    checkpoint: SessionCheckpoint,
    newSessionId?: string
  ): PersistentMemory {
    return {
      userId: 'user_demo', // TODO: Get from auth
      sessionId:
        newSessionId ||
        `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

      medicalProfile: {
        reportedSymptoms: [], // Start fresh for new session
        medicalHistory: checkpoint.medicalHistory.chronicConditions,
        currentMedications: checkpoint.medicalHistory.medications,
        allergies: checkpoint.medicalHistory.allergies,
      },

      conversationSummary: {
        keyPoints: [
          `Imported from previous session: ${checkpoint.currentSession.accomplishments.join(', ')}`,
        ],
        establishedFacts: [],
        questionsAsked: [],
        questionsAnswered: [],
        recommendationsMade: [],
      },

      userPreferences: {
        communicationStyle: checkpoint.evolvingProfile
          .preferredCommunicationStyle as any,
        preferredLanguage: 'en',
        culturalConsiderations:
          checkpoint.evolvingProfile.learnedPreferences.culturalConsiderations,
        informationDepthPreference:
          checkpoint.evolvingProfile.learnedPreferences.informationDepth,
      },

      sessionProgress: {
        messagesExchanged: 0,
        topicsDiscussed: [],
        toolsUsed: [],
        documentsShared: [],
        providersContacted: [],
      },

      lastUpdated: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };
  }

  /**
   * Export checkpoint as downloadable file
   */
  exportAsFile(checkpoint: SessionCheckpoint, filename?: string): void {
    const data = JSON.stringify(checkpoint, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download =
      filename ||
      `health-checkpoint-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Export checkpoint as copyable text
   */
  exportAsText(checkpoint: SessionCheckpoint): string {
    return `Health Checkpoint - ${new Date().toLocaleDateString()}

SESSIONS: ${checkpoint.evolvingProfile.totalSessions}
GOAL: ${checkpoint.currentSession.goal?.description || 'General inquiry'}
ACCOMPLISHED: ${checkpoint.currentSession.accomplishments.join(', ')}

DATA:
${JSON.stringify(checkpoint, null, 2)}

To resume this conversation, copy this entire message and import it in your next session.`;
  }

  /**
   * Validate checkpoint format
   */
  private validateCheckpoint(checkpoint: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!checkpoint.version) errors.push('Missing version');
    if (!checkpoint.sessionId) errors.push('Missing sessionId');
    if (!checkpoint.currentSession) errors.push('Missing currentSession data');
    if (!checkpoint.evolvingProfile)
      errors.push('Missing evolvingProfile data');

    // Version compatibility check
    if (checkpoint.version && checkpoint.version !== '1.0.0') {
      warnings.push(
        `Checkpoint version ${checkpoint.version} may not be fully compatible`
      );
    }

    // Data freshness check
    if (checkpoint.exportedAt) {
      const exported = new Date(checkpoint.exportedAt);
      const daysSinceExport =
        (Date.now() - exported.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceExport > 30) {
        warnings.push(`Checkpoint is ${Math.round(daysSinceExport)} days old`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Helper methods
  private inferCareLevel(memory: PersistentMemory): string | undefined {
    if (memory.emergencyState?.active) {
      return memory.emergencyState.level;
    }
    return undefined;
  }

  private summarizeOutcome(memory: PersistentMemory): string {
    if (memory.emergencyState?.active) {
      return `Emergency level: ${memory.emergencyState.level}`;
    }
    if (memory.sessionProgress.providersContacted.length > 0) {
      return `Found ${memory.sessionProgress.providersContacted.length} healthcare providers`;
    }
    if (memory.conversationSummary.recommendationsMade.length > 0) {
      return `Received care recommendations`;
    }
    return 'General health guidance provided';
  }

  private calculateSatisfaction(memory: PersistentMemory): number {
    // Simple heuristic based on session progress
    let score = 5; // Base satisfaction

    if (memory.currentGoal?.isCompleted) score += 3;
    if (memory.sessionProgress.providersContacted.length > 0) score += 2;
    if (memory.conversationSummary.recommendationsMade.length > 0) score += 1;
    if (memory.sessionProgress.messagesExchanged > 5) score += 1;

    return Math.min(10, score);
  }
}

// Export singleton instance
export const checkpointManager = CheckpointManager.getInstance();

// React hooks for checkpoint functionality
export function useCheckpointExport() {
  const [isExporting, setIsExporting] = React.useState(false);

  const exportCheckpoint = React.useCallback(
    async (
      memory: PersistentMemory,
      sessionDuration: number,
      accomplishments: string[],
      previousCheckpoint?: SessionCheckpoint,
      format: 'file' | 'text' = 'file'
    ) => {
      setIsExporting(true);
      try {
        const checkpoint = checkpointManager.createCheckpoint(
          memory,
          sessionDuration,
          accomplishments,
          previousCheckpoint
        );

        if (format === 'file') {
          checkpointManager.exportAsFile(checkpoint);
        } else {
          const text = checkpointManager.exportAsText(checkpoint);
          await navigator.clipboard.writeText(text);
          return text;
        }

        return checkpoint;
      } finally {
        setIsExporting(false);
      }
    },
    []
  );

  return { exportCheckpoint, isExporting };
}

export function useCheckpointImport() {
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] =
    React.useState<CheckpointImportResult | null>(null);

  const importCheckpoint = React.useCallback(
    async (checkpointData: string, currentMemory?: PersistentMemory) => {
      setIsImporting(true);
      try {
        const result = checkpointManager.importCheckpoint(
          checkpointData,
          currentMemory
        );
        setImportResult(result);
        return result;
      } finally {
        setIsImporting(false);
      }
    },
    []
  );

  const clearImportResult = React.useCallback(() => {
    setImportResult(null);
  }, []);

  return { importCheckpoint, isImporting, importResult, clearImportResult };
}
