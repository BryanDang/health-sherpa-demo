/**
 * Phase Orchestrator - Manages the entire phase workflow
 * Coordinates execution of all phases and maintains state consistency
 */

import { PhaseEngine, PhaseContext, PhaseResult } from './PhaseEngine';
import { Phase0Engine } from './Phase0Engine';
import { Phase1Engine } from './Phase1Engine';
import { Phase2Engine } from './Phase2Engine';
import { Phase3Engine } from './Phase3Engine';
import { Phase4Engine } from './Phase4Engine';

import {
  PhaseNumber,
  UserProfile,
  SherpaOpinion,
  ChatSession,
  HealthDocument,
} from '@/types/core';

export interface OrchestratorState {
  currentPhase: PhaseNumber;
  sessionId: string;
  userProfile: UserProfile | null;
  sherpaOpinion: SherpaOpinion | null;
  activeDocument: HealthDocument | null;
  phaseResults: { [key in PhaseNumber]?: any };
  isTransitioning: boolean;
  error: string | null;
}

export interface PhaseTransitionOptions {
  force?: boolean; // Force transition even if current phase not complete
  skipValidation?: boolean; // Skip phase validation
  preserveState?: boolean; // Preserve current state during transition
}

export class PhaseOrchestrator {
  private engines: Map<PhaseNumber, PhaseEngine<any, any>>;
  private state: OrchestratorState;

  constructor(sessionId: string) {
    this.engines = new Map<PhaseNumber, PhaseEngine<any, any>>([
      [0, new Phase0Engine()],
      [1, new Phase1Engine()],
      [2, new Phase2Engine()],
      [3, new Phase3Engine()],
      [4, new Phase4Engine()],
    ]);

    this.state = {
      currentPhase: 0,
      sessionId,
      userProfile: null,
      sherpaOpinion: null,
      activeDocument: null,
      phaseResults: {},
      isTransitioning: false,
      error: null,
    };
  }

  /**
   * Execute a specific phase with given input
   */
  async executePhase<TInput, TOutput>(
    phase: PhaseNumber,
    input: TInput
  ): Promise<PhaseResult<TOutput>> {
    const engine = this.engines.get(phase);
    if (!engine) {
      throw new Error(`No engine found for phase ${phase}`);
    }

    try {
      this.state.isTransitioning = true;
      this.state.error = null;

      // Create context for the phase
      const context = this.createPhaseContext(phase);

      // Execute the phase
      const result = await engine.run(input, context);

      // Update state based on result
      if (result.success) {
        this.updateStateFromResult(phase, result);
      } else {
        this.state.error = result.error || 'Phase execution failed';
      }

      this.state.isTransitioning = false;
      return result;
    } catch (error) {
      this.state.isTransitioning = false;
      this.state.error =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: this.state.error,
      };
    }
  }

  /**
   * Advance to the next phase if current phase is complete
   */
  async advancePhase<TInput>(input?: TInput): Promise<PhaseResult<any>> {
    const currentPhase = this.state.currentPhase;
    const nextPhase = (currentPhase + 1) as PhaseNumber;

    if (nextPhase > 4) {
      return {
        success: false,
        error: 'Already at final phase',
      };
    }

    // Check if current phase is complete
    if (!this.isPhaseComplete(currentPhase)) {
      return {
        success: false,
        error: `Phase ${currentPhase} is not complete`,
      };
    }

    // Execute next phase
    const result = await this.executePhase(nextPhase, input);

    if (result.success) {
      this.state.currentPhase = nextPhase;
    }

    return result;
  }

  /**
   * Go to a specific phase (with validation)
   */
  async goToPhase<TInput>(
    targetPhase: PhaseNumber,
    input: TInput,
    options: PhaseTransitionOptions = {}
  ): Promise<PhaseResult<any>> {
    // Validate transition unless skipped
    if (!options.skipValidation && !this.canTransitionTo(targetPhase)) {
      return {
        success: false,
        error: `Cannot transition to phase ${targetPhase}`,
      };
    }

    // Execute target phase
    const result = await this.executePhase(targetPhase, input);

    if (result.success || options.force) {
      this.state.currentPhase = targetPhase;
    }

    return result;
  }

  /**
   * Check if a phase is complete
   */
  isPhaseComplete(phase: PhaseNumber): boolean {
    const engine = this.engines.get(phase);
    if (!engine) return false;

    // Phase is complete when results exist for it
    const hasResults = !!this.state.phaseResults[phase];

    // Additional validation based on phase
    switch (phase) {
      case 0:
        return (
          hasResults && !!this.state.userProfile && !!this.state.sherpaOpinion
        );
      case 1:
        return (
          hasResults && !!this.state.sherpaOpinion?.clinicalFindings.length
        );
      case 2:
        return hasResults && this.state.phaseResults[2]?.insights?.length >= 5;
      case 3:
        return (
          hasResults && this.state.phaseResults[3]?.evidenceGroups?.length >= 2
        );
      case 4:
        return (
          hasResults &&
          this.state.phaseResults[4]?.prioritizedActions?.length > 0
        );
      default:
        return hasResults;
    }
  }

  /**
   * Check if can transition to a target phase
   */
  canTransitionTo(targetPhase: PhaseNumber): boolean {
    // Can always go to Phase 0
    if (targetPhase === 0) return true;

    // Must complete previous phases sequentially
    for (let phase = 0; phase < targetPhase; phase++) {
      if (!this.isPhaseComplete(phase as PhaseNumber)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the current orchestrator state
   */
  getState(): OrchestratorState {
    return { ...this.state };
  }

  /**
   * Update orchestrator state
   */
  updateState(updates: Partial<OrchestratorState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Get available phases and their completion status
   */
  getPhaseStatus(): {
    [key in PhaseNumber]: {
      complete: boolean;
      available: boolean;
      engine: PhaseEngine<any, any>;
    };
  } {
    return {
      0: {
        complete: this.isPhaseComplete(0),
        available: true,
        engine: this.engines.get(0)!,
      },
      1: {
        complete: this.isPhaseComplete(1),
        available: this.canTransitionTo(1),
        engine: this.engines.get(1)!,
      },
      2: {
        complete: this.isPhaseComplete(2),
        available: this.canTransitionTo(2),
        engine: this.engines.get(2)!,
      },
      3: {
        complete: this.isPhaseComplete(3),
        available: this.canTransitionTo(3),
        engine: this.engines.get(3)!,
      },
      4: {
        complete: this.isPhaseComplete(4),
        available: this.canTransitionTo(4),
        engine: this.engines.get(4)!,
      },
    };
  }

  /**
   * Reset orchestrator to initial state
   */
  reset(newSessionId?: string): void {
    this.state = {
      currentPhase: 0,
      sessionId: newSessionId || this.state.sessionId,
      userProfile: null,
      sherpaOpinion: null,
      activeDocument: null,
      phaseResults: {},
      isTransitioning: false,
      error: null,
    };
  }

  /**
   * Export current session state for handoff
   */
  exportSessionState(): {
    sessionId: string;
    currentPhase: PhaseNumber;
    userProfile: UserProfile | null;
    sherpaOpinion: SherpaOpinion | null;
    phaseResults: any;
    timestamp: string;
  } {
    return {
      sessionId: this.state.sessionId,
      currentPhase: this.state.currentPhase,
      userProfile: this.state.userProfile,
      sherpaOpinion: this.state.sherpaOpinion,
      phaseResults: this.state.phaseResults,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Import session state from export
   */
  importSessionState(
    exportedState: ReturnType<typeof this.exportSessionState>
  ): void {
    this.state = {
      ...this.state,
      sessionId: exportedState.sessionId,
      currentPhase: exportedState.currentPhase,
      userProfile: exportedState.userProfile,
      sherpaOpinion: exportedState.sherpaOpinion,
      phaseResults: exportedState.phaseResults,
    };
  }

  // Private helper methods

  private createPhaseContext(phase: PhaseNumber): PhaseContext {
    if (!this.state.userProfile) {
      // Create minimal profile for Phase 0
      this.state.userProfile = {
        role: 'patient',
        goals: [],
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
      };
    }

    if (!this.state.sherpaOpinion) {
      // Create minimal opinion for early phases
      this.state.sherpaOpinion = {
        id: `opinion_${this.state.sessionId}`,
        lastUpdated: new Date().toISOString(),
        clinicalFindings: [],
        knowledgeGaps: [],
        assumptions: [],
        riskAssessment: 'low',
        documentCitations: [],
        webSourceCitations: [],
        confidence: {
          overallConfidence: 50,
          findingConfidence: {},
          knowledgeGapSeverity: {},
          confidenceThreshold: 70,
          lastReanalysisReason: 'Initial opinion creation',
          readyForNextPhase: false,
          phaseCompletionConfidence: 0,
        },
        userProfileInfluence: '',
      };
    }

    return {
      phase,
      userProfile: this.state.userProfile,
      sherpaOpinion: this.state.sherpaOpinion,
      sessionId: this.state.sessionId,
      timestamp: new Date().toISOString(),
    };
  }

  private updateStateFromResult(
    phase: PhaseNumber,
    result: PhaseResult<any>
  ): void {
    // Store phase result
    this.state.phaseResults[phase] = result.data;

    // Update Sherpa Opinion if provided
    if (result.updatedSherpaOpinion) {
      this.state.sherpaOpinion = result.updatedSherpaOpinion;
    }

    // Phase-specific state updates
    switch (phase) {
      case 0:
        if (result.data?.userProfile) {
          this.state.userProfile = result.data.userProfile;
        }
        break;

      case 1:
        // Phase 1 might update user profile based on clinical findings
        break;

      case 2:
        // Phase 2 adds insights
        break;

      case 3:
        // Phase 3 creates evidence groups
        break;

      case 4:
        // Phase 4 creates final action plan
        break;
    }
  }
}
