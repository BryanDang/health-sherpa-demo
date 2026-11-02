/**
 * Phase 0: Trust Building & Intake Engine
 * Handles user profiling, goal identification, and document processing
 */

import {
  PhaseEngine,
  PhaseContext,
  PhaseResult,
  ValidationResult,
} from './PhaseEngine';
import {
  Phase0State,
  UserProfile,
  UserRole,
  ExpertiseLevel,
  DocumentProcessingStatus,
  SherpaOpinion,
  HealthDocument,
} from '@/types/core';

export interface Phase0Input {
  userGoal?: string;
  userRole?: UserRole;
  document?: File;
  demoMode?: boolean;
  interviewResponses?: {
    goals: string[];
    role: UserRole;
    otherParties: string[];
    expertise: ExpertiseLevel;
  };
}

export interface Phase0Output {
  userProfile: UserProfile;
  documentProcessingStatus: DocumentProcessingStatus;
  sherpaOpinion: SherpaOpinion;
  trustSignalsEstablished: boolean;
  readyForPhase1: boolean;
}

export class Phase0Engine extends PhaseEngine<Phase0Input, Phase0Output> {
  constructor() {
    super(
      0,
      'Trust Building & Intake',
      'Establishes user trust, profiles the user, and processes initial documentation',
      false // Phase 0 uses simple analysis, not advanced reasoning
    );
  }

  async execute(
    input: Phase0Input,
    context: PhaseContext
  ): Promise<PhaseResult<Phase0Output>> {
    try {
      // Step 1: Build user profile
      const userProfile = await this.buildUserProfile(input, context);

      // Step 2: Process document if provided
      const documentStatus = await this.processDocument(input.document);

      // Step 3: Create initial Sherpa Opinion
      const sherpaOpinion = await this.createInitialSherpaOpinion(
        userProfile,
        context
      );

      // Step 4: Establish trust signals
      const trustSignalsEstablished = this.establishTrustSignals(userProfile);

      // Step 5: Determine readiness for Phase 1
      const readyForPhase1 = this.checkPhase1Readiness(
        userProfile,
        documentStatus
      );

      const result: Phase0Output = {
        userProfile,
        documentProcessingStatus: documentStatus,
        sherpaOpinion,
        trustSignalsEstablished,
        readyForPhase1,
      };

      return {
        success: true,
        data: result,
        updatedSherpaOpinion: sherpaOpinion,
        confidence: sherpaOpinion.confidence,
        nextPhaseReady: readyForPhase1,
        messages: [
          this.createPhaseMessage(
            this.generateWelcomeMessage(userProfile),
            'assistant',
            [],
            85
          ),
        ],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Phase 0 execution failed',
      };
    }
  }

  validateContext(context: PhaseContext): ValidationResult {
    const missingRequirements: string[] = [];
    let confidence = 100;

    // Phase 0 has minimal requirements - just needs a session
    if (!context.sessionId) {
      missingRequirements.push('Valid session ID');
      confidence -= 50;
    }

    if (!context.timestamp) {
      missingRequirements.push('Session timestamp');
      confidence -= 20;
    }

    return {
      isValid: missingRequirements.length === 0,
      missingRequirements,
      confidence: Math.max(0, confidence),
    };
  }

  getRequiredContext(): string[] {
    return ['Session ID', 'Timestamp'];
  }

  getAdvancementCriteria(): string[] {
    return [
      'User profile established with role and goals',
      'Communication style preferences identified',
      'Document uploaded and processed (or demo mode selected)',
      'Trust signals established',
      'User ready to proceed to clinical summary',
    ];
  }

  private async buildUserProfile(
    input: Phase0Input,
    context: PhaseContext
  ): Promise<UserProfile> {
    // Handle different input methods
    if (input.interviewResponses) {
      // Full interview responses
      return this.createProfileFromInterview(input.interviewResponses);
    } else if (input.userGoal && input.userRole) {
      // Quick goal + role input
      return this.createProfileFromGoalAndRole(input.userGoal, input.userRole);
    } else {
      // Default profile that will be refined through conversation
      return this.createDefaultProfile();
    }
  }

  private createProfileFromInterview(
    responses: Phase0Input['interviewResponses']
  ): UserProfile {
    if (!responses) throw new Error('Interview responses required');

    return {
      role: responses.role,
      goals: responses.goals,
      otherPartiesInvolved: responses.otherParties,
      expertiseLevel: responses.expertise,
      communicationStyle: this.inferCommunicationStyle(
        responses.role,
        responses.expertise
      ),
      mirroringCues: this.generateMirroringCues(responses.expertise),
      additionalContext: [],
      profileUpdates: [],
      exportableProfile: '',
      internalProfile: '',
    };
  }

  private createProfileFromGoalAndRole(
    goal: string,
    role: UserRole
  ): UserProfile {
    return {
      role,
      goals: [goal],
      otherPartiesInvolved: [],
      expertiseLevel: 'novice', // Default, will be refined
      communicationStyle: this.inferCommunicationStyle(role, 'novice'),
      mirroringCues: this.generateMirroringCues('novice'),
      additionalContext: [],
      profileUpdates: [],
      exportableProfile: '',
      internalProfile: '',
    };
  }

  private createDefaultProfile(): UserProfile {
    return {
      role: 'patient',
      goals: [],
      otherPartiesInvolved: [],
      expertiseLevel: 'novice',
      communicationStyle: 'conversational',
      mirroringCues: {
        vocabularyLevel: ['basic medical terms'],
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

  private inferCommunicationStyle(role: UserRole, expertise: ExpertiseLevel) {
    if (role === 'provider') return 'technical';
    if (expertise === 'expert') return 'direct';
    if (expertise === 'intermediate') return 'conversational';
    return 'gentle'; // For novice patients
  }

  private generateMirroringCues(expertise: ExpertiseLevel) {
    const baseVocabulary = {
      novice: ['basic medical terms', 'everyday language'],
      intermediate: ['common medical terms', 'some technical language'],
      expert: ['medical terminology', 'clinical language'],
    };

    return {
      vocabularyLevel: baseVocabulary[expertise],
      sentenceLength:
        expertise === 'expert' ? ('long' as const) : ('medium' as const),
      questioningStyle:
        expertise === 'novice'
          ? ('clarifying' as const)
          : ('detailed' as const),
      emotionalTone:
        expertise === 'expert'
          ? ('analytical' as const)
          : ('empathetic' as const),
    };
  }

  private async processDocument(
    document?: File
  ): Promise<DocumentProcessingStatus> {
    if (!document) {
      return 'uploaded'; // Demo mode or no document
    }

    // In real implementation, this would:
    // 1. Parse the document (PDF, text, etc.)
    // 2. Create line-numbered version
    // 3. Flag for de-identification
    // 4. Perform initial analysis

    // For now, simulate the process
    return 'analyzed';
  }

  private async createInitialSherpaOpinion(
    userProfile: UserProfile,
    context: PhaseContext
  ): Promise<SherpaOpinion> {
    return {
      id: `opinion_${context.sessionId}`,
      lastUpdated: new Date().toISOString(),
      clinicalFindings: [],
      knowledgeGaps: [],
      assumptions: [],
      riskAssessment: 'low',
      documentCitations: [],
      webSourceCitations: [],
      confidence: {
        overallConfidence: 80, // High initial confidence for profile establishment
        findingConfidence: {},
        knowledgeGapSeverity: {},
        confidenceThreshold: 70,
        lastReanalysisReason: 'Initial opinion creation',
        readyForNextPhase: true,
        phaseCompletionConfidence: 85,
      },
      userProfileInfluence: `Profile established: ${userProfile.role} with ${userProfile.goals.length} goal(s), ${userProfile.expertiseLevel} expertise level`,
    };
  }

  private establishTrustSignals(userProfile: UserProfile): boolean {
    // Trust signals established when:
    // 1. User profile has basic information
    // 2. Communication preferences are set
    // 3. Goals are identified

    return !!(
      userProfile.role &&
      userProfile.communicationStyle &&
      userProfile.goals.length > 0 &&
      userProfile.mirroringCues
    );
  }

  private checkPhase1Readiness(
    userProfile: UserProfile,
    documentStatus: DocumentProcessingStatus
  ): boolean {
    const profileReady = !!(
      userProfile.role &&
      userProfile.goals.length > 0 &&
      userProfile.expertiseLevel &&
      userProfile.communicationStyle
    );

    const documentReady =
      documentStatus === 'analyzed' || documentStatus === 'ready';

    return profileReady && documentReady;
  }

  private generateWelcomeMessage(userProfile: UserProfile): string {
    const greeting = this.getPersonalizedGreeting(userProfile.role);
    const goalAcknowledgment =
      userProfile.goals.length > 0
        ? `I understand you're focused on: ${userProfile.goals.join(', ')}.`
        : "Let's start by understanding your healthcare goals.";

    return `${greeting} ${goalAcknowledgment} I'm here to help you navigate your healthcare information with clarity and confidence. We'll work through this together at a pace that feels right for you.`;
  }

  private getPersonalizedGreeting(role: UserRole): string {
    switch (role) {
      case 'provider':
        return "Hello! I'm Health Sherpa, ready to assist with clinical analysis and patient communication.";
      case 'family_member':
        return "Hello! I'm Health Sherpa. I understand you're helping navigate healthcare decisions for a loved one.";
      case 'caregiver':
        return "Hello! I'm Health Sherpa. I recognize the important role you play in healthcare support.";
      default: // patient
        return "Hello! I'm Health Sherpa, your personal healthcare navigation assistant.";
    }
  }

  protected async preExecute(
    input: Phase0Input,
    context: PhaseContext
  ): Promise<void> {
    console.log('Phase 0: Beginning trust building and intake process');

    // Log the type of input being processed
    if (input.demoMode) {
      console.log('Phase 0: Demo mode selected');
    } else if (input.document) {
      console.log('Phase 0: Document uploaded for processing');
    } else if (input.interviewResponses) {
      console.log('Phase 0: Full interview responses provided');
    } else {
      console.log('Phase 0: Basic goal and role provided');
    }
  }

  protected async postExecute(
    result: PhaseResult<Phase0Output>,
    context: PhaseContext
  ): Promise<PhaseResult<Phase0Output>> {
    if (result.success && result.data) {
      console.log(
        `Phase 0: Successfully established profile for ${result.data.userProfile.role}`
      );
      console.log(
        `Phase 0: Document status: ${result.data.documentProcessingStatus}`
      );
      console.log(`Phase 0: Ready for Phase 1: ${result.data.readyForPhase1}`);
    }

    return result;
  }
}
