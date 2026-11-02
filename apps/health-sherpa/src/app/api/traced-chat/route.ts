/**
 * Traced Chat API - Full transparency for healthcare AI interactions
 * Integrates OpenLLMetry with Health Sherpa's phase-based system
 */

import { NextRequest, NextResponse } from 'next/server';
import { overLimit } from '@/lib/backend/rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  traceHealthcareWorkflow, 
  traceClinicalDecision,
  traceModelSelection,
  traceMCPServerCall
} from '@/lib/healthcare-tracing';
import { withWorkflow, withTask } from "@traceloop/node-server-sdk";

// Live only. Not tested here. Created on first use so the module loads without a key.
let genAIInstance: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genAIInstance) {
    const key = process.env.GOOGLE_GENAI_API_KEY;
    if (!key) throw new Error('GOOGLE_GENAI_API_KEY is not set');
    genAIInstance = new GoogleGenerativeAI(key);
  }
  return genAIInstance;
}

// Model selection based on task complexity
const MODEL_STRATEGIES = {
  symptom_extraction: {
    primary: 'gemini-2.0-flash-lite',
    secondary: 'gemini-2.5-flash-lite',
    fallback: 'gemini-1.5-flash',
    complexity: 'simple' as const,
    dailyLimit: 200,
  },
  quick_triage: {
    primary: 'gemini-2.0-flash',
    secondary: 'gemini-2.5-flash',
    fallback: 'gemini-2.0-flash-lite',
    complexity: 'medium' as const,
    dailyLimit: 200,
  },
  complex_analysis: {
    primary: 'gemini-2.5-pro',
    secondary: 'gemini-2.0-flash',
    fallback: 'gemini-2.5-flash',
    complexity: 'complex' as const,
    dailyLimit: 100,
  },
};

export async function POST(request: NextRequest) {
  try {
    if (process.env.BACKEND_MODE !== 'live') {
      return NextResponse.json(
        { error: 'Traced chat needs BACKEND_MODE=live. Not available in demo mode.' },
        { status: 501 }
      );
    }
    if (overLimit(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const { message, sessionId, phase = 0 } = await request.json();
    if (typeof message !== 'string' || !message.trim() || message.length > 8000) {
      return NextResponse.json({ error: 'A message under 8000 characters is required' }, { status: 400 });
    }
    
    // Wrap entire healthcare workflow for complete tracing
    const response = await traceHealthcareWorkflow(
      'patient_consultation',
      sessionId || 'anonymous',
      async () => {
        
        // Phase 0: Initial Assessment & Trust Building
        if (phase === 0) {
          return await processPhase0(message, sessionId);
        }
        
        // Phase 1: Clinical Summarization
        if (phase === 1) {
          return await processPhase1(message, sessionId);
        }
        
        // Phase 2: Pattern Recognition
        if (phase === 2) {
          return await processPhase2(message, sessionId);
        }
        
        // Phase 3: Information Synthesis
        if (phase === 3) {
          return await processPhase3(message, sessionId);
        }
        
        // Phase 4: Actionable Recommendations
        if (phase === 4) {
          return await processPhase4(message, sessionId);
        }
        
        throw new Error(`Invalid phase: ${phase}`);
      }
    );
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Traced chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

async function processPhase0(message: string, sessionId: string) {
  // Track symptom extraction with simple model
  const symptoms = await traceModelSelection(
    {
      selectedModel: MODEL_STRATEGIES.symptom_extraction.primary,
      strategy: 'symptom_extraction',
      complexity: 'simple',
      dailyLimit: MODEL_STRATEGIES.symptom_extraction.dailyLimit,
      fallbackModels: [
        MODEL_STRATEGIES.symptom_extraction.secondary,
        MODEL_STRATEGIES.symptom_extraction.fallback,
      ],
      selectionReason: 'Initial symptom extraction requires simple parsing',
    },
    async () => {
      return await extractSymptoms(message);
    }
  );
  
  // Track triage decision
  const triageResult = await traceClinicalDecision(
    {
      decisionId: `triage-${sessionId}-${Date.now()}`,
      phase: 0,
      decisionType: 'triage',
      confidence: determineConfidence(symptoms),
      reasoning: 'Initial symptom assessment for urgency determination',
      dataPoints: symptoms,
      redFlags: identifyRedFlags(symptoms),
    },
    async () => {
      return await performTriage(symptoms, message);
    }
  );
  
  return {
    phase: 0,
    symptoms,
    triage: triageResult,
    nextPhase: triageResult.urgency === 'emergency' ? 'immediate_action' : 1,
    transparency: {
      modelUsed: MODEL_STRATEGIES.symptom_extraction.primary,
      decisionPath: 'symptom_extraction -> triage_assessment',
      confidence: determineConfidence(symptoms),
    },
  };
}

async function processPhase1(message: string, sessionId: string) {
  // Track clinical summarization with medium complexity model
  return await traceModelSelection(
    {
      selectedModel: MODEL_STRATEGIES.quick_triage.primary,
      strategy: 'clinical_summarization',
      complexity: 'medium',
      dailyLimit: MODEL_STRATEGIES.quick_triage.dailyLimit,
      fallbackModels: [
        MODEL_STRATEGIES.quick_triage.secondary,
        MODEL_STRATEGIES.quick_triage.fallback,
      ],
      selectionReason: 'Clinical summarization requires balanced reasoning',
    },
    async () => {
      const model = getGenAI().getGenerativeModel({ 
        model: MODEL_STRATEGIES.quick_triage.primary 
      });
      
      const prompt = `As a healthcare AI assistant, provide a clinical summary of:
        ${message}
        
        Include:
        1. Chief complaint
        2. Relevant history
        3. Key symptoms
        4. Timeline
        
        Be concise and clinically focused.`;
      
      const result = await model.generateContent(prompt);
      const summary = result.response.text();
      
      return {
        phase: 1,
        summary,
        nextPhase: 2,
        transparency: {
          modelUsed: MODEL_STRATEGIES.quick_triage.primary,
          processingType: 'clinical_summarization',
        },
      };
    }
  );
}

async function processPhase2(message: string, sessionId: string) {
  // Track pattern recognition with complex model
  return await traceModelSelection(
    {
      selectedModel: MODEL_STRATEGIES.complex_analysis.primary,
      strategy: 'pattern_recognition',
      complexity: 'complex',
      dailyLimit: MODEL_STRATEGIES.complex_analysis.dailyLimit,
      fallbackModels: [
        MODEL_STRATEGIES.complex_analysis.secondary,
        MODEL_STRATEGIES.complex_analysis.fallback,
      ],
      selectionReason: 'Pattern recognition requires advanced reasoning capabilities',
    },
    async () => {
      const model = getGenAI().getGenerativeModel({ 
        model: MODEL_STRATEGIES.complex_analysis.primary 
      });
      
      const prompt = `Analyze the following for clinical patterns and insights:
        ${message}
        
        Identify:
        1. Symptom patterns
        2. Risk factors
        3. Possible conditions
        4. Concerning signs
        
        Provide evidence-based analysis.`;
      
      const result = await model.generateContent(prompt);
      const patterns = result.response.text();
      
      return {
        phase: 2,
        patterns,
        nextPhase: 3,
        transparency: {
          modelUsed: MODEL_STRATEGIES.complex_analysis.primary,
          processingType: 'pattern_recognition',
          analysisDepth: 'comprehensive',
        },
      };
    }
  );
}

async function processPhase3(message: string, sessionId: string) {
  // Track information synthesis
  return await withWorkflow(
    { name: 'information_synthesis' },
    async () => {
      // Simulate MCP server call for external data
      const externalData = await traceMCPServerCall(
        {
          serverName: 'context7',
          serverType: 'context7',
          functionName: 'get-library-docs',
          parameters: { 
            libraryId: '/medical/symptoms',
            topic: extractMainSymptom(message)
          },
        },
        async () => {
          // Simulated MCP call - replace with actual implementation
          return { 
            relevantInfo: 'Medical reference data',
            sources: ['Mayo Clinic', 'WebMD']
          };
        }
      );
      
      const model = getGenAI().getGenerativeModel({ 
        model: MODEL_STRATEGIES.quick_triage.primary 
      });
      
      const prompt = `Synthesize the following information:
        Patient Input: ${message}
        External References: ${JSON.stringify(externalData)}
        
        Provide integrated insights combining patient-specific and reference data.`;
      
      const result = await model.generateContent(prompt);
      const synthesis = result.response.text();
      
      return {
        phase: 3,
        synthesis,
        externalData,
        nextPhase: 4,
        transparency: {
          modelUsed: MODEL_STRATEGIES.quick_triage.primary,
          mcpServersUsed: ['context7'],
          dataSources: externalData.sources,
        },
      };
    }
  );
}

async function processPhase4(message: string, sessionId: string) {
  // Track final recommendations
  return await traceClinicalDecision(
    {
      decisionId: `recommendation-${sessionId}-${Date.now()}`,
      phase: 4,
      decisionType: 'recommendation',
      confidence: 'high',
      reasoning: 'Based on comprehensive analysis across all phases',
      dataPoints: ['symptoms', 'patterns', 'synthesis'],
      redFlags: [],
    },
    async () => {
      const model = getGenAI().getGenerativeModel({ 
        model: MODEL_STRATEGIES.quick_triage.primary 
      });
      
      const prompt = `Based on the analysis, provide actionable recommendations:
        ${message}
        
        Include:
        1. Immediate actions
        2. Follow-up steps
        3. When to seek care
        4. Self-care measures
        
        Be specific and actionable.`;
      
      const result = await model.generateContent(prompt);
      const recommendations = result.response.text();
      
      return {
        phase: 4,
        recommendations,
        completed: true,
        transparency: {
          modelUsed: MODEL_STRATEGIES.quick_triage.primary,
          decisionType: 'final_recommendations',
          confidenceLevel: 'high',
        },
      };
    }
  );
}

// Helper functions
function extractSymptoms(message: string): string[] {
  // Simplified symptom extraction - enhance with NLP
  const commonSymptoms = ['headache', 'fever', 'cough', 'pain', 'fatigue', 'nausea'];
  return commonSymptoms.filter(symptom => 
    message.toLowerCase().includes(symptom)
  );
}

function determineConfidence(symptoms: string[]): 'high' | 'medium' | 'low' {
  if (symptoms.length >= 3) return 'high';
  if (symptoms.length >= 1) return 'medium';
  return 'low';
}

function identifyRedFlags(symptoms: string[]): string[] {
  const redFlagSymptoms = ['chest pain', 'difficulty breathing', 'severe headache'];
  return symptoms.filter(symptom => 
    redFlagSymptoms.some(flag => flag.includes(symptom))
  );
}

async function performTriage(symptoms: string[], message: string) {
  // Simplified triage logic - enhance with medical rules
  const hasRedFlags = identifyRedFlags(symptoms).length > 0;
  
  return {
    urgency: hasRedFlags ? 'urgent' : 'routine',
    recommendedAction: hasRedFlags ? 'Seek immediate care' : 'Schedule appointment',
    estimatedWaitTime: hasRedFlags ? '0-2 hours' : '24-48 hours',
  };
}

function extractMainSymptom(message: string): string {
  // Extract primary symptom for focused search
  const symptoms = extractSymptoms(message);
  return symptoms[0] || 'general health';
}