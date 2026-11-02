/**
 * Phase 1: Clinical Summary Engine
 * Generates tailored clinical summaries based on user profile and document analysis
 */

import {
  PhaseEngine,
  PhaseContext,
  PhaseResult,
  ValidationResult,
} from './PhaseEngine';
import {
  Phase1Input,
  Phase1Output,
  SherpaOpinion,
  UserProfile,
  HealthDocument,
  Finding,
  RiskLevel,
  CitationLocation,
} from '@/types/core';

export class Phase1Engine extends PhaseEngine<Phase1Input, Phase1Output> {
  constructor() {
    super(
      1,
      'Clinical Summary',
      'Generates tailored clinical summaries based on user goals and document analysis',
      false // Phase 1 uses straightforward summary generation, not advanced reasoning
    );
  }

  async execute(
    input: Phase1Input,
    context: PhaseContext
  ): Promise<PhaseResult<Phase1Output>> {
    try {
      // Step 1: Analyze document content with user context
      const documentAnalysis = await this.analyzeDocumentWithContext(
        input.transcribedRedactedDocument,
        input.userProfile,
        input.userGoals
      );

      // Step 2: Generate tailored clinical summary
      const clinicalSummary = await this.generateTailoredSummary(
        documentAnalysis,
        input.userProfile,
        input.userGoals
      );

      // Step 3: Update Sherpa Opinion with Phase 1 insights
      const updatedSherpaOpinion = this.updateSherpaOpinionWithSummary(
        input.documentAnalysis,
        documentAnalysis,
        input.userProfile
      );

      // Step 4: Calculate confidence levels
      const confidence = this.calculateSummaryConfidence(
        documentAnalysis,
        input.userProfile
      );

      const result: Phase1Output = {
        clinicalSummary,
        sherpaOpinion: updatedSherpaOpinion,
        confidence,
      };

      return {
        success: true,
        data: result,
        updatedSherpaOpinion,
        confidence,
        nextPhaseReady: confidence.readyForNextPhase,
        messages: [
          this.createPhaseMessage(
            clinicalSummary,
            'assistant',
            documentAnalysis.citations,
            confidence.phaseCompletionConfidence
          ),
        ],
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Phase 1 execution failed',
      };
    }
  }

  validateContext(context: PhaseContext): ValidationResult {
    const missingRequirements: string[] = [];
    let confidence = 100;

    // Check user profile exists and is complete
    if (!context.userProfile) {
      missingRequirements.push('User profile');
      confidence -= 40;
    } else {
      if (!context.userProfile.role) {
        missingRequirements.push('User role');
        confidence -= 15;
      }
      if (context.userProfile.goals.length === 0) {
        missingRequirements.push('User goals');
        confidence -= 20;
      }
      if (!context.userProfile.expertiseLevel) {
        missingRequirements.push('User expertise level');
        confidence -= 10;
      }
    }

    // Check Sherpa Opinion exists (from Phase 0)
    if (!context.sherpaOpinion) {
      missingRequirements.push('Initial Sherpa Opinion from Phase 0');
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
      'Complete user profile with role, goals, and expertise level',
      'Document content (transcribed and redacted)',
      'Initial Sherpa Opinion from Phase 0',
      'User communication preferences',
    ];
  }

  getAdvancementCriteria(): string[] {
    return [
      'Clinical summary generated and tailored to user role',
      'Key findings identified and prioritized',
      'Goals mapped to clinical content',
      'Summary acknowledged by user',
      'Confidence level above threshold for Phase 2',
    ];
  }

  private async analyzeDocumentWithContext(
    documentContent: string,
    userProfile: UserProfile,
    userGoals: string[]
  ) {
    // In real implementation, this would call AI service for analysis
    // For now, simulate sophisticated document analysis

    const lines = documentContent.split('\n');
    const findings: Finding[] = [];
    const citations: CitationLocation[] = [];

    // Simulate finding key clinical information
    lines.forEach((line, index) => {
      if (this.containsKeyMedicalInfo(line)) {
        const finding: Finding = {
          id: `finding_${index}`,
          content: this.extractFindingFromLine(line),
          confidence: this.calculateLineConfidence(line),
          citations: [
            {
              documentId: 'current_doc',
              lineNumbers: [index + 1],
              excerpt: line.trim(),
            },
          ],
          riskLevel: this.assessRiskLevel(line),
        };

        findings.push(finding);
        citations.push(...finding.citations);
      }
    });

    return {
      findings,
      citations,
      keyTopics: this.extractKeyTopics(documentContent),
      goalRelevance: this.mapGoalsToContent(userGoals, documentContent),
      complexity: this.assessContentComplexity(documentContent),
    };
  }

  private async generateTailoredSummary(
    documentAnalysis: any,
    userProfile: UserProfile,
    userGoals: string[]
  ): Promise<string> {
    // Generate summary based on user role and expertise level
    const summaryStyle = this.getSummaryStyle(userProfile);
    const prioritizedFindings = this.prioritizeFindingsForUser(
      documentAnalysis.findings,
      userProfile,
      userGoals
    );

    let summary = '';

    // Opening based on user role
    summary += this.generateRoleBasedOpening(userProfile, userGoals);
    summary += '\n\n';

    // Key findings section
    summary += this.generateFindingsSection(prioritizedFindings, summaryStyle);
    summary += '\n\n';

    // Goal-specific insights
    if (userGoals.length > 0) {
      summary += this.generateGoalSpecificInsights(
        userGoals,
        documentAnalysis.goalRelevance,
        summaryStyle
      );
      summary += '\n\n';
    }

    // Next steps preview
    summary += this.generateNextStepsPreview(userProfile);

    return summary;
  }

  private getSummaryStyle(userProfile: UserProfile) {
    return {
      vocabularyLevel:
        userProfile.expertiseLevel === 'expert'
          ? 'clinical'
          : userProfile.expertiseLevel === 'intermediate'
            ? 'moderate'
            : 'accessible',
      sentenceLength: userProfile.mirroringCues.sentenceLength,
      tone: userProfile.mirroringCues.emotionalTone,
      includeDetails:
        userProfile.role === 'provider' ||
        userProfile.expertiseLevel === 'expert',
    };
  }

  private prioritizeFindingsForUser(
    findings: Finding[],
    userProfile: UserProfile,
    userGoals: string[]
  ): Finding[] {
    return findings
      .filter((finding) =>
        this.isRelevantToUser(finding, userProfile, userGoals)
      )
      .sort((a, b) => {
        // Sort by risk level first, then confidence
        const riskPriority =
          this.getRiskPriority(b.riskLevel) - this.getRiskPriority(a.riskLevel);
        if (riskPriority !== 0) return riskPriority;
        return b.confidence - a.confidence;
      })
      .slice(0, 8); // Limit to top 8 findings
  }

  private generateRoleBasedOpening(
    userProfile: UserProfile,
    userGoals: string[]
  ): string {
    const goalText =
      userGoals.length > 0
        ? `focusing on your goal${userGoals.length > 1 ? 's' : ''}: ${userGoals.join(', ')}`
        : 'based on the information provided';

    switch (userProfile.role) {
      case 'provider':
        return `## Clinical Summary\n\nThis analysis ${goalText} presents the key clinical findings and their implications for patient care.`;

      case 'family_member':
        return `## Healthcare Summary\n\nHere's what I found in the medical information ${goalText}, presented in a way that helps you support your loved one's healthcare decisions.`;

      case 'caregiver':
        return `## Care Summary\n\nThis summary ${goalText} highlights the important medical information relevant to the care you're providing.`;

      default: // patient
        return `## Your Healthcare Summary\n\nI've reviewed your medical information ${goalText}. Here's what's most important for you to understand about your health.`;
    }
  }

  private generateFindingsSection(findings: Finding[], style: any): string {
    let section = '### Key Findings\n\n';

    findings.forEach((finding, index) => {
      const bullet = `${index + 1}. `;
      const content = this.adaptFindingLanguage(finding.content, style);
      const riskIndicator =
        finding.riskLevel !== 'low'
          ? ` Warning: ${finding.riskLevel.toUpperCase()}`
          : '';

      section += `${bullet}${content}${riskIndicator}\n\n`;
    });

    return section.trim();
  }

  private generateGoalSpecificInsights(
    userGoals: string[],
    goalRelevance: any,
    style: any
  ): string {
    let section = '### Related to Your Goals\n\n';

    userGoals.forEach((goal, index) => {
      const relevantInfo = goalRelevance[goal] || [];
      if (relevantInfo.length > 0) {
        section += `**${goal}:**\n`;
        relevantInfo.forEach((info: string) => {
          section += `- ${this.adaptLanguage(info, style)}\n`;
        });
        section += '\n';
      }
    });

    return section.trim();
  }

  private generateNextStepsPreview(userProfile: UserProfile): string {
    const nextSteps =
      userProfile.role === 'provider'
        ? 'We can now dive deeper into specific clinical areas of concern and gather additional insights.'
        : 'Next, we can explore specific areas in more detail and gather insights that matter to you.';

    return `### What's Next\n\n${nextSteps}`;
  }

  private updateSherpaOpinionWithSummary(
    initialOpinion: SherpaOpinion,
    documentAnalysis: any,
    userProfile: UserProfile
  ): SherpaOpinion {
    return this.updateSherpaOpinion(initialOpinion, {
      clinicalFindings: documentAnalysis.findings,
      knowledgeGaps: this.identifyKnowledgeGaps(documentAnalysis, userProfile),
      assumptions: this.identifyAssumptions(documentAnalysis),
      riskAssessment: this.calculateOverallRisk(documentAnalysis.findings),
      documentCitations: documentAnalysis.citations,
      userProfileInfluence: `${initialOpinion.userProfileInfluence}. Phase 1: Summary tailored for ${userProfile.role} with ${userProfile.expertiseLevel} expertise.`,
    });
  }

  private calculateSummaryConfidence(
    documentAnalysis: any,
    userProfile: UserProfile
  ) {
    const factors = {
      dataQuality: this.assessDataQuality(documentAnalysis),
      completeness: this.assessCompleteness(documentAnalysis),
      userEngagement: this.assessUserAlignment(documentAnalysis, userProfile),
      citationStrength: this.assessCitationStrength(documentAnalysis.citations),
    };

    const overallConfidence = this.calculateConfidence(factors);

    return {
      overallConfidence,
      findingConfidence: documentAnalysis.findings.reduce(
        (acc: any, finding: Finding) => {
          acc[finding.id] = finding.confidence;
          return acc;
        },
        {}
      ),
      knowledgeGapSeverity: {},
      confidenceThreshold: 70,
      lastReanalysisReason: 'Phase 1 clinical summary generation',
      readyForNextPhase: overallConfidence >= 70,
      phaseCompletionConfidence: overallConfidence,
    };
  }

  // Helper methods
  private containsKeyMedicalInfo(line: string): boolean {
    const medicalKeywords = [
      'diagnosis',
      'symptom',
      'treatment',
      'medication',
      'test',
      'result',
      'blood pressure',
      'heart rate',
      'temperature',
      'pain',
      'condition',
    ];
    return medicalKeywords.some((keyword) =>
      line.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private extractFindingFromLine(line: string): string {
    // Simulate extracting key medical information from a line
    return line.trim().substring(0, 100) + (line.length > 100 ? '...' : '');
  }

  private calculateLineConfidence(line: string): number {
    // Simulate confidence based on line content
    const hasNumbers = /\d/.test(line);
    const hasKeywords = this.containsKeyMedicalInfo(line);
    const isComplete = line.length > 20 && line.endsWith('.');

    let confidence = 50;
    if (hasNumbers) confidence += 20;
    if (hasKeywords) confidence += 20;
    if (isComplete) confidence += 10;

    return Math.min(100, confidence);
  }

  private assessRiskLevel(line: string): RiskLevel {
    const highRiskTerms = [
      'severe',
      'critical',
      'emergency',
      'urgent',
      'abnormal',
    ];
    const moderateRiskTerms = [
      'elevated',
      'concerning',
      'monitor',
      'follow-up',
    ];

    const lowerLine = line.toLowerCase();

    if (highRiskTerms.some((term) => lowerLine.includes(term))) {
      return 'high';
    } else if (moderateRiskTerms.some((term) => lowerLine.includes(term))) {
      return 'moderate';
    }

    return 'low';
  }

  private extractKeyTopics(content: string): string[] {
    // Simulate topic extraction
    return ['Cardiovascular Health', 'Blood Work', 'Medications', 'Symptoms'];
  }

  private mapGoalsToContent(goals: string[], content: string): any {
    // Simulate mapping user goals to document content
    const mapping: any = {};
    goals.forEach((goal) => {
      mapping[goal] = [`Information related to ${goal} found in document`];
    });
    return mapping;
  }

  private assessContentComplexity(content: string): 'low' | 'medium' | 'high' {
    const medicalTermCount = (
      content.match(/medical|clinical|diagnosis|treatment/gi) || []
    ).length;
    const wordCount = content.split(' ').length;
    const complexity = medicalTermCount / wordCount;

    if (complexity > 0.1) return 'high';
    if (complexity > 0.05) return 'medium';
    return 'low';
  }

  private isRelevantToUser(
    finding: Finding,
    userProfile: UserProfile,
    userGoals: string[]
  ): boolean {
    // Simulate relevance checking
    return true; // For now, all findings are considered relevant
  }

  private getRiskPriority(riskLevel: RiskLevel): number {
    const priorities = { critical: 4, high: 3, moderate: 2, low: 1 };
    return priorities[riskLevel] || 1;
  }

  private adaptFindingLanguage(content: string, style: any): string {
    // Simulate language adaptation based on user expertise
    if (style.vocabularyLevel === 'accessible') {
      return content
        .replace(/myocardial infarction/gi, 'heart attack')
        .replace(/hypertension/gi, 'high blood pressure');
    }
    return content;
  }

  private adaptLanguage(content: string, style: any): string {
    return this.adaptFindingLanguage(content, style);
  }

  private identifyKnowledgeGaps(
    documentAnalysis: any,
    userProfile: UserProfile
  ): string[] {
    // Simulate knowledge gap identification
    return [
      'Recent lab results interpretation',
      'Medication interactions',
      'Lifestyle factors impact',
    ];
  }

  private identifyAssumptions(documentAnalysis: any) {
    // Simulate assumption identification
    return [
      {
        id: 'assumption_1',
        content: 'Patient is compliant with current medications',
        confidence: 70,
        basedOnFindings: ['finding_1'],
      },
    ];
  }

  private calculateOverallRisk(findings: Finding[]): RiskLevel {
    const risks = findings.map((f) => f.riskLevel);
    if (risks.includes('critical') || risks.includes('high')) return 'high';
    if (risks.includes('moderate')) return 'moderate';
    return 'low';
  }

  private assessDataQuality(analysis: any): number {
    return 80; // Simulate data quality assessment
  }

  private assessCompleteness(analysis: any): number {
    return 75; // Simulate completeness assessment
  }

  private assessUserAlignment(analysis: any, userProfile: UserProfile): number {
    return 85; // Simulate user alignment assessment
  }

  private assessCitationStrength(citations: CitationLocation[]): number {
    return citations.length > 0 ? 90 : 50;
  }
}
