'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Lightbulb,
  Search,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  ExternalLink,
  Phone,
  Info,
  Heart,
} from 'lucide-react';

interface Citation {
  title: string;
  url: string;
  source: string;
  excerpt: string;
  credibility: 'high' | 'medium' | 'low';
  relevance?: 'high' | 'medium' | 'low';
}

interface TriageResponse {
  message: string;
  care_level?: 'emergency' | 'urgent' | 'primary' | 'self_care';
  careLevel?: 'emergency' | 'urgent' | 'primary' | 'self_care';
  confidence: number;
  reasoning: any;
  red_flags?: string[];
  immediate_actions?: string[];
  citations?: Citation[];
  needs_more_info?: boolean;
  needsMoreInfo?: boolean;
  follow_up_questions?: string[];
  followUpQuestions?: string[];
  medical_disclaimer?: string;
  medicalDisclaimer?: string;
  emergency_instructions?: string;
  emergencyInstructions?: string;
  culturalAdaptation?: boolean;
}

interface TriageResponseDisplayProps {
  response?: TriageResponse;
  isLoading?: boolean;
  showThinking?: boolean;
  onToggleThinking?: () => void;
  onFollowUpQuestion?: (question: string) => void;
  onEmergencyAction?: () => void;
}

interface ThinkingStep {
  phase: string;
  description: string;
  status: 'thinking' | 'complete' | 'pending';
  details?: string[];
  icon: any;
}

export function TriageResponseDisplay({
  response,
  isLoading = false,
  showThinking = false,
  onToggleThinking,
  onFollowUpQuestion,
  onEmergencyAction,
}: TriageResponseDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);

  // Simulate thinking process during loading
  useEffect(() => {
    if (isLoading) {
      const steps: ThinkingStep[] = [
        {
          phase: 'analysis',
          description: 'Analyzing your symptoms and medical context',
          status: 'thinking',
          icon: Brain,
          details: [
            'Extracting key symptoms',
            'Checking medical history',
            'Identifying red flags',
          ],
        },
        {
          phase: 'reasoning',
          description: 'Applying medical decision protocols',
          status: 'pending',
          icon: Lightbulb,
          details: [
            'Emergency assessment',
            'Differential diagnosis',
            'Risk stratification',
          ],
        },
        {
          phase: 'tools',
          description: 'Considering helpful tools and resources',
          status: 'pending',
          icon: Search,
          details: [
            'Provider search options',
            'Educational resources',
            'Next steps guidance',
          ],
        },
        {
          phase: 'response',
          description: 'Crafting personalized guidance',
          status: 'pending',
          icon: Target,
          details: [
            'Tailoring communication style',
            'Organizing recommendations',
            'Safety considerations',
          ],
        },
      ];

      setThinkingSteps(steps);

      // Simulate progression through thinking steps
      let currentStep = 0;
      const interval = setInterval(() => {
        setThinkingSteps((prev) =>
          prev.map((step, index) => {
            if (index < currentStep) return { ...step, status: 'complete' };
            if (index === currentStep) return { ...step, status: 'thinking' };
            return step;
          })
        );

        currentStep++;
        if (currentStep >= steps.length) {
          clearInterval(interval);
        }
      }, 1500);

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // Update thinking steps when response is received
  useEffect(() => {
    if (response && !isLoading) {
      setThinkingSteps((prev) =>
        prev.map((step) => ({ ...step, status: 'complete' }))
      );
    }
  }, [response, isLoading]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'thinking':
        return <Clock className="h-4 w-4 animate-spin text-blue-500" />;
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return (
          <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
        );
    }
  };

  const getCareLevel = () => response?.care_level || response?.careLevel;
  const getFollowUpQuestions = () =>
    response?.follow_up_questions || response?.followUpQuestions || [];
  const getNeedsMoreInfo = () =>
    response?.needs_more_info || response?.needsMoreInfo;
  const getEmergencyInstructions = () =>
    response?.emergency_instructions || response?.emergencyInstructions;
  const getMedicalDisclaimer = () =>
    response?.medical_disclaimer || response?.medicalDisclaimer;

  if (!showThinking && !response) return null;

  return (
    <div className="space-y-4">
      {/* Emergency Alert */}
      {getCareLevel() === 'emergency' && (
        <Card className="border-red-300 bg-red-50">
          <div className="p-4">
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-bold text-red-800">
                MEDICAL EMERGENCY
              </h3>
            </div>

            {getEmergencyInstructions() && (
              <p className="text-red-700 mb-4 font-medium">
                {getEmergencyInstructions()}
              </p>
            )}

            <div className="flex space-x-3">
              <Button
                onClick={onEmergencyAction}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Call 911 Now
              </Button>
              <Button
                asChild
                className="bg-red-500 hover:bg-red-600 text-white font-bold"
              >
                <a href="tel:911">
                  <Phone className="w-4 h-4 mr-2" />
                  911
                </a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Follow-up Questions */}
      {getNeedsMoreInfo() && getFollowUpQuestions().length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <div className="p-4">
            <h4 className="font-semibold text-blue-800 mb-3">
              To provide better guidance, I'd like to know:
            </h4>
            <div className="space-y-2">
              {getFollowUpQuestions().map((question: string, index: number) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => onFollowUpQuestion?.(question)}
                  className="block w-full text-left justify-start bg-white border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                >
                  <span className="text-blue-600 font-medium">
                    {question}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Citations */}
      {response?.citations && response.citations.length > 0 && (
        <Card className="border-gray-200">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <ExternalLink className="w-4 h-4 text-gray-600" />
              <h4 className="font-semibold text-gray-800">
                Medical References
              </h4>
            </div>
            <div className="space-y-3">
              {response.citations.map((citation: Citation, index: number) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-3 bg-white"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h6 className="font-medium text-gray-800 mb-1">
                        {citation.title}
                      </h6>
                      <p className="text-sm text-gray-600 mb-2">
                        {citation.excerpt}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Source: {citation.source}</span>
                        <Badge
                          variant={
                            citation.credibility === 'high'
                              ? 'default'
                              : citation.credibility === 'medium'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {citation.credibility} credibility
                        </Badge>
                        {citation.relevance && (
                          <Badge variant="outline">
                            {citation.relevance} relevance
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="ml-3">
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open source"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* AI Reasoning Card */}
      <Card className="p-4 bg-slate-50 border-slate-200">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">
                AI Reasoning
              </span>
              {isLoading && (
                <Badge variant="outline" className="text-xs">
                  Thinking...
                </Badge>
              )}
            </div>
            {onToggleThinking && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleThinking}
                className="text-xs"
              >
                {showThinking ? 'Hide' : 'Show'} Details
              </Button>
            )}
          </div>

          {showThinking && (
            <>
              {/* Thinking Steps */}
              {(isLoading ||
                thinkingSteps.some((s) => s.status !== 'pending')) && (
                <div className="space-y-2">
                  {thinkingSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isExpanded = expandedSections.has(step.phase);

                    return (
                      <div key={step.phase} className="space-y-2">
                        <div
                          className="flex items-center gap-2 p-2 rounded hover:bg-white/50 cursor-pointer"
                          onClick={() =>
                            step.status === 'complete' &&
                            toggleSection(step.phase)
                          }
                        >
                          {getStatusIcon(step.status)}
                          <Icon className="h-4 w-4 text-slate-600" />
                          <span className="text-sm text-slate-700 flex-1">
                            {step.description}
                          </span>
                          {step.status === 'complete' &&
                            step.details &&
                            (isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-500" />
                            ))}
                        </div>

                        {isExpanded && step.details && (
                          <div className="ml-10 space-y-1">
                            {step.details.map((detail, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2"
                              >
                                <div className="h-1 w-1 rounded-full bg-slate-400" />
                                <span className="text-xs text-slate-600">
                                  {detail}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Response Analysis */}
              {response && response.reasoning && (
                <div className="border-t pt-3 space-y-2">
                  <div className="text-xs font-medium text-slate-700">
                    Analysis Summary
                  </div>

                  {response.reasoning.symptomsAnalyzed && (
                    <div className="text-xs text-slate-600">
                      <strong>Symptoms considered:</strong>{' '}
                      {response.reasoning.symptomsAnalyzed.join(', ')}
                    </div>
                  )}

                  {response.reasoning.redFlags?.length > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-red-50 rounded">
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                      <div className="text-xs">
                        <strong className="text-red-700">
                          Red flags identified:
                        </strong>
                        <div className="text-red-600 mt-1">
                          {response.reasoning.redFlags.join(', ')}
                        </div>
                      </div>
                    </div>
                  )}

                  {response.reasoning.modelsUsed && (
                    <div className="text-xs text-slate-500">
                      <strong>AI Models:</strong>{' '}
                      {response.reasoning.modelsUsed.extraction} →{' '}
                      {response.reasoning.modelsUsed.response}
                    </div>
                  )}
                </div>
              )}

              {/* Cultural Adaptation Notice */}
              {response?.culturalAdaptation && (
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 text-xs text-blue-600">
                    <Globe className="h-4 w-4" />
                    <span>
                      Response adapted for your communication preferences
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Medical Disclaimer */}
          {getMedicalDisclaimer() && (
            <div className="border-t pt-3">
              <div className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                <Info className="h-4 w-4 text-gray-500 mt-0.5" />
                <div className="text-xs text-gray-600 italic">
                  <strong>Medical Disclaimer:</strong> {getMedicalDisclaimer()}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
