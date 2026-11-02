'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Edit3,
  Save,
  ArrowRight,
  BarChart3,
  MessageSquare,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import type { EvaluationResult, HealthcareQuery, HealthcareResponse } from '@/lib/ai-evaluation';

interface EvaluationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: HealthcareQuery;
  response: HealthcareResponse;
  evaluation: EvaluationResult;
  onPromptImprovement: (improvedPrompt: string, feedback: string) => void;
  onAcceptResponse: () => void;
  onRejectResponse: () => void;
}

export default function EvaluationReviewModal({
  isOpen,
  onClose,
  query,
  response,
  evaluation,
  onPromptImprovement,
  onAcceptResponse,
  onRejectResponse
}: EvaluationReviewModalProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [improvedPrompt, setImprovedPrompt] = useState('');
  const [humanFeedback, setHumanFeedback] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  if (!isOpen) return null;

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 0.8) return 'default';
    if (score >= 0.6) return 'secondary';
    return 'destructive';
  };

  const metrics = [
    { key: 'medical_accuracy', label: 'Medical Accuracy', score: evaluation.medical_accuracy },
    { key: 'safety_score', label: 'Safety Score', score: evaluation.safety_score },
    { key: 'bias_detection', label: 'Bias Detection', score: evaluation.bias_detection },
    { key: 'consistency_score', label: 'Consistency', score: evaluation.consistency_score },
    { key: 'clarity_score', label: 'Clarity', score: evaluation.clarity_score },
    { key: 'confidence_level', label: 'Confidence Level', score: evaluation.confidence_level }
  ];

  const handleSavePromptImprovement = () => {
    onPromptImprovement(improvedPrompt, humanFeedback);
    setShowPromptEditor(false);
    setImprovedPrompt('');
    setHumanFeedback('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold">AI Response Evaluation Review</h2>
            <Badge variant={evaluation.passed ? 'default' : 'destructive'}>
              {evaluation.passed ? 'PASSED' : 'NEEDS REVIEW'}
            </Badge>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Overall Evaluation Score</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <Progress value={evaluation.overall_score * 100} className="h-4" />
                </div>
                <Badge variant={getScoreBadgeVariant(evaluation.overall_score)} className="text-lg px-3 py-1">
                  {(evaluation.overall_score * 100).toFixed(1)}%
                </Badge>
              </div>
              {evaluation.requires_human_review && (
                <div className="mt-3 flex items-center space-x-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Human review required</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Query and Response */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>User Query</span>
                  <Badge variant="outline">Phase {query.phase}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">{query.text}</p>
                {query.context && (
                  <div className="mt-3 p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600"><strong>Context:</strong> {query.context}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>AI Response</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 leading-relaxed">{response.text}</p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Evaluation Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.map((metric) => (
                  <div
                    key={metric.key}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedMetric === metric.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedMetric(selectedMetric === metric.key ? null : metric.key)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{metric.label}</span>
                      <span className={`text-lg font-bold ${getScoreColor(metric.score)}`}>
                        {(metric.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={metric.score * 100} className="mt-2 h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Safety Concerns & Improvements */}
          {(evaluation.safety_concerns.length > 0 || evaluation.improvement_suggestions.length > 0 || evaluation.ambiguity_signals.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {evaluation.safety_concerns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      <span>Safety Concerns</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {evaluation.safety_concerns.map((concern, index) => (
                        <li key={index} className="text-sm text-red-700 flex items-start space-x-2">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{concern}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {evaluation.ambiguity_signals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-yellow-600">
                      <AlertCircle className="h-5 w-5" />
                      <span>Ambiguity Signals</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {evaluation.ambiguity_signals.map((signal, index) => (
                        <li key={index} className="text-sm text-yellow-700 flex items-start space-x-2">
                          <Eye className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{signal}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {evaluation.improvement_suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-blue-600">
                      <ArrowRight className="h-5 w-5" />
                      <span>Improvements</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {evaluation.improvement_suggestions.map((suggestion, index) => (
                        <li key={index} className="text-sm text-blue-700 flex items-start space-x-2">
                          <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Evaluation Reasoning */}
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Reasoning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 leading-relaxed">{evaluation.evaluation_reasoning}</p>
            </CardContent>
          </Card>

          {/* Prompt Improvement Section */}
          {!showPromptEditor ? (
            <Card>
              <CardHeader>
                <CardTitle>Human Review & Prompt Tuning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Use this evaluation to improve the system prompt. Provide feedback and suggested prompt improvements to enhance future responses.
                </p>
                <Button
                  onClick={() => setShowPromptEditor(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Improve System Prompt
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Prompt Improvement Editor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Improved System Prompt</label>
                  <Textarea
                    value={improvedPrompt}
                    onChange={(e) => setImprovedPrompt(e.target.value)}
                    placeholder="Enter an improved version of the system prompt based on this evaluation..."
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Human Feedback & Reasoning</label>
                  <Textarea
                    value={humanFeedback}
                    onChange={(e) => setHumanFeedback(e.target.value)}
                    placeholder="Explain why these changes will improve the AI response quality..."
                    className="min-h-[80px]"
                  />
                </div>
                <div className="flex space-x-3">
                  <Button onClick={handleSavePromptImprovement} disabled={!improvedPrompt.trim()}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Improvement
                  </Button>
                  <Button variant="outline" onClick={() => setShowPromptEditor(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={onRejectResponse}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject Response
            </Button>
            <Button 
              onClick={onAcceptResponse}
              disabled={evaluation.safety_concerns.length > 0}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Accept Response
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}