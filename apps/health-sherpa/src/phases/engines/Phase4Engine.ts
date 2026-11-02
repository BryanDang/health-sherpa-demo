/**
 * Phase 4: Prioritize Actions Engine
 * Translates evidence into prioritized, actionable recommendations
 */

import {
  PhaseEngine,
  PhaseContext,
  PhaseResult,
  ValidationResult,
} from './PhaseEngine';
import {
  Phase4Input,
  Phase4Output,
  Action,
  CausalChain,
  EvidenceGroup,
  SherpaOpinion,
} from '@/types/core';

export class Phase4Engine extends PhaseEngine<Phase4Input, Phase4Output> {
  constructor() {
    super(
      4,
      'Prioritize Actions',
      'Translates evidence into prioritized, actionable recommendations with clear rationale',
      true // Phase 4 uses advanced reasoning for evidence-to-action translation
    );
  }

  async execute(
    input: Phase4Input,
    context: PhaseContext
  ): Promise<PhaseResult<Phase4Output>> {
    try {
      // Step 1: Propose actions based on evidence groups
      const proposedActions = await this.proposeActionsFromEvidence(
        input.evidenceGroups,
        input.originalGoals,
        context.userProfile
      );

      // Step 2: Create causal chains for each action
      const actionRationale = this.createCausalChains(
        proposedActions,
        input.evidenceGroups
      );

      // Step 3: Prioritize actions by urgency and actionability
      const prioritizedActions = this.prioritizeActions(
        proposedActions,
        input.userProfile,
        input.originalGoals
      );

      // Step 4: Validate actions with user context
      const validatedActions = this.validateActions(
        prioritizedActions,
        context.userProfile,
        input.sherpaOpinion
      );

      // Step 5: Create final Sherpa Opinion
      const finalSherpaOpinion = this.createFinalSherpaOpinion(
        input.sherpaOpinion,
        validatedActions,
        input.evidenceGroups
      );

      // Step 6: Calculate final confidence
      const confidence = this.calculateActionConfidence(
        validatedActions,
        actionRationale,
        input.evidenceGroups
      );

      const result: Phase4Output = {
        prioritizedActions: validatedActions,
        actionRationale,
        finalSherpaOpinion,
        confidence,
      };

      return {
        success: true,
        data: result,
        updatedSherpaOpinion: finalSherpaOpinion,
        confidence,
        nextPhaseReady: false, // Phase 4 is the final phase
        messages: [
          this.createPhaseMessage(
            this.generateActionsPlanMessage(validatedActions, actionRationale),
            'assistant',
            this.extractActionCitations(validatedActions),
            confidence.phaseCompletionConfidence
          ),
        ],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Phase 4 execution failed',
      };
    }
  }

  validateContext(context: PhaseContext): ValidationResult {
    const missingRequirements: string[] = [];
    let confidence = 100;

    if (!context.sherpaOpinion) {
      missingRequirements.push('Sherpa Opinion from previous phases');
      confidence -= 40;
    }

    if (!context.userProfile) {
      missingRequirements.push('User profile');
      confidence -= 30;
    }

    return {
      isValid: missingRequirements.length === 0,
      missingRequirements,
      confidence: Math.max(0, confidence),
    };
  }

  getRequiredContext(): string[] {
    return [
      'Evidence groups from Phase 3',
      'Original user goals',
      'Complete Sherpa Opinion',
      'User profile with preferences and constraints',
    ];
  }

  getAdvancementCriteria(): string[] {
    return [
      'Actions proposed based on evidence groups',
      'Causal chains established (Evidence → Actions)',
      'Actions prioritized by urgency and actionability',
      'User has reviewed and approved action plan',
      'Export ready for professional handoff',
    ];
  }

  private async proposeActionsFromEvidence(
    evidenceGroups: EvidenceGroup[],
    originalGoals: string[],
    userProfile: any
  ): Promise<Action[]> {
    const actions: Action[] = [];

    evidenceGroups.forEach((group, groupIndex) => {
      // Generate 1-3 actions per evidence group
      const groupActions = this.generateActionsForGroup(
        group,
        originalGoals,
        userProfile,
        groupIndex
      );
      actions.push(...groupActions);
    });

    return actions;
  }

  private generateActionsForGroup(
    group: EvidenceGroup,
    originalGoals: string[],
    userProfile: any,
    groupIndex: number
  ): Action[] {
    const actions: Action[] = [];

    // Determine action types based on group heading and content
    const actionTypes = this.identifyActionTypes(group);

    actionTypes.forEach((actionType, actionIndex) => {
      const action: Action = {
        id: `action_${groupIndex}_${actionIndex}`,
        content: this.generateActionContent(actionType, group, userProfile),
        priority: this.calculateInitialPriority(actionType, group),
        urgency: this.assessActionUrgency(actionType, group),
        actionability: this.assessActionability(actionType, userProfile),
        relatedGoals: this.mapActionToGoals(actionType, originalGoals),
        evidenceSupport: [group.id],
        causalChain: {
          actionId: `action_${groupIndex}_${actionIndex}`,
          evidenceGroups: [group.id],
          reasoning: this.generateCausalReasoning(actionType, group),
          confidence: group.confidence,
        },
      };

      actions.push(action);
    });

    return actions;
  }

  private createCausalChains(
    actions: Action[],
    evidenceGroups: EvidenceGroup[]
  ): CausalChain[] {
    return actions.map((action) => ({
      actionId: action.id,
      evidenceGroups: action.evidenceSupport,
      reasoning: this.enhanceCausalReasoning(action, evidenceGroups),
      confidence: this.calculateCausalConfidence(action, evidenceGroups),
    }));
  }

  private prioritizeActions(
    actions: Action[],
    userProfile: any,
    originalGoals: string[]
  ): Action[] {
    return actions
      .map((action, index) => ({
        ...action,
        priority: this.calculateFinalPriority(
          action,
          userProfile,
          originalGoals,
          index
        ),
      }))
      .sort((a, b) => {
        // Sort by priority (higher first), then urgency, then actionability
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }

        const urgencyPriority =
          this.getUrgencyScore(b.urgency) - this.getUrgencyScore(a.urgency);
        if (urgencyPriority !== 0) {
          return urgencyPriority;
        }

        return (
          this.getActionabilityScore(b.actionability) -
          this.getActionabilityScore(a.actionability)
        );
      })
      .map((action, index) => ({
        ...action,
        priority: index + 1, // Re-number priorities
      }));
  }

  private validateActions(
    actions: Action[],
    userProfile: any,
    sherpaOpinion: SherpaOpinion
  ): Action[] {
    return actions.filter((action) =>
      this.isActionAppropriate(action, userProfile, sherpaOpinion)
    );
  }

  private createFinalSherpaOpinion(
    currentOpinion: SherpaOpinion,
    actions: Action[],
    evidenceGroups: EvidenceGroup[]
  ): SherpaOpinion {
    // Create final assumptions based on action plan
    const actionAssumptions = actions.map((action, index) => ({
      id: `action_assumption_${index}`,
      content: `Action recommended: ${action.content.substring(0, 50)}...`,
      confidence: action.causalChain.confidence,
      basedOnFindings: evidenceGroups.flatMap((group) =>
        group.insights.map((insight) => insight.id)
      ),
    }));

    return this.updateSherpaOpinion(currentOpinion, {
      assumptions: [...currentOpinion.assumptions, ...actionAssumptions],
      riskAssessment: this.calculateFinalRiskAssessment(
        actions,
        currentOpinion
      ),
      userProfileInfluence: `${currentOpinion.userProfileInfluence}. Phase 4: Generated ${actions.length} prioritized actions.`,
    });
  }

  private calculateActionConfidence(
    actions: Action[],
    actionRationale: CausalChain[],
    evidenceGroups: EvidenceGroup[]
  ) {
    const avgActionConfidence =
      actions.reduce((sum, action) => sum + action.causalChain.confidence, 0) /
      actions.length;

    const factors = {
      dataQuality: avgActionConfidence,
      completeness: actions.length >= 3 ? 90 : actions.length * 30,
      userEngagement: 90, // High engagement expected in final phase
      citationStrength: this.assessActionCitationStrength(
        actions,
        evidenceGroups
      ),
    };

    const overallConfidence = this.calculateConfidence(factors);

    return {
      overallConfidence,
      findingConfidence: actions.reduce((acc, action) => {
        acc[action.id] = action.causalChain.confidence;
        return acc;
      }, {} as any),
      knowledgeGapSeverity: {},
      confidenceThreshold: 80, // Higher threshold for final phase
      lastReanalysisReason: 'Phase 4 action prioritization',
      readyForNextPhase: false, // Phase 4 is final
      phaseCompletionConfidence: overallConfidence,
    };
  }

  private generateActionsPlanMessage(
    actions: Action[],
    actionRationale: CausalChain[]
  ): string {
    let message = '## Your Personalized Action Plan\n\n';
    message += `Based on our analysis, here are ${actions.length} prioritized actions you can take:\n\n`;

    actions.forEach((action, index) => {
      const urgencyIcon = this.getUrgencyIcon(action.urgency);
      const timeframeText = this.getTimeframeText(action.actionability);

      message += `### ${action.priority}. ${urgencyIcon} ${action.content}\n`;
      message += `**Timeframe:** ${timeframeText}  \n`;
      message += `**Why this matters:** ${action.causalChain.reasoning}\n\n`;

      if (action.relatedGoals.length > 0) {
        message += `*Addresses your goal${action.relatedGoals.length > 1 ? 's' : ''}: ${action.relatedGoals.join(', ')}*\n\n`;
      }
    });

    message += '---\n\n';
    message += '**Next Steps:**\n';
    message += '- Review and modify these actions based on your preferences\n';
    message += '- Export this plan to share with your healthcare provider\n';
    message += '- Start with the highest priority items that feel manageable\n';

    return message;
  }

  private extractActionCitations(actions: Action[]) {
    // Actions have no direct citations. Trace back through evidence.
    return []; // In real implementation, would trace through evidence groups
  }

  // Helper methods
  private identifyActionTypes(group: EvidenceGroup): string[] {
    const actionTypes: string[] = [];
    const heading = group.heading.toLowerCase();
    const content = group.synthesizedContent.toLowerCase();

    // Medical actions
    if (heading.includes('medication') || content.includes('medication')) {
      actionTypes.push('medication_review');
    }

    if (heading.includes('test') || content.includes('monitor')) {
      actionTypes.push('monitoring');
    }

    if (
      heading.includes('lifestyle') ||
      content.includes('diet') ||
      content.includes('exercise')
    ) {
      actionTypes.push('lifestyle_change');
    }

    if (heading.includes('provider') || content.includes('doctor')) {
      actionTypes.push('provider_consultation');
    }

    if (heading.includes('priority') || heading.includes('urgent')) {
      actionTypes.push('immediate_attention');
    }

    // Default action if none identified
    if (actionTypes.length === 0) {
      actionTypes.push('information_review');
    }

    return actionTypes;
  }

  private generateActionContent(
    actionType: string,
    group: EvidenceGroup,
    userProfile: any
  ): string {
    const templates = {
      medication_review:
        'Review your current medications with your healthcare provider, particularly focusing on [specific medication concerns from evidence]',
      monitoring:
        'Monitor [specific metrics] and track changes over the next [timeframe]',
      lifestyle_change:
        'Consider making gradual changes to [specific lifestyle factor] to address [health concern]',
      provider_consultation:
        'Schedule an appointment with your healthcare provider to discuss [specific findings]',
      immediate_attention:
        'Seek medical attention for [urgent concern] identified in your health information',
      information_review:
        'Learn more about [topic] to better understand your health situation',
    };

    let content =
      templates[actionType as keyof typeof templates] ||
      templates.information_review;

    // Customize based on group content
    content = content.replace(
      '[specific medication concerns from evidence]',
      this.extractMedicationConcerns(group)
    );
    content = content.replace(
      '[specific metrics]',
      this.extractMonitoringMetrics(group)
    );
    content = content.replace(
      '[specific lifestyle factor]',
      this.extractLifestyleFactors(group)
    );
    content = content.replace('[specific findings]', group.heading);
    content = content.replace(
      '[urgent concern]',
      this.extractUrgentConcerns(group)
    );
    content = content.replace('[topic]', group.heading);
    content = content.replace('[health concern]', group.heading);
    content = content.replace(
      '[timeframe]',
      this.suggestTimeframe(actionType, userProfile)
    );

    return content;
  }

  private calculateInitialPriority(
    actionType: string,
    group: EvidenceGroup
  ): number {
    const typePriority = {
      immediate_attention: 5,
      provider_consultation: 4,
      medication_review: 4,
      monitoring: 3,
      lifestyle_change: 2,
      information_review: 1,
    };

    const basePriority =
      typePriority[actionType as keyof typeof typePriority] || 1;
    const confidenceBonus = group.confidence > 80 ? 1 : 0;

    return Math.min(5, basePriority + confidenceBonus);
  }

  private assessActionUrgency(
    actionType: string,
    group: EvidenceGroup
  ): 'low' | 'medium' | 'high' | 'urgent' {
    if (actionType === 'immediate_attention') return 'urgent';
    if (group.heading.toLowerCase().includes('priority')) return 'high';
    if (
      actionType === 'provider_consultation' ||
      actionType === 'medication_review'
    )
      return 'medium';
    return 'low';
  }

  private assessActionability(
    actionType: string,
    userProfile: any
  ): 'immediate' | 'short_term' | 'long_term' {
    const actionabilityMap: Record<
      string,
      'immediate' | 'short_term' | 'long_term'
    > = {
      immediate_attention: 'immediate',
      information_review: 'immediate',
      provider_consultation: 'short_term',
      medication_review: 'short_term',
      monitoring: 'short_term',
      lifestyle_change: 'long_term',
    };

    return actionabilityMap[actionType] || 'short_term';
  }

  private mapActionToGoals(
    actionType: string,
    originalGoals: string[]
  ): string[] {
    // Simple keyword matching - in real implementation would be more sophisticated
    return originalGoals.filter((goal) => {
      const goalLower = goal.toLowerCase();
      switch (actionType) {
        case 'medication_review':
          return (
            goalLower.includes('medication') || goalLower.includes('treatment')
          );
        case 'lifestyle_change':
          return (
            goalLower.includes('lifestyle') ||
            goalLower.includes('diet') ||
            goalLower.includes('exercise')
          );
        case 'monitoring':
          return goalLower.includes('monitor') || goalLower.includes('track');
        default:
          return true; // All actions relate to general health goals
      }
    });
  }

  private generateCausalReasoning(
    actionType: string,
    group: EvidenceGroup
  ): string {
    return `Based on evidence in "${group.heading}", this action addresses the underlying concerns by targeting the key factors identified in your health information.`;
  }

  private enhanceCausalReasoning(
    action: Action,
    evidenceGroups: EvidenceGroup[]
  ): string {
    const supportingGroup = evidenceGroups.find((group) =>
      action.evidenceSupport.includes(group.id)
    );

    if (!supportingGroup) return action.causalChain.reasoning;

    return `${action.causalChain.reasoning} Specifically, the evidence shows ${supportingGroup.synthesizedContent.substring(0, 100)}... which indicates that ${action.content.toLowerCase()} would be beneficial.`;
  }

  private calculateCausalConfidence(
    action: Action,
    evidenceGroups: EvidenceGroup[]
  ): number {
    const supportingGroups = evidenceGroups.filter((group) =>
      action.evidenceSupport.includes(group.id)
    );

    const avgGroupConfidence =
      supportingGroups.reduce((sum, group) => sum + group.confidence, 0) /
      supportingGroups.length;

    // Adjust based on action type reliability
    const actionTypeConfidence = {
      immediate_attention: 95,
      provider_consultation: 90,
      medication_review: 85,
      monitoring: 80,
      lifestyle_change: 75,
      information_review: 70,
    };

    const typeConfidence =
      actionTypeConfidence[
        action.content.toLowerCase().includes('immediate')
          ? 'immediate_attention'
          : 'information_review'
      ] || 75;

    return Math.round((avgGroupConfidence + typeConfidence) / 2);
  }

  private calculateFinalPriority(
    action: Action,
    userProfile: any,
    originalGoals: string[],
    index: number
  ): number {
    let priority = action.priority;

    // Adjust based on user goals alignment
    if (action.relatedGoals.length > 0) {
      priority += action.relatedGoals.length;
    }

    // Adjust based on user expertise
    if (
      userProfile.expertiseLevel === 'novice' &&
      action.content.includes('provider')
    ) {
      priority += 1; // Boost provider consultations for novices
    }

    return Math.max(1, Math.min(10, priority));
  }

  private getUrgencyScore(urgency: string): number {
    const scores = { urgent: 4, high: 3, medium: 2, low: 1 };
    return scores[urgency as keyof typeof scores] || 1;
  }

  private getActionabilityScore(actionability: string): number {
    const scores = { immediate: 3, short_term: 2, long_term: 1 };
    return scores[actionability as keyof typeof scores] || 1;
  }

  private isActionAppropriate(
    action: Action,
    userProfile: any,
    sherpaOpinion: SherpaOpinion
  ): boolean {
    // Basic validation - in real implementation would be more comprehensive
    return action.content.length > 10 && action.causalChain.confidence > 50;
  }

  private calculateFinalRiskAssessment(
    actions: Action[],
    currentOpinion: SherpaOpinion
  ): any {
    const hasUrgentActions = actions.some(
      (action) => action.urgency === 'urgent'
    );
    const hasHighPriorityActions = actions.some(
      (action) => action.priority <= 2
    );

    if (hasUrgentActions) return 'critical';
    if (hasHighPriorityActions) return 'high';
    return currentOpinion.riskAssessment;
  }

  private getUrgencyIcon(urgency: string): string {
    const icons = { urgent: 'URGENT', high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
    return icons[urgency as keyof typeof icons] || 'LOW';
  }

  private getTimeframeText(actionability: string): string {
    const timeframes = {
      immediate: 'Today/This week',
      short_term: 'Next 2-4 weeks',
      long_term: 'Next 1-3 months',
    };
    return (
      timeframes[actionability as keyof typeof timeframes] || 'When convenient'
    );
  }

  // Content extraction helpers
  private extractMedicationConcerns(group: EvidenceGroup): string {
    return 'medication interactions and dosing';
  }

  private extractMonitoringMetrics(group: EvidenceGroup): string {
    return 'relevant health metrics';
  }

  private extractLifestyleFactors(group: EvidenceGroup): string {
    return 'diet and exercise habits';
  }

  private extractUrgentConcerns(group: EvidenceGroup): string {
    return group.heading.toLowerCase();
  }

  private suggestTimeframe(actionType: string, userProfile: any): string {
    return actionType === 'monitoring' ? '2-4 weeks' : '1-2 weeks';
  }

  private assessActionCitationStrength(
    actions: Action[],
    evidenceGroups: EvidenceGroup[]
  ): number {
    // Actions inherit citation strength from their supporting evidence groups
    return 85; // Simplified for now
  }
}
