/**
 * Stateful Medical Triage API with Semantic Emergency Detection
 * Implements memory + reasoning + message architecture
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  ExchangeObject,
  MedicalMemory,
} from '@/lib/stateful-llm-interface';
import { getBackend } from '@/lib/backend';
import { overLimit } from '@/lib/backend/rate-limit';

const MAX_MESSAGE_CHARS = 4000;
const MAX_EXCHANGES = 20;

interface TriageRequest {
  message: string;
  recentExchanges?: ExchangeObject[];
  currentMemory?: MedicalMemory | string | null;
  sessionId?: string;
}

interface TriageResponse {
  updated_reasoning: {
    plan: string;
    steps: string[];
    observations: string[];
    confidence: number;
    unanswered_questions?: string[];
  };
  assistant_message: string;
  updated_memory: MedicalMemory;
  emergency_detected: boolean;
  care_level: 'emergency' | 'urgent' | 'primary' | 'self_care' | null;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    if (overLimit(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const {
      message,
      recentExchanges = [],
      currentMemory = null,
      sessionId,
    }: TriageRequest = await request.json();

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: 'Message is too long' },
        { status: 413 }
      );
    }

    // Process the message through the stateful LLM
    const response = await getBackend().triage.processMessage(
      message,
      Array.isArray(recentExchanges) ? recentExchanges.slice(-MAX_EXCHANGES) : [],
      currentMemory
    );

    // Analyze the response for emergency conditions
    const emergencyDetected = response.updated_memory.emergencyFlags.length > 0;
    
    // Check if AI is still gathering information or hasn't made a determination
    const stillAssessing = response.updated_reasoning.plan.toLowerCase().includes('gather') ||
                          response.updated_reasoning.plan.toLowerCase().includes('ask') ||
                          response.updated_reasoning.plan.toLowerCase().includes('more information') ||
                          response.updated_reasoning.plan.toLowerCase().includes('assessment') ||
                          response.assistant_message.toLowerCase().includes('tell me') ||
                          response.assistant_message.toLowerCase().includes('could you') ||
                          response.assistant_message.toLowerCase().includes('what feels right') ||
                          (response.assistant_message.includes('?') && !response.updated_reasoning.plan.toLowerCase().includes('recommend'));
    
    // Check if AI has explicitly recommended a care level
    const hasRecommendation = response.updated_reasoning.plan.toLowerCase().includes('urgent care') ||
                             response.updated_reasoning.plan.toLowerCase().includes('emergency') ||
                             response.updated_reasoning.plan.toLowerCase().includes('primary care') ||
                             response.updated_reasoning.plan.toLowerCase().includes('self-care') ||
                             response.assistant_message.toLowerCase().includes('recommend urgent care') ||
                             response.assistant_message.toLowerCase().includes('recommend emergency') ||
                             response.assistant_message.toLowerCase().includes('you should go to');
    
    const careLevel = (stillAssessing || !hasRecommendation) ? null : determineCareLevel(
      response.updated_memory.emergencyFlags,
      response.updated_reasoning.observations
    );

    // Format the response for the frontend
    const triageResponse: TriageResponse = {
      updated_reasoning: response.updated_reasoning,
      assistant_message: response.assistant_message,
      updated_memory: response.updated_memory,
      emergency_detected: emergencyDetected,
      care_level: careLevel,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(triageResponse);
  } catch (error) {
    console.error('Stateful triage API error:', error);

    // Return safe fallback response
    return NextResponse.json(
      {
        updated_reasoning: {
          plan: 'System error - providing safety guidance',
          steps: ['Error detected', 'Providing emergency guidance'],
          observations: ['System processing error'],
          confidence: 0.1,
        },
        assistant_message:
          'I apologize, but I encountered an error while processing your medical query. For your safety, please consult with a healthcare professional directly. If you are experiencing emergency symptoms, please call 911.',
        updated_memory: {
          symptoms: [],
          medicalHistory: [],
          medications: [],
          allergies: [],
          emergencyFlags: ['SYSTEM_ERROR'],
          lastUpdate: new Date().toISOString(),
        },
        emergency_detected: true,
        care_level: 'emergency' as const,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Determine care level based on emergency flags and observations
 */
function determineCareLevel(
  emergencyFlags: string[],
  observations: string[]
): 'emergency' | 'urgent' | 'primary' | 'self_care' {
  // Check emergency flags first
  const emergencyKeywords = [
    'respiratory',
    'breathing',
    'cardiac',
    'chest pain',
    'heart attack',
    'stroke',
    'seizure',
    'unconscious',
    'bleeding',
    'trauma',
    'anaphylaxis',
    'allergic reaction',
    'infant fever',
  ];

  const urgentKeywords = [
    'severe pain',
    'high fever',
    'infection',
    'urgent care',
    'moderate bleeding',
    'injury',
    'fracture',
  ];

  // Emergency if any emergency flags exist
  if (emergencyFlags.length > 0) {
    const flagText = emergencyFlags.join(' ').toLowerCase();
    if (emergencyKeywords.some((keyword) => flagText.includes(keyword))) {
      return 'emergency';
    }
  }

  // Check observations for severity indicators
  const observationText = observations.join(' ').toLowerCase();

  if (emergencyKeywords.some((keyword) => observationText.includes(keyword))) {
    return 'emergency';
  }

  if (urgentKeywords.some((keyword) => observationText.includes(keyword))) {
    return 'urgent';
  }

  if (
    observationText.includes('primary care') ||
    observationText.includes('doctor')
  ) {
    return 'primary';
  }

  return 'self_care';
}
