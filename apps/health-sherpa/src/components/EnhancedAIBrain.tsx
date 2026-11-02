'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Search,
  Zap,
  Globe,
  Shield,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Lightbulb,
  Target,
  Database,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDocumentState, useChatState, usePhaseState } from '@/store/hooks';

interface AIModel {
  id: string;
  name: string;
  provider: 'google' | 'openai';
  capabilities: string[];
  healthcareOptimized: boolean;
  costPerToken: number;
  contextWindow: number;
  reliability: number; // 0-100
}

interface GroundingSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
  reliability: 'high' | 'medium' | 'low';
  source: 'pubmed' | 'mayo' | 'uptodate' | 'fda' | 'cdc' | 'local_doc';
  lastVerified: string;
}

interface Citation {
  id: string;
  text: string;
  source: GroundingSource;
  confidence: number;
  pageNumbers?: number[];
  excerpt: string;
}

interface AIBrainState {
  selectedModel: AIModel;
  groundingSources: GroundingSource[];
  citations: Citation[];
  isThinking: boolean;
  currentTask: string;
  confidence: number;
  limitations: string[];
  searchQueries: string[];
}

const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    capabilities: ['healthcare', 'fast_response', 'document_analysis'],
    healthcareOptimized: true,
    costPerToken: 0.000075,
    contextWindow: 1000000,
    reliability: 95,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    capabilities: ['healthcare', 'complex_reasoning', 'medical_literature'],
    healthcareOptimized: true,
    costPerToken: 0.00125,
    contextWindow: 2000000,
    reliability: 98,
  },
];

const TRUSTED_HEALTH_SOURCES = [
  { domain: 'pubmed.ncbi.nlm.nih.gov', name: 'PubMed', reliability: 'high' },
  { domain: 'mayoclinic.org', name: 'Mayo Clinic', reliability: 'high' },
  { domain: 'uptodate.com', name: 'UpToDate', reliability: 'high' },
  { domain: 'fda.gov', name: 'FDA', reliability: 'high' },
  { domain: 'cdc.gov', name: 'CDC', reliability: 'high' },
  { domain: 'nih.gov', name: 'NIH', reliability: 'high' },
  { domain: 'webmd.com', name: 'WebMD', reliability: 'medium' },
  { domain: 'healthline.com', name: 'Healthline', reliability: 'medium' },
];

interface EnhancedAIBrainProps {
  className?: string;
}

export default function EnhancedAIBrain({
  className = '',
}: EnhancedAIBrainProps) {
  const { activeDocument } = useDocumentState();
  const { currentSession } = useChatState();
  const { currentPhase } = usePhaseState();

  const [aiState, setAiState] = useState<AIBrainState>({
    selectedModel: AVAILABLE_MODELS[0], // Default to Gemini Flash
    groundingSources: [],
    citations: [],
    isThinking: false,
    currentTask: '',
    confidence: 0,
    limitations: [
      'AI analysis is not a substitute for professional medical advice',
      'Information may not be complete or current',
      'Individual cases may vary significantly',
    ],
    searchQueries: [],
  });

  const [searchProgress, setSearchProgress] = useState(0);

  // Automatic model selection based on context
  useEffect(() => {
    const selectOptimalModel = () => {
      let optimalModel = AVAILABLE_MODELS[0]; // Default

      // Consider document complexity
      const hasDocument = activeDocument && activeDocument.content.length > 0;
      const isComplexDocument =
        hasDocument && activeDocument.content.length > 50000;

      // Consider conversation length
      const messageCount = currentSession?.messages?.length || 0;
      const isLongConversation = messageCount > 20;

      // Consider phase requirements
      const isAdvancedPhase = currentPhase >= 3;

      // Model selection logic
      if (isComplexDocument || isLongConversation || isAdvancedPhase) {
        // Use Pro model for complex scenarios
        optimalModel =
          AVAILABLE_MODELS.find((m) => m.id === 'gemini-1.5-pro') ||
          AVAILABLE_MODELS[0];
      }
      // Otherwise use Flash model for speed

      setAiState((prev) => ({ ...prev, selectedModel: optimalModel }));
    };

    selectOptimalModel();
  }, [activeDocument, currentSession, currentPhase]);

  const simulateGroundingSearch = async (query: string) => {
    setAiState((prev) => ({
      ...prev,
      isThinking: true,
      currentTask: `Searching trusted medical sources: "${query}"`,
      searchQueries: [...prev.searchQueries, query],
    }));

    // Simulate search progress
    for (let i = 0; i <= 100; i += 20) {
      setSearchProgress(i);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Mock grounding sources
    const mockSources: GroundingSource[] = [
      {
        id: '1',
        title: 'Clinical Guidelines for Diagnostic Procedures',
        url: 'https://pubmed.ncbi.nlm.nih.gov/example1',
        snippet:
          'Evidence-based approach to clinical diagnosis with emphasis on patient safety and accuracy...',
        reliability: 'high',
        source: 'pubmed',
        lastVerified: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Patient Care Standards and Best Practices',
        url: 'https://mayoclinic.org/example2',
        snippet:
          'Comprehensive patient care guidelines focusing on individualized treatment approaches...',
        reliability: 'high',
        source: 'mayo',
        lastVerified: new Date().toISOString(),
      },
      {
        id: '3',
        title: 'Healthcare Safety Protocols',
        url: 'https://cdc.gov/example3',
        snippet:
          'Safety protocols and risk assessment procedures for healthcare delivery...',
        reliability: 'high',
        source: 'cdc',
        lastVerified: new Date().toISOString(),
      },
    ];

    setAiState((prev) => ({
      ...prev,
      groundingSources: mockSources,
      isThinking: false,
      currentTask: '',
      confidence: 87,
    }));

    setSearchProgress(0);
  };

  const generateCitations = (sources: GroundingSource[]) => {
    const citations: Citation[] = sources.map((source, index) => ({
      id: `cite-${index + 1}`,
      text: `[${index + 1}]`,
      source: source,
      confidence: 85 + Math.random() * 10,
      excerpt: source.snippet.substring(0, 100) + '...',
    }));

    setAiState((prev) => ({ ...prev, citations }));
  };

  const handleTestGrounding = () => {
    const testQuery = activeDocument
      ? 'Clinical analysis of patient health documents'
      : 'General healthcare guidance and best practices';

    simulateGroundingSearch(testQuery).then(() => {
      generateCitations(aiState.groundingSources);
    });
  };

  const getModelStatusColor = (model: AIModel) => {
    if (model.reliability >= 95) return 'text-green-600';
    if (model.reliability >= 90) return 'text-blue-600';
    return 'text-amber-600';
  };

  const getReliabilityBadge = (reliability: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-amber-100 text-amber-800 border-amber-200',
      low: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[reliability as keyof typeof colors] || colors.medium;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* AI Brain Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-base">
            <Brain className="h-5 w-5 mr-2 text-primary" />
            Enhanced AI Brain
            <Badge variant="outline" className="ml-2 text-xs">
              {aiState.selectedModel.name}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Model Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Model:</span>
              <div className="flex items-center space-x-2">
                <span
                  className={`font-medium ${getModelStatusColor(aiState.selectedModel)}`}
                >
                  {aiState.selectedModel.name}
                </span>
                <CheckCircle className="h-3 w-3 text-green-600" />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Healthcare Optimized:
              </span>
              <Badge
                variant={
                  aiState.selectedModel.healthcareOptimized
                    ? 'default'
                    : 'secondary'
                }
                className="text-xs"
              >
                {aiState.selectedModel.healthcareOptimized ? 'Yes' : 'No'}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reliability:</span>
              <span className="font-medium">
                {aiState.selectedModel.reliability}%
              </span>
            </div>
          </div>

          {/* Thinking Indicator */}
          {aiState.isThinking && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Brain className="h-4 w-4 text-blue-600 animate-pulse" />
                <span className="text-sm font-medium text-blue-800">
                  AI Processing
                </span>
              </div>
              <p className="text-xs text-blue-700">{aiState.currentTask}</p>
              {searchProgress > 0 && (
                <Progress value={searchProgress} className="mt-2 h-1.5" />
              )}
            </div>
          )}

          {/* Confidence & Status */}
          {aiState.confidence > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Analysis Confidence:
                </span>
                <span className="font-medium">{aiState.confidence}%</span>
              </div>
              <Progress value={aiState.confidence} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Grounding */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-base">
            <Search className="h-5 w-5 mr-2 text-primary" />
            Medical Knowledge Grounding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">Trusted Medical Sources</p>
              <p className="text-muted-foreground text-xs">
                {TRUSTED_HEALTH_SOURCES.length} verified sources available
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleTestGrounding}
              disabled={aiState.isThinking}
            >
              {aiState.isThinking ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Search className="h-3 w-3 mr-1" />
              )}
              Search
            </Button>
          </div>

          {/* Grounding Sources */}
          {aiState.groundingSources.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Active Sources:
              </p>
              {aiState.groundingSources.slice(0, 3).map((source) => (
                <div
                  key={source.id}
                  className="flex items-start space-x-2 p-2 bg-muted/30 rounded text-xs"
                >
                  <Globe className="h-3 w-3 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{source.title}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge
                        variant="outline"
                        className={`text-xs px-1 py-0 ${getReliabilityBadge(source.reliability)}`}
                      >
                        {source.source.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground">
                        {source.reliability} reliability
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Citations Engine */}
      {aiState.citations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-base">
              <Database className="h-5 w-5 mr-2 text-primary" />
              Citations & Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiState.citations.map((citation) => (
              <div
                key={citation.id}
                className="p-2 border rounded-lg bg-muted/20"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {citation.text}
                    </Badge>
                    <span className="text-xs font-medium">
                      {citation.source.title}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {citation.confidence.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {citation.excerpt}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Limitations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-base">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
            AI Limitations & Disclaimers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {aiState.limitations.map((limitation, index) => (
            <div key={index} className="flex items-start space-x-2 text-xs">
              <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-600" />
              <span className="text-muted-foreground">{limitation}</span>
            </div>
          ))}

          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
            <p className="text-xs text-amber-800 font-medium">
              Always consult qualified healthcare professionals for medical
              decisions
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Activity Indicators */}
      {aiState.searchQueries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-base">
              <Activity className="h-5 w-5 mr-2 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {aiState.searchQueries.slice(-3).map((query, index) => (
                <div
                  key={index}
                  className="text-xs text-muted-foreground flex items-center space-x-2"
                >
                  <Lightbulb className="h-3 w-3" />
                  <span>Searched: &quot;{query}&quot;</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
