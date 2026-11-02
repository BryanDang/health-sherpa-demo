/**
 * Phase 3: Synthesize Evidence Engine
 * Groups insights into coherent evidence groups with actionable headings
 */

import {
  PhaseEngine,
  PhaseContext,
  PhaseResult,
  ValidationResult,
} from './PhaseEngine';
import {
  Phase3Input,
  Phase3Output,
  EvidenceGroup,
  Insight,
  SherpaOpinion,
} from '@/types/core';

export class Phase3Engine extends PhaseEngine<Phase3Input, Phase3Output> {
  constructor() {
    super(
      3,
      'Synthesize Evidence',
      'Groups loose insights into coherent evidence groups with actionable headings',
      true // Phase 3 uses advanced reasoning for evidence synthesis and grouping
    );
  }

  async execute(
    input: Phase3Input,
    context: PhaseContext
  ): Promise<PhaseResult<Phase3Output>> {
    try {
      // Step 1: Analyze insights for grouping opportunities
      const groupingAnalysis = await this.analyzeInsightsForGrouping(
        input.phase2Insights,
        context.userProfile
      );

      // Step 2: Generate AI-suggested evidence groups
      const suggestedGroups = await this.generateEvidenceGroups(
        input.phase2Insights,
        groupingAnalysis,
        context
      );

      // Step 3: Create synthesized headings
      const synthesizedHeadings =
        this.generateSynthesizedHeadings(suggestedGroups);

      // Step 4: Connect insights and facilitate understanding
      const connectedGroups = await this.facilitateConnections(
        suggestedGroups,
        input.sherpaOpinion,
        context
      );

      // Step 5: Update Sherpa Opinion with synthesis
      const updatedSherpaOpinion = this.updateSherpaOpinionWithSynthesis(
        input.sherpaOpinion,
        connectedGroups
      );

      // Step 6: Calculate confidence
      const confidence = this.calculateSynthesisConfidence(connectedGroups);

      const result: Phase3Output = {
        evidenceGroups: connectedGroups,
        synthesizedHeadings,
        updatedSherpaOpinion,
        confidence,
      };

      return {
        success: true,
        data: result,
        updatedSherpaOpinion,
        confidence,
        nextPhaseReady: this.checkPhase4Readiness(connectedGroups),
        messages: [
          this.createPhaseMessage(
            this.generateSynthesisMessage(connectedGroups, synthesizedHeadings),
            'assistant',
            this.extractAllCitations(connectedGroups),
            confidence.phaseCompletionConfidence
          ),
        ],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Phase 3 execution failed',
      };
    }
  }

  validateContext(context: PhaseContext): ValidationResult {
    const missingRequirements: string[] = [];
    let confidence = 100;

    // Check Sherpa Opinion exists
    if (!context.sherpaOpinion) {
      missingRequirements.push('Sherpa Opinion from previous phases');
      confidence -= 40;
    }

    // Check user profile
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
      'Phase 2 insights (5-7 insights)',
      'Updated Sherpa Opinion',
      'User profile for context',
      'User goals for actionable orientation',
    ];
  }

  getAdvancementCriteria(): string[] {
    return [
      'Insights grouped into coherent evidence groups',
      'Synthesized headings relate to actionable outcomes',
      'Connections between insights established',
      'Evidence prepared for Phase 4 action development',
      'User has reviewed and modified groupings',
    ];
  }

  private async analyzeInsightsForGrouping(
    insights: Insight[],
    userProfile: any
  ) {
    // Analyze insights for natural grouping patterns
    const analysis = {
      topicClusters: this.identifyTopicClusters(insights),
      causalRelationships: this.findCausalRelationships(insights),
      riskLevels: this.categorizeByRisk(insights),
      actionableAreas: this.identifyActionableAreas(insights, userProfile),
    };

    return analysis;
  }

  private async generateEvidenceGroups(
    insights: Insight[],
    analysis: any,
    context: PhaseContext
  ): Promise<EvidenceGroup[]> {
    const groups: EvidenceGroup[] = [];

    // Create groups based on analysis
    // 1. Risk-based groupings
    if (analysis.riskLevels.high.length > 0) {
      groups.push({
        id: 'group_high_priority',
        heading: 'High Priority Concerns',
        insights: analysis.riskLevels.high,
        synthesizedContent: this.synthesizeInsights(analysis.riskLevels.high),
        confidence: this.calculateGroupConfidence(analysis.riskLevels.high),
      });
    }

    // 2. Topic-based groupings
    analysis.topicClusters.forEach((cluster: any, index: number) => {
      if (cluster.insights.length >= 2) {
        groups.push({
          id: `group_topic_${index}`,
          heading: cluster.topic,
          insights: cluster.insights,
          synthesizedContent: this.synthesizeInsights(cluster.insights),
          confidence: this.calculateGroupConfidence(cluster.insights),
        });
      }
    });

    // 3. Actionable area groupings
    analysis.actionableAreas.forEach((area: any, index: number) => {
      if (area.insights.length > 0) {
        groups.push({
          id: `group_actionable_${index}`,
          heading: `Actions for ${area.area}`,
          insights: area.insights,
          synthesizedContent: this.synthesizeInsights(area.insights),
          confidence: this.calculateGroupConfidence(area.insights),
        });
      }
    });

    // Cap at 5 groups for clarity
    return groups.slice(0, 5);
  }

  private generateSynthesizedHeadings(groups: EvidenceGroup[]): string[] {
    return groups.map((group) => group.heading);
  }

  private async facilitateConnections(
    groups: EvidenceGroup[],
    sherpaOpinion: SherpaOpinion,
    context: PhaseContext
  ): Promise<EvidenceGroup[]> {
    // Enhance groups with connections and explanations
    return groups.map((group) => ({
      ...group,
      synthesizedContent: this.enhanceWithConnections(
        group.synthesizedContent,
        group.insights,
        sherpaOpinion,
        context.userProfile
      ),
    }));
  }

  private updateSherpaOpinionWithSynthesis(
    currentOpinion: SherpaOpinion,
    evidenceGroups: EvidenceGroup[]
  ): SherpaOpinion {
    // Update assumptions based on synthesis
    const synthesisAssumptions = evidenceGroups.map((group, index) => ({
      id: `synthesis_assumption_${index}`,
      content: `Evidence synthesis: ${group.heading}`,
      confidence: group.confidence,
      basedOnFindings: group.insights.map((insight) => insight.id),
    }));

    return this.updateSherpaOpinion(currentOpinion, {
      assumptions: [...currentOpinion.assumptions, ...synthesisAssumptions],
      userProfileInfluence: `${currentOpinion.userProfileInfluence}. Phase 3: Synthesized ${evidenceGroups.length} evidence groups.`,
    });
  }

  private calculateSynthesisConfidence(evidenceGroups: EvidenceGroup[]) {
    const avgGroupConfidence =
      evidenceGroups.reduce((sum, group) => sum + group.confidence, 0) /
      evidenceGroups.length;

    const factors = {
      dataQuality: avgGroupConfidence,
      completeness: evidenceGroups.length >= 2 ? 90 : 60,
      userEngagement: 85, // Will be updated based on user modifications
      citationStrength: this.assessGroupCitationStrength(evidenceGroups),
    };

    const overallConfidence = this.calculateConfidence(factors);

    return {
      overallConfidence,
      findingConfidence: evidenceGroups.reduce((acc, group) => {
        acc[group.id] = group.confidence;
        return acc;
      }, {} as any),
      knowledgeGapSeverity: {},
      confidenceThreshold: 70,
      lastReanalysisReason: 'Phase 3 evidence synthesis',
      readyForNextPhase: evidenceGroups.length >= 2 && overallConfidence >= 70,
      phaseCompletionConfidence: overallConfidence,
    };
  }

  private checkPhase4Readiness(evidenceGroups: EvidenceGroup[]): boolean {
    return (
      evidenceGroups.length >= 2 &&
      evidenceGroups.every((group) => group.insights.length > 0)
    );
  }

  private generateSynthesisMessage(
    evidenceGroups: EvidenceGroup[],
    headings: string[]
  ): string {
    let message = '## Evidence Synthesis\n\n';
    message += `I've organized your insights into ${evidenceGroups.length} key evidence groups:\n\n`;

    evidenceGroups.forEach((group, index) => {
      message += `### ${index + 1}. ${group.heading}\n`;
      message += `${group.synthesizedContent}\n\n`;
      message += `*Based on ${group.insights.length} insight${group.insights.length > 1 ? 's' : ''}*\n\n`;
    });

    message +=
      'These groups help us see the connections between different pieces of information. ';
    message +=
      "Next, we'll translate this evidence into specific actions you can take.";

    return message;
  }

  private extractAllCitations(evidenceGroups: EvidenceGroup[]) {
    return evidenceGroups.flatMap((group) =>
      group.insights.flatMap((insight) => insight.citations)
    );
  }

  // Helper methods
  private identifyTopicClusters(insights: Insight[]) {
    const clusters: any[] = [];
    const topics = [
      'symptoms',
      'medications',
      'lifestyle',
      'tests',
      'treatment',
    ];

    topics.forEach((topic) => {
      const topicInsights = insights.filter((insight) =>
        insight.content.toLowerCase().includes(topic)
      );

      if (topicInsights.length > 0) {
        clusters.push({
          topic: topic.charAt(0).toUpperCase() + topic.slice(1),
          insights: topicInsights,
        });
      }
    });

    return clusters;
  }

  private findCausalRelationships(insights: Insight[]) {
    // Simplified causal relationship detection
    return insights.filter(
      (insight) =>
        insight.content.toLowerCase().includes('cause') ||
        insight.content.toLowerCase().includes('due to') ||
        insight.content.toLowerCase().includes('because')
    );
  }

  private categorizeByRisk(insights: Insight[]) {
    return {
      high: insights.filter((insight) => insight.content.includes('Warning')),
      moderate: insights.filter(
        (insight) => !insight.content.includes('Warning') && insight.confidence > 70
      ),
      low: insights.filter((insight) => insight.confidence <= 70),
    };
  }

  private identifyActionableAreas(insights: Insight[], userProfile: any) {
    const areas = ['diet', 'exercise', 'medication', 'monitoring'];

    return areas
      .map((area) => ({
        area,
        insights: insights.filter((insight) =>
          insight.content.toLowerCase().includes(area)
        ),
      }))
      .filter((area) => area.insights.length > 0);
  }

  private synthesizeInsights(insights: Insight[]): string {
    if (insights.length === 0) return '';

    if (insights.length === 1) {
      return insights[0].content;
    }

    // Combine insights into coherent narrative
    let synthesis = 'The evidence shows that ';

    const key_points = insights.map((insight) => {
      // Extract key point from each insight
      return insight.content.split('.')[0] + '.';
    });

    synthesis += key_points.join(' Additionally, ');

    return synthesis;
  }

  private calculateGroupConfidence(insights: Insight[]): number {
    if (insights.length === 0) return 0;

    const avgConfidence =
      insights.reduce((sum, insight) => sum + insight.confidence, 0) /
      insights.length;

    // Boost confidence for groups with multiple supporting insights
    const groupBonus = Math.min(insights.length * 5, 20);

    return Math.min(100, avgConfidence + groupBonus);
  }

  private enhanceWithConnections(
    content: string,
    insights: Insight[],
    sherpaOpinion: SherpaOpinion,
    userProfile: any
  ): string {
    let enhanced = content;

    // Add connection to other findings if relevant
    if (insights.length > 1) {
      enhanced +=
        '\n\nThis connects to other findings in your health information, ';
      enhanced += 'creating a more complete picture of your situation.';
    }

    // Add user-specific context
    if (userProfile.expertiseLevel === 'novice') {
      enhanced +=
        '\n\n*Simplified explanation: This information helps you understand ';
      enhanced +=
        "what's happening and what you might consider doing about it.*";
    }

    return enhanced;
  }

  private assessGroupCitationStrength(evidenceGroups: EvidenceGroup[]): number {
    const totalInsights = evidenceGroups.reduce(
      (sum, group) => sum + group.insights.length,
      0
    );

    const withCitations = evidenceGroups.reduce(
      (sum, group) =>
        sum +
        group.insights.filter(
          (insight) =>
            insight.citations.length > 0 || insight.webSources.length > 0
        ).length,
      0
    );

    return totalInsights > 0 ? (withCitations / totalInsights) * 100 : 0;
  }
}
