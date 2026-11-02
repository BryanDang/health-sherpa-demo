/**
 * Triage Optimized Edge Function
 *
 * Enhanced triage system with cultural detection, personality adaptation,
 * and comprehensive JSON response structure. Runs alongside existing
 * triage function for A/B testing and gradual rollout.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.24.1';

// Enhanced Gemini configuration for cultural detection
const ENHANCED_GEMINI_CONFIG = {
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.2, // Lower for medical precision
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        user_message: {
          type: 'string',
          description:
            'Culturally-adapted response to user (300 words routine, 500 words explanatory)',
        },
        internal_thoughts: {
          type: 'object',
          properties: {
            cultural_detection: {
              type: 'object',
              properties: {
                detected_cultures: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      culture: { type: 'string' },
                      confidence: { type: 'number' },
                      evidence: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
                communication_style: {
                  type: 'object',
                  properties: {
                    directness: { type: 'number' },
                    formality: { type: 'number' },
                    emotional_expression: { type: 'number' },
                  },
                },
                adaptations_applied: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            medical_assessment: {
              type: 'object',
              properties: {
                emergency_level: {
                  type: 'string',
                  enum: ['emergency', 'urgent', 'routine'],
                },
                assessment: { type: 'string' },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' },
                },
                cultural_considerations: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
            tool_usage: {
              type: 'object',
              properties: {
                tools_used: {
                  type: 'array',
                  items: { type: 'string' },
                },
                provider_results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      cost: { type: 'number' },
                      cultural_competency: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      required: ['user_message', 'internal_thoughts'],
    },
  },
};

const ENHANCED_SYSTEM_PROMPT = `You are Health Sherpa, an AI-powered healthcare navigation assistant with advanced cultural competency and personality adaptation capabilities.

## Core Mission
Help uninsured patients (26-40 years old) navigate healthcare decisions with cultural sensitivity, personality awareness, and practical affordability guidance.

## Cultural Detection & Adaptation
1. **Analyze Communication Patterns**: Detect cultural markers in language use, decision-making preferences, family involvement, and health beliefs
2. **Personality Assessment**: Identify anxiety levels, information preferences, communication style, and support needs
3. **Adaptive Communication**: Adjust formality, directness, explanation depth, and reassurance based on cultural and personality context
4. **Bias Prevention**: Monitor for cultural stereotyping, validate assumptions, request user feedback on cultural adaptations

## Enhanced Response Structure
Provide responses in JSON format with:
- **user_message**: Culturally-adapted response (300 words routine, 500 words explanatory with markdown)
- **internal_thoughts**: Detailed analysis including cultural detection, medical assessment, and tool usage

## Tool Integration
Use available MCP tools for:
- Provider search with cultural competency filtering
- Pricing analysis with affordability assessment
- Geographic recommendations based on user location

## Medical Safety Protocols
1. **Emergency Detection**: Always prioritize emergency care over cultural preferences
2. **Cultural-Medical Conflicts**: Address conflicts sensitively while maintaining medical safety
3. **Progressive Disclosure**: Reveal medical complexity gradually based on user readiness

## Privacy & Ethics
1. **Cultural Data Protection**: Obtain consent for cultural profiling, respect privacy preferences
2. **Bias Monitoring**: Continuously check for stereotypical assumptions
3. **Inclusive Care**: Ensure equal quality care regardless of cultural background

Respond to each user query with comprehensive cultural awareness, personality adaptation, and practical healthcare guidance.`;

interface TriageRequest {
  message: string;
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  user_profile?: {
    cultural_markers?: string[];
    personality_traits?: string[];
    communication_preferences?: Record<string, any>;
  };
  feature_flags?: {
    enable_cultural_detection?: boolean;
    enable_tool_integration?: boolean;
    enable_enhanced_reasoning?: boolean;
  };
}

interface TriageResponse {
  user_message: string;
  internal_thoughts: {
    cultural_detection?: {
      detected_cultures: Array<{
        culture: string;
        confidence: number;
        evidence: string[];
      }>;
      communication_style: {
        directness: number;
        formality: number;
        emotional_expression: number;
      };
      adaptations_applied: string[];
    };
    medical_assessment: {
      emergency_level: 'emergency' | 'urgent' | 'routine';
      assessment: string;
      recommendations: string[];
      cultural_considerations: string[];
    };
    tool_usage?: {
      tools_used: string[];
      provider_results?: Array<{
        name: string;
        cost: number;
        cultural_competency: string;
      }>;
    };
  };
  metadata: {
    model_used: string;
    processing_time: number;
    cultural_adaptations_enabled: boolean;
    version: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    // Parse request
    const {
      message,
      conversation_history = [],
      user_profile = {},
      feature_flags = {},
    }: TriageRequest = await req.json();

    // Initialize Google AI
    const genAI = new GoogleGenerativeAI(
      Deno.env.get('GOOGLE_GENAI_API_KEY') || ''
    );
    const model = genAI.getGenerativeModel(ENHANCED_GEMINI_CONFIG);

    // Build conversation context with cultural awareness
    const contextualPrompt = buildContextualPrompt({
      message,
      conversation_history,
      user_profile,
      feature_flags,
    });

    // Generate enhanced response
    const result = await model.generateContent(contextualPrompt);
    const responseText = result.response.text();

    // Parse JSON response
    let parsedResponse: TriageResponse;
    try {
      const jsonResponse = JSON.parse(responseText);
      parsedResponse = {
        ...jsonResponse,
        metadata: {
          model_used: ENHANCED_GEMINI_CONFIG.model,
          processing_time: Date.now() - startTime,
          cultural_adaptations_enabled:
            feature_flags.enable_cultural_detection !== false,
          version: '2.0.0-enhanced',
        },
      };
    } catch (parseError) {
      // Fallback to structured response if JSON parsing fails
      console.error('JSON parsing failed, using fallback:', parseError);
      parsedResponse = createFallbackResponse(responseText, startTime);
    }

    // Log cultural adaptation metrics
    await logCulturalAdaptationMetrics(parsedResponse, user_profile);

    return new Response(JSON.stringify(parsedResponse), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Enhanced triage error:', error);

    // Fallback to basic response on error
    const fallbackResponse = {
      user_message:
        "I'm experiencing some technical difficulties with the enhanced features. Let me provide you with basic triage assistance.",
      internal_thoughts: {
        medical_assessment: {
          emergency_level: 'routine' as const,
          assessment:
            'Unable to process enhanced assessment due to technical error',
          recommendations: [
            'Please try again',
            'Contact healthcare provider if urgent',
          ],
          cultural_considerations: [],
        },
      },
      metadata: {
        model_used: 'fallback',
        processing_time: 0,
        cultural_adaptations_enabled: false,
        version: '2.0.0-enhanced',
        error: error.message,
      },
    };

    return new Response(JSON.stringify(fallbackResponse), {
      status: 200, // Return 200 to avoid breaking the frontend
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});

function buildContextualPrompt({
  message,
  conversation_history,
  user_profile,
  feature_flags,
}: {
  message: string;
  conversation_history: any[];
  user_profile: any;
  feature_flags: any;
}) {
  let prompt = ENHANCED_SYSTEM_PROMPT + '\n\n';

  // Add conversation history for context
  if (conversation_history.length > 0) {
    prompt += 'Previous conversation:\n';
    conversation_history.slice(-5).forEach((msg) => {
      prompt += `${msg.role}: ${msg.content}\n`;
    });
    prompt += '\n';
  }

  // Add user profile context if available
  if (
    user_profile.cultural_markers?.length > 0 ||
    user_profile.personality_traits?.length > 0
  ) {
    prompt += 'User profile context:\n';
    if (user_profile.cultural_markers?.length > 0) {
      prompt += `Cultural markers: ${user_profile.cultural_markers.join(', ')}\n`;
    }
    if (user_profile.personality_traits?.length > 0) {
      prompt += `Personality traits: ${user_profile.personality_traits.join(', ')}\n`;
    }
    prompt += '\n';
  }

  // Add feature flag context
  if (feature_flags.enable_cultural_detection === false) {
    prompt += 'Note: Cultural detection is disabled for this request.\n\n';
  }

  prompt += `User message: ${message}`;

  return prompt;
}

function createFallbackResponse(
  responseText: string,
  startTime: number
): TriageResponse {
  return {
    user_message:
      responseText ||
      "I'm here to help with your healthcare questions. Could you please provide more details about your symptoms or concerns?",
    internal_thoughts: {
      medical_assessment: {
        emergency_level: 'routine',
        assessment: 'Fallback response due to JSON parsing failure',
        recommendations: [
          'Please provide more specific information about your symptoms',
        ],
        cultural_considerations: [],
      },
    },
    metadata: {
      model_used: 'fallback',
      processing_time: Date.now() - startTime,
      cultural_adaptations_enabled: false,
      version: '2.0.0-enhanced',
    },
  };
}

async function logCulturalAdaptationMetrics(
  response: TriageResponse,
  user_profile: any
) {
  try {
    // Log metrics for cultural adaptation effectiveness
    const metrics = {
      timestamp: new Date().toISOString(),
      cultural_detection_used: !!response.internal_thoughts.cultural_detection,
      adaptations_count:
        response.internal_thoughts.cultural_detection?.adaptations_applied
          ?.length || 0,
      user_profile_available: !!(
        user_profile.cultural_markers?.length ||
        user_profile.personality_traits?.length
      ),
      processing_time: response.metadata.processing_time,
    };

    console.log('Cultural adaptation metrics:', metrics);

    // In production, this would send to analytics service
    // await analyticsService.track('cultural_adaptation', metrics);
  } catch (error) {
    console.error('Error logging cultural adaptation metrics:', error);
  }
}
