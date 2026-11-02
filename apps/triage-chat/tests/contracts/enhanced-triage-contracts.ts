/**
 * Enhanced Triage Feature Contracts
 * Defines inputs, outputs, side effects, failure modes, and dependencies
 */

export interface EnhancedTriageContract {
  inputs: {
    message: string;
    conversationHistory?: Array<{ role: string; content: string }>;
    useStreaming?: boolean;
  };
  outputs: {
    structured: StructuredTriageOutput | StreamingTriageOutput;
    metadata: {
      modelsUsed: {
        extraction: string;
        response: string;
      };
      careLevel: 'emergency' | 'urgent' | 'primary' | 'self-care';
      reasoning: {
        symptomsAnalyzed: string[];
        redFlags: string[];
        careLevelJustification: string;
      };
    };
  };
  sideEffects: [
    'Increments model usage counters',
    'Logs to console on errors',
    'Makes external API calls to Google Gemini',
  ];
  failureModes: [
    'Google API rate limit exceeded',
    'Google API authentication failure',
    'Invalid JSON response from AI',
    'Model selection fallback chain exhausted',
    'Network connectivity issues',
    'Missing required environment variables',
  ];
  dependencies: [
    'Google Generative AI API',
    'Supabase Edge Runtime',
    'Decision tree evaluation module',
    'CORS headers configuration',
  ];
}

export interface StructuredTriageOutput {
  response: string | StructuredResponseSchema;
  careLevel: string;
  reasoning: object;
  structured: boolean;
}

export interface StreamingTriageOutput {
  stream: ReadableStream;
  contentType: 'text/event-stream';
}

export interface StructuredResponseSchema {
  assessment: {
    careLevel: 'emergency' | 'urgent' | 'primary' | 'self-care';
    confidence: 'high' | 'medium' | 'low';
    urgency: string;
    severity: string;
  };
  symptoms: {
    primary: string[];
    secondary: string[];
    redFlags: string[];
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  nextSteps: {
    seekCare: string;
    timeframe: string;
    watchFor: string[];
  };
  disclaimer: string;
}

export interface ModelSelectionContract {
  inputs: {
    taskType:
      | 'symptom_extraction'
      | 'quick_triage'
      | 'complex_analysis'
      | 'final_response';
  };
  outputs: {
    selectedModel: string;
    usageCount: number;
    fallbackLevel: 0 | 1 | 2 | 3; // primary, secondary, fallback, deprecated
  };
  sideEffects: [
    'Updates in-memory usage tracking',
    'Logs model selection decisions',
  ];
  failureModes: [
    'All models exceed daily limits',
    'Invalid task type provided',
  ];
  dependencies: ['Model strategy configuration', 'Usage tracking system'];
}

export interface StreamingContract {
  inputs: {
    prompt: string;
    apiKey: string;
    model: string;
    responseSchema?: object;
  };
  outputs: {
    stream: ReadableStream;
    chunks: Array<{ type: 'content' | 'metadata'; data: any }>;
  };
  sideEffects: [
    'Establishes long-running HTTP connection',
    'Sends server-sent events to client',
  ];
  failureModes: [
    'Stream connection interrupted',
    'Malformed SSE data',
    'Client disconnection during stream',
  ];
  dependencies: [
    'Google Gemini streaming API',
    'Browser EventSource support or fetch streaming',
  ];
}
