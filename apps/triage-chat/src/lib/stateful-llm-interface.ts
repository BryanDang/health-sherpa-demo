/**
 * Stateful LLM Interface with Memory + Reasoning + Message
 * Implements semantic emergency detection and progressive medical context
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { rateLimiter, REQUEST_PATTERNS } from './smart-rate-limiter';

// Schema definitions for structured output
export interface ReasoningObject {
  plan: string;
  steps: string[];
  observations: string[];
  confidence: number;
}

export interface MedicalMemory {
  symptoms: Array<{
    description: string;
    severity: number;
    onset: string;
    timestamp: string;
  }>;
  medicalHistory: string[];
  medications: string[];
  allergies: string[];
  emergencyFlags: string[];
  lastUpdate: string;
}

export interface ExchangeObject {
  userMessage: string;
  assistantReasoning: ReasoningObject;
  assistantMemory: MedicalMemory;
  assistantMessage: string;
  timestamp: string;
}

export interface StatefulLLMResponse {
  updated_reasoning: ReasoningObject;
  assistant_message: string;
  updated_memory: MedicalMemory;
}

export class StatefulMedicalLLM {
  private genAI: GoogleGenerativeAI;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Process a new user message with full context and return structured response
   */
  async processMessage(
    userMessage: string,
    recentExchanges: ExchangeObject[] = [],
    currentMemory: MedicalMemory | string | null = null
  ): Promise<StatefulLLMResponse> {
    // Get best available model with rate limiting
    const selectedModel = await rateLimiter.getAvailableModel('complex');
    const model = this.genAI.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: this.getResponseSchema(),
        temperature: 0.7,
        maxOutputTokens: 4096, // Increased to prevent truncation
      },
    });

    // Build the context-aware prompt
    const prompt = this.buildContextualPrompt(
      userMessage,
      recentExchanges,
      currentMemory
    );

    // Make the API call with rate limiting
    await rateLimiter.recordRequest(
      selectedModel,
      REQUEST_PATTERNS.EMERGENCY_DETECTION.estimatedTokens
    );

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse and validate the JSON response
      const parsedResponse = this.parseAndValidateResponse(responseText);

      return parsedResponse;
    } catch (error) {
      console.error('Stateful LLM processing error:', error);
      
      // Check if it's a 503 overload error and try fallback model
      if (error?.message?.includes('overloaded') || error?.message?.includes('503')) {
        console.log('Model overloaded, trying fallback model...');
        try {
          const fallbackModel = await rateLimiter.getAvailableModel('simple');
          const fallbackGenModel = this.genAI.getGenerativeModel({
            model: fallbackModel,
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: this.getResponseSchema(),
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
          });
          
          const fallbackResult = await fallbackGenModel.generateContent(prompt);
          const fallbackResponseText = fallbackResult.response.text();
          return this.parseAndValidateResponse(fallbackResponseText);
        } catch (fallbackError) {
          console.error('Fallback model also failed:', fallbackError);
        }
      }
      
      // Return safe fallback response
      return this.getSafetyFallbackResponse(userMessage);
    }
  }

  /**
   * Build the contextual prompt with memory and reasoning
   */
  private buildContextualPrompt(
    userMessage: string,
    recentExchanges: ExchangeObject[],
    currentMemory: MedicalMemory | string | null
  ): string {
    const exchangeContext =
      recentExchanges.length > 0
        ? this.formatExchangeContext(recentExchanges)
        : 'No previous exchanges in this session.';

    // Handle both structured medical memory and conversation memory context
    let memoryContext: string;
    if (typeof currentMemory === 'string') {
      // Conversation memory context from enhanced-triage-chat
      memoryContext = currentMemory;
    } else if (currentMemory && typeof currentMemory === 'object') {
      // Structured medical memory object
      memoryContext = JSON.stringify(currentMemory, null, 2);
    } else {
      // No memory available
      memoryContext = this.getInitialMemoryTemplate();
    }

    return `You are an expert medical triage assistant with semantic understanding of health emergencies and natural empathetic communication.

You maintain two structured systems:
1. A "reasoning" object that represents your current plan and internal medical logic
2. A "memory" object that records medical facts about the user (symptoms, history, etc)

CRITICAL MEDICAL SAFETY REQUIREMENTS:
- Use semantic understanding to detect true medical emergencies
- ANY breathing difficulty (regardless of spelling) = EMERGENCY
- Chest pain, stroke symptoms, severe bleeding = EMERGENCY  
- Infant fever, loss of consciousness = EMERGENCY
- Update emergencyFlags ONLY for true emergencies (life-threatening conditions)

EMPATHETIC COMMUNICATION PRINCIPLES:
- Be genuinely empathetic and conversational - vary your language naturally
- Avoid repeating the same phrases (like "I understand..." or "You did the right thing...")
- When someone reports high pain (8-10/10), acknowledge the severity meaningfully
- Examples of natural responses (don't copy exactly, be authentic):
  * "That level of pain must be really difficult to deal with"
  * "A 10 out of 10 - that sounds incredibly painful"
  * "I can only imagine how uncomfortable that must be making you feel"

SMART PAIN ASSESSMENT FRAMEWORK:
- Use context-aware clinical reasoning: 10/10 foot pain ≠ 10/10 chest pain
- High-risk locations (chest, head, abdomen, back): Immediate evaluation if severe
- Moderate-risk locations (foot, hand, knee, shoulder): Consider patient choice for 8-10/10 pain
- Patient autonomy: "Given your [location] pain at [severity]/10, you have options..."
- Choice framework: "I can help you find urgent care right now, OR I can do a quick assessment first to help determine the best place for care. What feels right to you?"
- Clinical reasoning priorities: Location → Severity → Associated symptoms → Patient preference
- Frame as partnership: "helping find the best place to get care" not gatekeeping
- Always offer escalation while respecting patient decision-making autonomy

REASONING CHAIN CONTINUITY:
- Build upon your previous reasoning from past exchanges
- Reference relevant observations from earlier conversations
- Show clinical thinking progression across multiple interactions
- Update your assessment as new information becomes available

PREVIOUS CONVERSATION CONTEXT:
${exchangeContext}

CURRENT MEDICAL MEMORY:
${memoryContext}

NEW USER MESSAGE: "${userMessage}"

Process this message and:
1. Update your reasoning object (explain your medical assessment, emergency evaluation, and next steps)
2. Compose a user-facing reply that provides appropriate medical guidance
3. Update your structured memory with any new medical facts

TRUE EMERGENCY DETECTION (set emergencyFlags only for these):
- Respiratory distress (breathing issues, shortness of breath, gasping)
- Cardiac emergencies (chest pain, heart problems)
- Neurological emergencies (stroke, seizure, confusion)
- Severe trauma (bleeding, severe injuries)
- Allergic reactions (anaphylaxis)
- Infant emergencies (fever in babies <3 months)

NOTE: Severe pain alone (even 10/10) is NOT an emergency unless accompanied by emergency symptoms above

Provide your medical assessment with appropriate urgency detection and memory updates.`;
  }

  /**
   * Format recent exchanges for context
   */
  private formatExchangeContext(exchanges: ExchangeObject[]): string {
    return exchanges
      .map((exchange, index) => {
        return `Exchange ${index + 1}:
User: ${exchange.userMessage}
Assistant Reasoning: ${JSON.stringify(exchange.assistantReasoning, null, 2)}
Assistant Message: ${exchange.assistantMessage}
Memory State: ${JSON.stringify(exchange.assistantMemory, null, 2)}
---`;
      })
      .join('\n');
  }

  /**
   * Get initial memory template
   */
  private getInitialMemoryTemplate(): string {
    return JSON.stringify(
      {
        symptoms: [],
        medicalHistory: [],
        medications: [],
        allergies: [],
        emergencyFlags: [],
        lastUpdate: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Get the response schema for structured output
   */
  private getResponseSchema(): any {
    return {
      type: 'object',
      properties: {
        updated_reasoning: {
          type: 'object',
          properties: {
            plan: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } },
            observations: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['plan', 'steps', 'observations', 'confidence'],
        },
        assistant_message: { type: 'string' },
        updated_memory: {
          type: 'object',
          properties: {
            symptoms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  severity: { type: 'number' },
                  onset: { type: 'string' },
                  timestamp: { type: 'string' },
                },
                required: ['description', 'severity', 'onset', 'timestamp'],
              },
            },
            medicalHistory: { type: 'array', items: { type: 'string' } },
            medications: { type: 'array', items: { type: 'string' } },
            allergies: { type: 'array', items: { type: 'string' } },
            emergencyFlags: { type: 'array', items: { type: 'string' } },
            lastUpdate: { type: 'string' },
          },
          required: [
            'symptoms',
            'medicalHistory',
            'medications',
            'allergies',
            'emergencyFlags',
            'lastUpdate',
          ],
        },
      },
      required: ['updated_reasoning', 'assistant_message', 'updated_memory'],
    };
  }

  /**
   * Parse and validate the LLM response
   */
  private parseAndValidateResponse(responseText: string): StatefulLLMResponse {
    try {
      // Clean up response text (remove markdown, etc.)
      const cleanedResponse = responseText
        .replace(/```json\n?/, '')
        .replace(/```\n?$/, '')
        .trim();

      // Remove debug logs for production

      // Parse JSON
      const parsed = JSON.parse(cleanedResponse);

      // Basic validation
      if (
        !parsed.updated_reasoning ||
        !parsed.assistant_message ||
        !parsed.updated_memory
      ) {
        throw new Error('Missing required fields in LLM response');
      }

      // Ensure emergency flags are properly formatted
      if (!Array.isArray(parsed.updated_memory.emergencyFlags)) {
        parsed.updated_memory.emergencyFlags = [];
      }

      // Update timestamp
      parsed.updated_memory.lastUpdate = new Date().toISOString();

      return parsed as StatefulLLMResponse;
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      throw new Error('Invalid JSON response from LLM');
    }
  }

  /**
   * Generate safety fallback response for critical errors
   */
  private getSafetyFallbackResponse(userMessage: string): StatefulLLMResponse {
    // Check if the message contains emergency keywords as backup
    const emergencyKeywords = [
      'breathing',
      'chest pain',
      'heart',
      'blood',
      'unconscious',
      'seizure',
    ];
    const isEmergency = emergencyKeywords.some((keyword) =>
      userMessage.toLowerCase().includes(keyword)
    );

    return {
      updated_reasoning: {
        plan: 'System error occurred, providing safety-first response',
        steps: [
          'Detected system error',
          'Providing emergency guidance',
          'Recommending professional care',
        ],
        observations: ['System processing error', 'Safety escalation required'],
        confidence: 0.3,
      },
      assistant_message: isEmergency
        ? 'I apologize, but I encountered an error while processing your medical query. Given the nature of your symptoms, I recommend seeking immediate medical attention. If you are experiencing a medical emergency, please call 911 or go to your nearest emergency room.'
        : 'I apologize, but I encountered an error while processing your medical query. For your safety, I recommend consulting with a healthcare professional directly. If you are experiencing emergency symptoms, please call 911.',
      updated_memory: {
        symptoms: [],
        medicalHistory: [],
        medications: [],
        allergies: [],
        emergencyFlags: isEmergency
          ? ['SYSTEM_ERROR_EMERGENCY_DETECTED']
          : ['SYSTEM_ERROR'],
        lastUpdate: new Date().toISOString(),
      },
    };
  }
}

// Export singleton instance
export const statefulMedicalLLM = new StatefulMedicalLLM(
  process.env.GOOGLE_GENAI_API_KEY || ''
);
