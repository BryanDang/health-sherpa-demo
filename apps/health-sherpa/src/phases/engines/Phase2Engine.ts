/**
 * Phase 2: Gather Insights Engine
 * Focuses on single priority goal and surfaces 5-7 key insights
 */

import {
  PhaseEngine,
  PhaseContext,
  PhaseResult,
  ValidationResult,
} from './PhaseEngine';
import {
  Phase2Input,
  Phase2Output,
  Insight,
  SherpaOpinion,
  UserProfile,
  CitationLocation,
  WebSource,
} from '@/types/core';

export class Phase2Engine extends PhaseEngine<Phase2Input, Phase2Output> {
  private readonly MAX_INSIGHTS = 7;
  private readonly MIN_INSIGHTS = 5;

  constructor() {
    super(
      2,
      'Gather Insights',
      'Focuses on single priority goal and surfaces key insights from documents and web research',
      true // Phase 2 uses advanced reasoning for complex knowledge gap identification
    );
  }

  async execute(
    input: Phase2Input,
    context: PhaseContext
  ): Promise<PhaseResult<Phase2Output>> {
    try {
      // Step 1: Focus on single priority goal
      const primaryGoal = this.extractPrimaryGoal(
        input.currentGoal,
        context.userProfile.goals
      );

      // Step 2: Check if re-analysis is needed
      const needsReanalysis = this.checkForReanalysis(input, context);

      // Step 3: Gather insights from multiple sources
      const insights = await this.gatherInsights(
        primaryGoal,
        input,
        context,
        needsReanalysis
      );

      // Step 4: Identify knowledge gaps
      const knowledgeGaps = await this.identifyKnowledgeGaps(
        insights,
        primaryGoal,
        context
      );

      // Step 5: Update Sherpa Opinion with new insights
      const updatedSherpaOpinion = this.updateSherpaOpinionWithInsights(
        input.sherpaOpinion,
        insights,
        knowledgeGaps
      );

      // Step 6: Calculate confidence levels
      const confidence = this.calculateInsightConfidence(
        insights,
        knowledgeGaps
      );

      const result: Phase2Output = {
        insights: insights.slice(0, this.MAX_INSIGHTS), // Ensure we don't exceed maximum
        updatedSherpaOpinion,
        knowledgeGaps,
        confidence,
      };

      return {
        success: true,
        data: result,
        updatedSherpaOpinion,
        confidence,
        nextPhaseReady: this.checkPhase3Readiness(insights),
        messages: [
          this.createPhaseMessage(
            this.generateInsightsMessage(insights, primaryGoal),
            'assistant',
            this.extractCitations(insights),
            confidence.phaseCompletionConfidence
          ),
        ],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Phase 2 execution failed',
      };
    }
  }

  validateContext(context: PhaseContext): ValidationResult {
    const missingRequirements: string[] = [];
    let confidence = 100;

    // Check Phase 1 completion
    if (!context.sherpaOpinion) {
      missingRequirements.push('Sherpa Opinion from Phase 1');
      confidence -= 40;
    } else {
      if (context.sherpaOpinion.clinicalFindings.length === 0) {
        missingRequirements.push('Clinical findings from Phase 1');
        confidence -= 20;
      }
    }

    // Check user profile completeness
    if (!context.userProfile || context.userProfile.goals.length === 0) {
      missingRequirements.push('User goals');
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
      'Clinical summary and findings from Phase 1',
      'Updated Sherpa Opinion',
      'Single priority goal to focus on',
      'User profile with expertise level',
      'Document citations from Phase 1',
    ];
  }

  getAdvancementCriteria(): string[] {
    return [
      `5-7 insights gathered (minimum ${this.MIN_INSIGHTS})`,
      'Knowledge gaps identified and documented',
      'Insights tied to primary goal',
      'Citations and sources tracked',
      'User engagement with insight gathering process',
    ];
  }

  private extractPrimaryGoal(currentGoal: string, allGoals: string[]): string {
    // If specific goal provided, use it; otherwise use first goal
    return currentGoal || allGoals[0] || 'General health understanding';
  }

  private checkForReanalysis(
    input: Phase2Input,
    context: PhaseContext
  ): boolean {
    const currentOpinion = input.sherpaOpinion;

    // Re-analyze if:
    // 1. New full transcript provided
    // 2. Confidence below threshold
    // 3. User brought new discoveries

    const hasNewTranscript = !!input.fullTranscript;
    const lowConfidence =
      currentOpinion.confidence.overallConfidence <
      currentOpinion.confidence.confidenceThreshold;

    return hasNewTranscript || lowConfidence;
  }

  private async gatherInsights(
    primaryGoal: string,
    input: Phase2Input,
    context: PhaseContext,
    needsReanalysis: boolean
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    // 1. Document-based insights
    const documentInsights = await this.extractDocumentInsights(
      input.sherpaOpinion,
      primaryGoal,
      context.userProfile
    );
    insights.push(...documentInsights);

    // 2. Web research insights (if needed)
    const webInsights = await this.gatherWebInsights(
      primaryGoal,
      context.userProfile
    );
    insights.push(...webInsights);

    // 3. Knowledge gap insights
    const gapInsights = await this.identifyGapInsights(insights, primaryGoal);
    insights.push(...gapInsights);

    // 4. Critical issue insights
    const criticalInsights = this.flagCriticalIssues(
      insights,
      input.sherpaOpinion
    );
    insights.push(...criticalInsights);

    // Prioritize and limit insights
    return this.prioritizeInsights(
      insights,
      primaryGoal,
      context.userProfile
    ).slice(0, this.MAX_INSIGHTS);
  }

  private async extractDocumentInsights(
    sherpaOpinion: SherpaOpinion,
    primaryGoal: string,
    userProfile: UserProfile
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Extract insights from clinical findings related to primary goal
    sherpaOpinion.clinicalFindings.forEach((finding, index) => {
      if (this.isRelevantToGoal(finding.content, primaryGoal)) {
        const insight: Insight = {
          id: `doc_insight_${index}`,
          content: this.adaptInsightForUser(finding.content, userProfile),
          source: 'document',
          citations: finding.citations,
          webSources: [],
          confidence: finding.confidence,
          phase: 2,
        };
        insights.push(insight);
      }
    });

    return insights;
  }

  private async gatherWebInsights(
    primaryGoal: string,
    userProfile: UserProfile
  ): Promise<Insight[]> {
    // In real implementation, this would call web search AI flows
    // For now, simulate web research insights

    const webInsights: Insight[] = [
      {
        id: 'web_insight_1',
        content: `Current medical research shows new approaches relevant to ${primaryGoal}`,
        source: 'web',
        citations: [],
        webSources: [
          {
            url: 'https://example.com/research',
            title: 'Recent Medical Research',
            excerpt: 'Relevant research findings...',
            retrievedAt: new Date().toISOString(),
          },
        ],
        confidence: 80,
        phase: 2,
      },
    ];

    return webInsights.filter((insight) =>
      this.isRelevantToGoal(insight.content, primaryGoal)
    );
  }

  private async identifyGapInsights(
    insights: Insight[],
    primaryGoal: string
  ): Promise<Insight[]> {
    // Identify what's missing from current insights
    const gapInsights: Insight[] = [];

    // Common knowledge gaps in healthcare
    const commonGaps = [
      'Lifestyle factors impact',
      'Medication interactions',
      'Long-term prognosis',
      'Prevention strategies',
      'Treatment alternatives',
    ];

    commonGaps.forEach((gap, index) => {
      if (
        !insights.some((insight) =>
          insight.content.toLowerCase().includes(gap.toLowerCase())
        )
      ) {
        gapInsights.push({
          id: `gap_insight_${index}`,
          content: `Knowledge gap identified: ${gap} related to ${primaryGoal}`,
          source: 'user', // Will be filled by user input
          citations: [],
          webSources: [],
          confidence: 60, // Lower confidence for gaps
          phase: 2,
        });
      }
    });

    return gapInsights.slice(0, 2); // Limit gap insights
  }

  private flagCriticalIssues(
    insights: Insight[],
    sherpaOpinion: SherpaOpinion
  ): Insight[] {
    const criticalInsights: Insight[] = [];

    // Check for high-risk findings that user might not be aware of
    const highRiskFindings = sherpaOpinion.clinicalFindings.filter(
      (finding) =>
        finding.riskLevel === 'high' || finding.riskLevel === 'critical'
    );

    highRiskFindings.forEach((finding, index) => {
      criticalInsights.push({
        id: `critical_insight_${index}`,
        content: `Warning, critical: ${finding.content}`,
        source: 'document',
        citations: finding.citations,
        webSources: [],
        confidence: finding.confidence,
        phase: 2,
      });
    });

    return criticalInsights;
  }

  private prioritizeInsights(
    insights: Insight[],
    primaryGoal: string,
    userProfile: UserProfile
  ): Insight[] {
    return insights.sort((a, b) => {
      // Priority factors:
      // 1. Relevance to primary goal
      // 2. User expertise level
      // 3. Source reliability
      // 4. Confidence level

      const aRelevance = this.calculateGoalRelevance(a.content, primaryGoal);
      const bRelevance = this.calculateGoalRelevance(b.content, primaryGoal);

      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance;
      }

      // If equally relevant, sort by confidence
      return b.confidence - a.confidence;
    });
  }

  private async identifyKnowledgeGaps(
    insights: Insight[],
    primaryGoal: string,
    context: PhaseContext
  ): Promise<string[]> {
    const gaps: string[] = [];

    // Analyze what's missing from insights relative to goal
    const coverageAreas = [
      'Current status',
      'Treatment options',
      'Risk factors',
      'Lifestyle impact',
      'Prognosis',
      'Prevention',
    ];

    coverageAreas.forEach((area) => {
      const covered = insights.some((insight) =>
        insight.content.toLowerCase().includes(area.toLowerCase())
      );

      if (!covered) {
        gaps.push(`${area} information for ${primaryGoal}`);
      }
    });

    return gaps;
  }

  private updateSherpaOpinionWithInsights(
    currentOpinion: SherpaOpinion,
    insights: Insight[],
    knowledgeGaps: string[]
  ): SherpaOpinion {
    // Add insights as findings and update knowledge gaps
    const newFindings = insights
      .filter((insight) => insight.source === 'document')
      .map((insight) => ({
        id: insight.id,
        content: insight.content,
        confidence: insight.confidence,
        citations: insight.citations,
        riskLevel: this.assessInsightRisk(insight.content) as any,
      }));

    const webSources = insights.flatMap((insight) => insight.webSources);

    return this.updateSherpaOpinion(currentOpinion, {
      clinicalFindings: [...currentOpinion.clinicalFindings, ...newFindings],
      knowledgeGaps: [...currentOpinion.knowledgeGaps, ...knowledgeGaps],
      webSourceCitations: [...currentOpinion.webSourceCitations, ...webSources],
      userProfileInfluence: `${currentOpinion.userProfileInfluence}. Phase 2: Gathered ${insights.length} insights focused on primary goal.`,
    });
  }

  private calculateInsightConfidence(
    insights: Insight[],
    knowledgeGaps: string[]
  ) {
    const factors = {
      dataQuality: this.assessInsightQuality(insights),
      completeness: this.assessInsightCompleteness(insights, knowledgeGaps),
      userEngagement: 80, // Will be updated based on user interaction
      citationStrength: this.assessCitationStrength(insights),
    };

    const overallConfidence = this.calculateConfidence(factors);

    return {
      overallConfidence,
      findingConfidence: insights.reduce((acc, insight) => {
        acc[insight.id] = insight.confidence;
        return acc;
      }, {} as any),
      knowledgeGapSeverity: knowledgeGaps.reduce((acc, gap, index) => {
        acc[`gap_${index}`] = 'moderate' as any;
        return acc;
      }, {} as any),
      confidenceThreshold: 70,
      lastReanalysisReason: 'Phase 2 insight gathering',
      readyForNextPhase:
        insights.length >= this.MIN_INSIGHTS && overallConfidence >= 70,
      phaseCompletionConfidence: overallConfidence,
    };
  }

  private checkPhase3Readiness(insights: Insight[]): boolean {
    return (
      insights.length >= this.MIN_INSIGHTS &&
      insights.length <= this.MAX_INSIGHTS
    );
  }

  private generateInsightsMessage(
    insights: Insight[],
    primaryGoal: string
  ): string {
    let message = `## Insights for: ${primaryGoal}\n\n`;
    message += `I've gathered ${insights.length} key insights to help you understand this area better:\n\n`;

    insights.forEach((insight, index) => {
      const sourceIcon =
        insight.source === 'document'
          ? '[document]'
          : insight.source === 'web'
            ? '[web]'
            : '[note]';
      message += `${index + 1}. ${sourceIcon} ${insight.content}\n\n`;
    });

    message += `Next, we'll organize these insights into a coherent understanding that guides your decisions.`;

    return message;
  }

  private extractCitations(insights: Insight[]): CitationLocation[] {
    return insights.flatMap((insight) => insight.citations);
  }

  // Helper methods
  private isRelevantToGoal(content: string, goal: string): boolean {
    const goalKeywords = goal.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    return goalKeywords.some((keyword) => contentLower.includes(keyword));
  }

  private adaptInsightForUser(
    content: string,
    userProfile: UserProfile
  ): string {
    // Adapt language based on user expertise
    if (userProfile.expertiseLevel === 'novice') {
      return content
        .replace(/myocardial infarction/gi, 'heart attack')
        .replace(/hypertension/gi, 'high blood pressure');
    }
    return content;
  }

  private calculateGoalRelevance(content: string, goal: string): number {
    const goalWords = goal.toLowerCase().split(' ');
    const contentWords = content.toLowerCase().split(' ');
    const matches = goalWords.filter((word) => contentWords.includes(word));
    return (matches.length / goalWords.length) * 100;
  }

  private assessInsightRisk(content: string): string {
    const highRiskTerms = ['critical', 'severe', 'urgent', 'emergency'];
    const moderateRiskTerms = ['elevated', 'abnormal', 'concerning'];

    const lowerContent = content.toLowerCase();

    if (highRiskTerms.some((term) => lowerContent.includes(term))) {
      return 'high';
    } else if (moderateRiskTerms.some((term) => lowerContent.includes(term))) {
      return 'moderate';
    }

    return 'low';
  }

  private assessInsightQuality(insights: Insight[]): number {
    const avgConfidence =
      insights.reduce((sum, insight) => sum + insight.confidence, 0) /
      insights.length;
    return avgConfidence || 0;
  }

  private assessInsightCompleteness(
    insights: Insight[],
    knowledgeGaps: string[]
  ): number {
    const totalAreas = insights.length + knowledgeGaps.length;
    const coveredAreas = insights.length;
    return totalAreas > 0 ? (coveredAreas / totalAreas) * 100 : 0;
  }

  private assessCitationStrength(insights: Insight[]): number {
    const withCitations = insights.filter(
      (insight) => insight.citations.length > 0 || insight.webSources.length > 0
    ).length;
    return insights.length > 0 ? (withCitations / insights.length) * 100 : 0;
  }
}
