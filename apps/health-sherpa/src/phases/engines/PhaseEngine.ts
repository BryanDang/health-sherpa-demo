/**
 * Base class for all Phase Engines
 * Provides common functionality and enforces interface contracts
 */

import {
  PhaseNumber,
  SherpaOpinion,
  UserProfile,
  ConfidenceTracking,
  ChatMessage,
} from '@/types/core';

// Base context that all phases need
export interface PhaseContext {
  phase: PhaseNumber;
  userProfile: UserProfile;
  sherpaOpinion: SherpaOpinion;
  sessionId: string;
  timestamp: string;
}

// Result interface for phase execution
export interface PhaseResult<T = any> {
  success: boolean;
  data?: T;
  updatedSherpaOpinion?: SherpaOpinion;
  confidence?: ConfidenceTracking;
  error?: string;
  messages?: ChatMessage[];
  nextPhaseReady?: boolean;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  missingRequirements: string[];
  confidence: number;
}

/**
 * Abstract base class for all phase engines
 * Each phase (0-4) extends this class and implements required methods
 */
export abstract class PhaseEngine<TInput = any, TOutput = any> {
  protected readonly phase: PhaseNumber;
  protected readonly name: string;
  protected readonly description: string;
  protected readonly useAdvancedReasoning: boolean;

  constructor(
    phase: PhaseNumber,
    name: string,
    description: string,
    useAdvancedReasoning: boolean = false
  ) {
    this.phase = phase;
    this.name = name;
    this.description = description;
    this.useAdvancedReasoning = useAdvancedReasoning;
  }

  /**
   * Main execution method that each phase must implement
   * This is the core logic for the phase
   */
  abstract execute(
    input: TInput,
    context: PhaseContext
  ): Promise<PhaseResult<TOutput>>;

  /**
   * Validate that the context and input are ready for this phase
   * Each phase defines its own validation requirements
   */
  abstract validateContext(context: PhaseContext): ValidationResult;

  /**
   * Get the required context/data needed for this phase to execute
   * Used by the orchestrator to determine if phase can run
   */
  abstract getRequiredContext(): string[];

  /**
   * Get the criteria that must be met to advance to the next phase
   * Used by the UI to show progress and requirements
   */
  abstract getAdvancementCriteria(): string[];

  /**
   * Pre-execution hook - called before execute()
   * Can be overridden by phases for setup logic
   */
  protected async preExecute(
    input: TInput,
    context: PhaseContext
  ): Promise<void> {
    // Default implementation - can be overridden
    console.log(`Phase ${this.phase} (${this.name}) pre-execution`);
  }

  /**
   * Post-execution hook - called after execute()
   * Can be overridden by phases for cleanup logic
   */
  protected async postExecute(
    result: PhaseResult<TOutput>,
    context: PhaseContext
  ): Promise<PhaseResult<TOutput>> {
    // Default implementation - can be overridden
    console.log(`Phase ${this.phase} (${this.name}) post-execution`);
    return result;
  }

  /**
   * Public method that orchestrates the full phase execution
   * Calls pre-execute, execute, and post-execute in sequence
   */
  async run(
    input: TInput,
    context: PhaseContext
  ): Promise<PhaseResult<TOutput>> {
    try {
      // Validate context first
      const validation = this.validateContext(context);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Phase ${this.phase} validation failed: ${validation.missingRequirements.join(', ')}`,
          confidence: {
            ...context.sherpaOpinion.confidence,
            overallConfidence: validation.confidence,
          },
        };
      }

      // Pre-execution
      await this.preExecute(input, context);

      // Main execution
      const result = await this.execute(input, context);

      // Post-execution
      const finalResult = await this.postExecute(result, context);

      return finalResult;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error in phase execution',
        confidence: {
          ...context.sherpaOpinion.confidence,
          overallConfidence: 0,
        },
      };
    }
  }

  /**
   * Helper method to update Sherpa Opinion with phase-specific changes
   */
  protected updateSherpaOpinion(
    currentOpinion: SherpaOpinion,
    updates: Partial<SherpaOpinion>
  ): SherpaOpinion {
    return {
      ...currentOpinion,
      ...updates,
      lastUpdated: new Date().toISOString(),
      confidence: {
        ...currentOpinion.confidence,
        ...updates.confidence,
      },
    };
  }

  /**
   * Helper method to create a chat message for this phase
   */
  protected createPhaseMessage(
    content: string,
    role: 'user' | 'assistant' | 'system' = 'assistant',
    citations?: any[],
    confidence?: number
  ): ChatMessage {
    return {
      id: `msg_${this.phase}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      content,
      role,
      timestamp: new Date().toISOString(),
      phase: this.phase,
      citations,
      confidence,
    };
  }

  /**
   * Helper method to calculate confidence based on various factors
   */
  protected calculateConfidence(factors: {
    dataQuality: number;
    completeness: number;
    userEngagement: number;
    citationStrength: number;
  }): number {
    const weights = {
      dataQuality: 0.3,
      completeness: 0.3,
      userEngagement: 0.2,
      citationStrength: 0.2,
    };

    return Math.round(
      factors.dataQuality * weights.dataQuality +
        factors.completeness * weights.completeness +
        factors.userEngagement * weights.userEngagement +
        factors.citationStrength * weights.citationStrength
    );
  }

  /**
   * Helper method to determine if re-analysis is needed
   */
  protected shouldReanalyze(
    currentConfidence: number,
    threshold: number,
    newInformation: boolean
  ): boolean {
    return currentConfidence < threshold || newInformation;
  }

  // Getters for phase information
  get phaseNumber(): PhaseNumber {
    return this.phase;
  }

  get phaseName(): string {
    return this.name;
  }

  get phaseDescription(): string {
    return this.description;
  }

  get usesAdvancedReasoning(): boolean {
    return this.useAdvancedReasoning;
  }
}
