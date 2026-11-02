'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Brain,
  Shield,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { testingEvaluationMiddleware, type EvaluationSession } from '@/lib/evaluation-middleware';

interface EvaluationStats {
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
}

export default function EvaluationDashboard() {
  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<EvaluationSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvaluationData();
  }, []);

  const loadEvaluationData = () => {
    setIsLoading(true);
    
    try {
      const report = testingEvaluationMiddleware.generateEvaluationReport();
      const sessions = testingEvaluationMiddleware.getAllEvaluationSessions()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10); // Most recent 10 sessions

      setStats(report);
      setRecentSessions(sessions);
    } catch (error) {
      console.error('Failed to load evaluation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-50 border-green-200';
    if (score >= 0.6) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">AI Evaluation Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-center">
          <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">No Evaluation Data</h2>
          <p className="text-gray-500 mt-2">Run AI evaluation tests to see dashboard data</p>
          <Button className="mt-4" onClick={loadEvaluationData}>
            Refresh Data
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">AI Evaluation Dashboard</h1>
        </div>
        <Button onClick={loadEvaluationData} variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Total Evaluations</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold">{stats.totalEvaluations}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Average Score</span>
            </div>
            <div className="mt-2">
              <span className={`text-2xl font-bold ${getScoreColor(stats.averageScores.overall)}`}>
                {(stats.averageScores.overall * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Human Reviews</span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold">{stats.humanReviewSummary.totalReviews}</span>
              <span className="text-sm text-gray-500 ml-2">
                ({(stats.humanReviewSummary.approvalRate * 100).toFixed(1)}% approved)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Safety Score</span>
            </div>
            <div className="mt-2">
              <span className={`text-2xl font-bold ${getScoreColor(stats.averageScores.safety_score)}`}>
                {(stats.averageScores.safety_score * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Metrics Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(stats.averageScores).map(([key, value]) => {
              if (key === 'overall') return null;
              
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              
              return (
                <div key={key} className={`p-4 rounded-lg border ${getScoreBgColor(value)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{label}</span>
                    <span className={`text-lg font-bold ${getScoreColor(value)}`}>
                      {(value * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={value * 100} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Failure Patterns & Improvements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>Failure Patterns</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.failurePatterns.length > 0 ? (
              <ul className="space-y-2">
                {stats.failurePatterns.map((pattern, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{pattern}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm">No failure patterns detected</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span>Improvement Opportunities</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.improvementOpportunities.length > 0 ? (
              <ul className="space-y-2">
                {stats.improvementOpportunities.slice(0, 5).map((opportunity, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{opportunity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm">No specific improvements identified</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Evaluation Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-gray-600" />
            <span>Recent Evaluation Sessions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSessions.length > 0 ? (
            <div className="space-y-4">
              {recentSessions.map((session) => (
                <div key={session.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant={session.evaluation.passed ? 'default' : 'destructive'}>
                        {session.evaluation.passed ? 'PASSED' : 'FAILED'}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(session.timestamp).toLocaleString()}
                      </span>
                      <Badge variant="outline">Phase {session.query.phase}</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${getScoreColor(session.evaluation.overall_score)}`}>
                        {(session.evaluation.overall_score * 100).toFixed(1)}%
                      </span>
                      {session.humanReview && (
                        <Badge variant={session.humanReview.approved ? 'default' : 'secondary'}>
                          {session.humanReview.approved ? 'Human Approved' : 'Human Reviewed'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 mb-2">
                    <strong>Query:</strong> {session.query.text.slice(0, 100)}
                    {session.query.text.length > 100 && '...'}
                  </div>
                  {session.evaluation.safety_concerns.length > 0 && (
                    <div className="text-sm text-red-600">
                      <strong>Safety Concerns:</strong> {session.evaluation.safety_concerns.join(', ')}
                    </div>
                  )}
                  {session.humanReview && (
                    <div className="text-sm text-blue-600 mt-2">
                      <strong>Human Feedback:</strong> {session.humanReview.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <Eye className="h-8 w-8 mx-auto mb-2" />
              <p>No recent evaluation sessions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Human Review Summary */}
      {stats.humanReviewSummary.totalReviews > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-purple-600" />
              <span>Human Review Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.humanReviewSummary.totalReviews}
                </div>
                <div className="text-sm text-gray-600">Total Reviews</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(stats.humanReviewSummary.approvalRate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Approval Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.humanReviewSummary.commonFeedback.length}
                </div>
                <div className="text-sm text-gray-600">Unique Feedback</div>
              </div>
            </div>
            
            {stats.humanReviewSummary.commonFeedback.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Common Feedback:</h4>
                <ul className="space-y-1">
                  {stats.humanReviewSummary.commonFeedback.slice(0, 3).map((feedback, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0" />
                      <span>{feedback}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}