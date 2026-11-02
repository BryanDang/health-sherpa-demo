/**
 * Evaluation middleware for chat API - used during testing and development
 * Provides hooks for human-in-the-loop review and prompt tuning
 */

import { createHealthcareEvaluator, type HealthcareQuery, type HealthcareResponse, type EvaluationResult } from './ai-evaluation';
import type { ChatMessage, PhaseNumber } from '@/types/core';

export interface EvaluationSession {
  id: string;
  timestamp: string;
  query: HealthcareQuery;
  response: HealthcareResponse;
  evaluation: EvaluationResult;
  humanReview?: {
    approved: boolean;
    feedback: string;
    promptImprovements?: string;
    reviewedBy: string;
    reviewedAt: string;
  };
}

export interface EvaluationConfig {
  enabled: boolean;
  mode: 'testing' | 'monitoring' | 'disabled';
  enableHumanReview: boolean;
  logAllEvaluations: boolean;
  blockOnFailure: boolean;
}

export class EvaluationMiddleware {
  private evaluator: ReturnType<typeof createHealthcareEvaluator>;
  private config: EvaluationConfig;
  private evaluationSessions: Map<string, EvaluationSession> = new Map();
  
  constructor(config: EvaluationConfig) {
    this.config = config;
    this.evaluator = createHealthcareEvaluator();
  }

  /**
   * Evaluate a chat response during testing/development
   */
  async evaluateResponse(
    userMessage: string,
    aiResponse: string,
    phase: PhaseNumber,
    context?: string
  ): Promise<{
    evaluation: EvaluationResult;
    sessionId: string;
    shouldBlock: boolean;
  }> {
    
    if (!this.config.enabled) {
      return {
        evaluation: this.createPassthroughEvaluation(),
        sessionId: '',
        shouldBlock: false
      };
    }

    const query: HealthcareQuery = {
      text: userMessage,
      phase,
      context
    };

    const response: HealthcareResponse = {
      text: aiResponse,
      phase
    };

    const evaluation = await this.evaluator.evaluateHealthcareResponse(query, response);
    
    // Create evaluation session
    const sessionId = this.generateSessionId();
    const session: EvaluationSession = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      query,
      response,
      evaluation
    };

    this.evaluationSessions.set(sessionId, session);

    // Log if configured
    if (this.config.logAllEvaluations) {
      this.logEvaluation(session);
    }

    // Determine if response should be blocked
    const shouldBlock = this.config.blockOnFailure && !evaluation.passed;

    return {
      evaluation,
      sessionId,
      shouldBlock
    };
  }

  /**
   * Add human review to an evaluation session
   */
  async addHumanReview(
    sessionId: string,
    approved: boolean,
    feedback: string,
    promptImprovements?: string,
    reviewedBy: string = 'human-reviewer'
  ): Promise<void> {
    
    const session = this.evaluationSessions.get(sessionId);
    if (!session) {
      throw new Error(`Evaluation session ${sessionId} not found`);
    }

    session.humanReview = {
      approved,
      feedback,
      promptImprovements,
      reviewedBy,
      reviewedAt: new Date().toISOString()
    };

    this.evaluationSessions.set(sessionId, session);

    // Log human review
    console.log(`\n=== HUMAN REVIEW ADDED ===`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Approved: ${approved}`);
    console.log(`Feedback: ${feedback}`);
    if (promptImprovements) {
      console.log(`Prompt Improvements: ${promptImprovements}`);
    }

    // Save to file system for persistent storage during development
    await this.saveEvaluationSession(session);
  }

  /**
   * Get evaluation session for review
   */
  getEvaluationSession(sessionId: string): EvaluationSession | undefined {
    return this.evaluationSessions.get(sessionId);
  }

  /**
   * Get all evaluation sessions for analysis
   */
  getAllEvaluationSessions(): EvaluationSession[] {
    return Array.from(this.evaluationSessions.values());
  }

  /**
   * Generate evaluation report for prompt tuning
   */
  generateEvaluationReport(): {
    totalEvaluations: number;
    averageScores: {
      overall: number;
      medical_accuracy: number;
      safety_score: number;
      bias_detection: number;
      consistency_score: number;
      clarity_score: number;
    };
    failurePatterns: string[];
    improvementOpportunities: string[];
    humanReviewSummary: {
      totalReviews: number;
      approvalRate: number;
      commonFeedback: string[];
    };
  } {
    
    const sessions = this.getAllEvaluationSessions();
    
    if (sessions.length === 0) {
      return {
        totalEvaluations: 0,
        averageScores: {
          overall: 0,
          medical_accuracy: 0,
          safety_score: 0,
          bias_detection: 0,
          consistency_score: 0,
          clarity_score: 0
        },
        failurePatterns: [],
        improvementOpportunities: [],
        humanReviewSummary: {
          totalReviews: 0,
          approvalRate: 0,
          commonFeedback: []
        }
      };
    }

    // Calculate average scores
    const averageScores = {
      overall: sessions.reduce((sum, s) => sum + s.evaluation.overall_score, 0) / sessions.length,
      medical_accuracy: sessions.reduce((sum, s) => sum + s.evaluation.medical_accuracy, 0) / sessions.length,
      safety_score: sessions.reduce((sum, s) => sum + s.evaluation.safety_score, 0) / sessions.length,
      bias_detection: sessions.reduce((sum, s) => sum + s.evaluation.bias_detection, 0) / sessions.length,
      consistency_score: sessions.reduce((sum, s) => sum + s.evaluation.consistency_score, 0) / sessions.length,
      clarity_score: sessions.reduce((sum, s) => sum + s.evaluation.clarity_score, 0) / sessions.length
    };

    // Identify failure patterns
    const failedSessions = sessions.filter(s => !s.evaluation.passed);
    const failurePatterns = this.extractFailurePatterns(failedSessions);

    // Extract improvement opportunities
    const improvementOpportunities = sessions
      .flatMap(s => s.evaluation.improvement_suggestions)
      .filter((suggestion, index, arr) => arr.indexOf(suggestion) === index); // unique

    // Human review summary
    const reviewedSessions = sessions.filter(s => s.humanReview);
    const humanReviewSummary = {
      totalReviews: reviewedSessions.length,
      approvalRate: reviewedSessions.length > 0 
        ? reviewedSessions.filter(s => s.humanReview!.approved).length / reviewedSessions.length 
        : 0,
      commonFeedback: reviewedSessions
        .map(s => s.humanReview!.feedback)
        .filter((feedback, index, arr) => arr.indexOf(feedback) === index)
    };

    return {
      totalEvaluations: sessions.length,
      averageScores,
      failurePatterns,
      improvementOpportunities,
      humanReviewSummary
    };
  }

  private createPassthroughEvaluation(): EvaluationResult {
    return {
      overall_score: 1.0,
      medical_accuracy: 1.0,
      safety_score: 1.0,
      bias_detection: 1.0,
      consistency_score: 1.0,
      clarity_score: 1.0,
      confidence_level: 1.0,
      ambiguity_signals: [],
      safety_concerns: [],
      improvement_suggestions: [],
      passed: true,
      requires_human_review: false,
      evaluation_reasoning: 'Evaluation disabled'
    };
  }

  private generateSessionId(): string {
    return `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logEvaluation(session: EvaluationSession): void {
    console.log(`\n=== AI EVALUATION LOG ===`);
    console.log(`Session ID: ${session.id}`);
    console.log(`Timestamp: ${session.timestamp}`);
    console.log(`Query: ${session.query.text}`);
    console.log(`Phase: ${session.query.phase}`);
    console.log(`Overall Score: ${(session.evaluation.overall_score * 100).toFixed(1)}%`);
    console.log(`Safety Score: ${(session.evaluation.safety_score * 100).toFixed(1)}%`);
    console.log(`Medical Accuracy: ${(session.evaluation.medical_accuracy * 100).toFixed(1)}%`);
    console.log(`Passed: ${session.evaluation.passed}`);
    console.log(`Requires Review: ${session.evaluation.requires_human_review}`);
    
    if (session.evaluation.safety_concerns.length > 0) {
      console.log(`Safety Concerns: ${session.evaluation.safety_concerns.join(', ')}`);
    }
    
    if (session.evaluation.improvement_suggestions.length > 0) {
      console.log(`Improvements: ${session.evaluation.improvement_suggestions.join(', ')}`);
    }
  }

  private async saveEvaluationSession(session: EvaluationSession): Promise<void> {
    try {
      // In a real implementation, this would save to a database or file system
      // For now: log only, for development.
      console.log(`Saving evaluation session ${session.id} to persistent storage`);
      
      // Open: file system storage for development:
      // const fs = require('fs').promises;
      // const path = `./evaluation-sessions/${session.id}.json`;
      // await fs.writeFile(path, JSON.stringify(session, null, 2));
      
    } catch (error) {
      console.error('Failed to save evaluation session:', error);
    }
  }

  private extractFailurePatterns(failedSessions: EvaluationSession[]): string[] {
    const patterns: Set<string> = new Set();
    
    for (const session of failedSessions) {
      const eval = session.evaluation;
      
      if (eval.safety_score < 0.7) {
        patterns.add('Low safety scores in medical advice');
      }
      
      if (eval.medical_accuracy < 0.7) {
        patterns.add('Medical accuracy issues');
      }
      
      if (eval.bias_detection < 0.8) {
        patterns.add('Potential bias in responses');
      }
      
      if (eval.ambiguity_signals.length > 2) {
        patterns.add('High ambiguity in responses');
      }
      
      if (eval.safety_concerns.length > 0) {
        patterns.add('Safety concerns present');
      }
    }
    
    return Array.from(patterns);
  }
}

// Factory function for easy setup in different environments
export function createEvaluationMiddleware(
  mode: 'testing' | 'monitoring' | 'disabled' = 'testing'
): EvaluationMiddleware {
  
  const config: EvaluationConfig = {
    enabled: mode !== 'disabled',
    mode,
    enableHumanReview: mode === 'testing',
    logAllEvaluations: true,
    blockOnFailure: mode === 'testing'
  };
  
  return new EvaluationMiddleware(config);
}

// Global evaluation middleware instance for testing
export const testingEvaluationMiddleware = createEvaluationMiddleware('testing');