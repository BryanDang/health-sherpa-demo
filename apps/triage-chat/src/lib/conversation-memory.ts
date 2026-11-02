/**
 * Conversation Memory System
 *
 * Provides persistent storage and retrieval of conversation context,
 * user goals, and medical information beyond the 10-message limit
 */

import React from 'react';

export interface ConversationGoal {
  id: string;
  description: string;
  type:
    | 'understand_symptoms'
    | 'emergency_guidance'
    | 'find_providers'
    | 'prepare_visit'
    | 'custom';
  isCompleted: boolean;
  progress: number; // 0-100
  subGoals: string[];
  completedSubGoals: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PersistentMemory {
  userId: string;
  sessionId: string;
  currentGoal?: ConversationGoal;

  // Medical context that persists
  medicalProfile: {
    reportedSymptoms: Array<{
      symptom: string;
      severity: number;
      duration: string;
      location?: string;
      firstMentioned: string;
    }>;
    medicalHistory: string[];
    currentMedications: string[];
    allergies: string[];
    emergencyContact?: string;
  };

  // Conversation context
  conversationSummary: {
    keyPoints: string[];
    establishedFacts: Array<{
      fact: string;
      confidence: 'high' | 'medium' | 'low';
      timestamp: string;
    }>;
    questionsAsked: string[];
    questionsAnswered: string[];
    recommendationsMade: string[];
    messageHistory: Array<{
      type: 'user' | 'assistant';
      content: string;
      timestamp: string;
      careLevel?: string;
      reasoning?: any;
    }>;
  };

  // User preferences learned over time
  userPreferences: {
    communicationStyle: 'direct' | 'detailed' | 'empathetic' | 'technical';
    preferredLanguage: string;
    culturalConsiderations: string[];
    informationDepthPreference: 'brief' | 'moderate' | 'comprehensive';
  };

  // Progress tracking
  sessionProgress: {
    messagesExchanged: number;
    topicsDiscussed: string[];
    toolsUsed: string[];
    documentsShared: string[];
    providersContacted: string[];
  };

  lastUpdated: string;
  expiresAt: string;
}

class ConversationMemoryManager {
  private static instance: ConversationMemoryManager;
  private memoryCache: Map<string, PersistentMemory> = new Map();

  static getInstance(): ConversationMemoryManager {
    if (!ConversationMemoryManager.instance) {
      ConversationMemoryManager.instance = new ConversationMemoryManager();
    }
    return ConversationMemoryManager.instance;
  }

  /**
   * Initialize memory for a new conversation
   */
  async initializeMemory(
    userId: string,
    sessionId: string,
    goal?: ConversationGoal
  ): Promise<PersistentMemory> {
    const existingMemory = await this.getMemory(userId);

    const memory: PersistentMemory = {
      userId,
      sessionId,
      currentGoal: goal,
      medicalProfile: existingMemory?.medicalProfile || {
        reportedSymptoms: [],
        medicalHistory: [],
        currentMedications: [],
        allergies: [],
      },
      conversationSummary: {
        keyPoints: [],
        establishedFacts: [],
        questionsAsked: [],
        questionsAnswered: [],
        recommendationsMade: [],
        messageHistory: [],
      },
      userPreferences: existingMemory?.userPreferences || {
        communicationStyle: 'empathetic',
        preferredLanguage: 'en',
        culturalConsiderations: [],
        informationDepthPreference: 'moderate',
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

    await this.saveMemory(memory);
    return memory;
  }

  /**
   * Get memory for a user (session-only, using sessionStorage for persistence during browser session)
   */
  async getMemory(userId: string): Promise<PersistentMemory | null> {
    // Check in-memory cache first
    const cached = this.memoryCache.get(userId);
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return cached;
    }

    // Check sessionStorage for browser session persistence
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`conversation_memory_${userId}`);
        if (stored) {
          const memory: PersistentMemory = JSON.parse(stored);
          if (new Date(memory.expiresAt) > new Date()) {
            // Restore to in-memory cache
            this.memoryCache.set(userId, memory);
            return memory;
          }
        }
      } catch (error) {
        console.warn('Failed to restore memory from sessionStorage:', error);
      }
    }

    return null;
  }

  /**
   * Save memory (session-only, using sessionStorage for browser session persistence)
   */
  async saveMemory(memory: PersistentMemory): Promise<void> {
    memory.lastUpdated = new Date().toISOString();

    // Save to in-memory cache
    this.memoryCache.set(memory.userId, memory);

    // Also save to sessionStorage for browser session persistence
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          `conversation_memory_${memory.userId}`,
          JSON.stringify(memory)
        );
      } catch (error) {
        console.warn('Failed to save memory to sessionStorage:', error);
      }
    }
  }

  /**
   * Update medical profile with new information
   */
  async updateMedicalProfile(
    userId: string,
    updates: Partial<PersistentMemory['medicalProfile']>
  ): Promise<void> {
    const memory = await this.getMemory(userId);
    if (memory) {
      memory.medicalProfile = {
        ...memory.medicalProfile,
        ...updates,
      };
      await this.saveMemory(memory);
    }
  }

  /**
   * Add a new symptom to memory
   */
  async addSymptom(
    userId: string,
    symptom: string,
    severity: number,
    duration: string,
    location?: string
  ): Promise<void> {
    const memory = await this.getMemory(userId);
    if (memory) {
      // Check if symptom already exists
      const existingSymptom = memory.medicalProfile.reportedSymptoms.find(
        (s) => s.symptom.toLowerCase() === symptom.toLowerCase()
      );

      if (existingSymptom) {
        // Update existing symptom
        existingSymptom.severity = severity;
        existingSymptom.duration = duration;
        if (location) existingSymptom.location = location;
      } else {
        // Add new symptom
        memory.medicalProfile.reportedSymptoms.push({
          symptom,
          severity,
          duration,
          location,
          firstMentioned: new Date().toISOString(),
        });
      }

      await this.saveMemory(memory);
    }
  }

  /**
   * Add established fact to conversation summary
   */
  async addEstablishedFact(
    userId: string,
    fact: string,
    confidence: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    const memory = await this.getMemory(userId);
    if (memory) {
      // Avoid duplicates
      const exists = memory.conversationSummary.establishedFacts.some(
        (f) => f.fact.toLowerCase() === fact.toLowerCase()
      );

      if (!exists) {
        memory.conversationSummary.establishedFacts.push({
          fact,
          confidence,
          timestamp: new Date().toISOString(),
        });
        await this.saveMemory(memory);
      }
    }
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(
    userId: string,
    progress: number,
    completedSubGoal?: string
  ): Promise<void> {
    const memory = await this.getMemory(userId);
    if (memory && memory.currentGoal) {
      memory.currentGoal.progress = Math.max(0, Math.min(100, progress));
      memory.currentGoal.updatedAt = new Date().toISOString();

      if (
        completedSubGoal &&
        !memory.currentGoal.completedSubGoals.includes(completedSubGoal)
      ) {
        memory.currentGoal.completedSubGoals.push(completedSubGoal);
      }

      if (progress >= 100) {
        memory.currentGoal.isCompleted = true;
      }

      await this.saveMemory(memory);
    }
  }

  /**
   * Get conversation context for AI
   */
  async getContextForAI(userId: string): Promise<string> {
    const memory = await this.getMemory(userId);
    if (!memory) return '';

    const context = [];

    // Current goal
    if (memory.currentGoal) {
      context.push(
        `USER'S GOAL: ${memory.currentGoal.description} (${memory.currentGoal.progress}% complete)`
      );
    }

    // Key symptoms
    if (memory.medicalProfile.reportedSymptoms.length > 0) {
      const symptoms = memory.medicalProfile.reportedSymptoms
        .map(
          (s) =>
            `${s.symptom} (severity: ${s.severity}/10, duration: ${s.duration}${s.location ? `, location: ${s.location}` : ''})`
        )
        .join(', ');
      context.push(`KNOWN SYMPTOMS: ${symptoms}`);
    }

    // Established facts
    if (memory.conversationSummary.establishedFacts.length > 0) {
      const facts = memory.conversationSummary.establishedFacts
        .filter((f) => f.confidence !== 'low')
        .map((f) => f.fact)
        .join(', ');
      if (facts) {
        context.push(`ESTABLISHED FACTS: ${facts}`);
      }
    }

    // Medical history
    if (memory.medicalProfile.medicalHistory.length > 0) {
      context.push(
        `MEDICAL HISTORY: ${memory.medicalProfile.medicalHistory.join(', ')}`
      );
    }

    // User preferences
    context.push(
      `USER PREFERS: ${memory.userPreferences.communicationStyle} communication, ${memory.userPreferences.informationDepthPreference} detail level`
    );

    return context.join('\n\n');
  }

  /**
   * Record message exchange
   */
  async recordMessage(
    userId: string,
    type: 'user' | 'assistant',
    content: string,
    careLevel?: string,
    reasoning?: any
  ): Promise<void> {
    const memory = await this.getMemory(userId);
    if (memory) {
      memory.sessionProgress.messagesExchanged++;

      // Store the actual message in conversation history
      memory.conversationSummary.messageHistory.push({
        type,
        content,
        timestamp: new Date().toISOString(),
        careLevel,
        reasoning,
      });

      // Extract and store any new information from the message
      if (type === 'user') {
        await this.extractInformationFromUserMessage(userId, content);
      } else if (type === 'assistant') {
        // Extract recommendations and key points from assistant messages
        await this.extractInformationFromAssistantMessage(userId, content, careLevel, reasoning);
      }

      await this.saveMemory(memory);
    }
  }

  /**
   * Extract information from user message
   */
  private async extractInformationFromUserMessage(
    userId: string,
    message: string
  ): Promise<void> {
    const lowerMessage = message.toLowerCase();

    // Simple extraction patterns (could be enhanced with NLP)
    const symptomPatterns = [
      /(?:my|i have|experiencing) (.+?) (?:hurt|pain|ache|feel)/gi,
      /(?:pain|ache|hurt|discomfort) (?:in|on|at) (?:my )?(.+?)(?:\s|$|,|\.)/gi,
    ];

    for (const pattern of symptomPatterns) {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          // Basic symptom extraction - would be enhanced with proper NLP
          const symptom = match[1].trim();
          if (symptom.length > 2 && symptom.length < 50) {
            await this.addEstablishedFact(
              userId,
              `User reports: ${symptom}`,
              'medium'
            );
          }
        }
      }
    }

    // Look for severity mentions
    const severityMatch = message.match(
      /(?:pain|symptoms?) (?:is|are) (?:a )?(\d+)(?:\/10| out of 10)/i
    );
    if (severityMatch) {
      await this.addEstablishedFact(
        userId,
        `Pain severity reported as ${severityMatch[1]}/10`,
        'high'
      );
    }

    // Look for duration mentions
    const durationMatch = message.match(
      /(?:for|since|about) (\d+) (day|week|month|hour)s?/i
    );
    if (durationMatch) {
      await this.addEstablishedFact(
        userId,
        `Duration: ${durationMatch[1]} ${durationMatch[2]}s`,
        'high'
      );
    }
  }

  /**
   * Extract information from assistant message
   */
  private async extractInformationFromAssistantMessage(
    userId: string,
    content: string,
    careLevel?: string,
    reasoning?: any
  ): Promise<void> {
    // Extract recommendations from assistant responses
    const recommendationPatterns = [
      /you should (.+?)(?:\.|$)/gi,
      /i recommend (.+?)(?:\.|$)/gi,
      /consider (.+?)(?:\.|$)/gi,
    ];

    for (const pattern of recommendationPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 5) {
          const memory = await this.getMemory(userId);
          if (memory) {
            memory.conversationSummary.recommendationsMade.push(match[1].trim());
            await this.saveMemory(memory);
          }
        }
      }
    }

    // Store care level as established fact if present
    if (careLevel) {
      await this.addEstablishedFact(
        userId,
        `Care level assessed as: ${careLevel}`,
        'high'
      );
    }

    // Extract key points from reasoning if available
    if (reasoning && reasoning.observations) {
      for (const observation of reasoning.observations) {
        await this.addEstablishedFact(userId, observation, 'medium');
      }
    }
  }

  /**
   * Clear expired memories
   */
  async cleanupExpiredMemories(): Promise<void> {
    const now = new Date();

    // Clear from cache
    for (const [userId, memory] of this.memoryCache.entries()) {
      if (new Date(memory.expiresAt) <= now) {
        this.memoryCache.delete(userId);
      }
    }

    // Clear from localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('conversation_memory_')) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const memory: PersistentMemory = JSON.parse(stored);
              if (new Date(memory.expiresAt) <= now) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            // Remove corrupted entries
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
  }
}

// Export singleton instance
export const conversationMemory = ConversationMemoryManager.getInstance();

// Utility hooks for React components
export function useConversationMemory(userId: string) {
  const [memory, setMemory] = React.useState<PersistentMemory | null>(null);

  React.useEffect(() => {
    conversationMemory.getMemory(userId).then(setMemory);
  }, [userId]);

  const updateMemory = React.useCallback(async () => {
    const updated = await conversationMemory.getMemory(userId);
    setMemory(updated);
  }, [userId]);

  return { memory, updateMemory };
}

export function useGoalProgress(userId: string) {
  const { memory, updateMemory } = useConversationMemory(userId);

  const setGoalProgress = React.useCallback(
    async (progress: number, completedSubGoal?: string) => {
      await conversationMemory.updateGoalProgress(
        userId,
        progress,
        completedSubGoal
      );
      await updateMemory();
    },
    [userId, updateMemory]
  );

  return {
    currentGoal: memory?.currentGoal,
    setGoalProgress,
  };
}
