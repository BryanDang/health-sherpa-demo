import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { evaluateSymptoms } from '../triage/decisionTree.ts';
import { TRIAGE_SYSTEM_PROMPT } from '../triage/triage-prompts.ts';
import { HybridMedicalClassifier } from './hybrid-medical-classifier.ts';

// Model selection strategies
interface ModelStrategy {
  primary: string;
  secondary: string;
  fallback: string;
  deprecated_fallback: string;
  dailyLimit: number;
  complexity: 'simple' | 'medium' | 'complex';
}

const INTELLIGENT_MODEL_STRATEGIES = {
  symptom_extraction: {
    primary: 'gemini-2.0-flash-lite', // 30 RPM, 1M TPM, 200 RPD - highest throughput
    secondary: 'gemini-1.5-flash', // 15 RPM, 250K TPM, 50 RPD - reliable (2.5-flash-lite preview name TBD)
    fallback: 'gemini-2.0-flash', // 15 RPM, 1M TPM, 200 RPD - reliable fallback
    deprecated_fallback: 'gemini-1.5-flash-8b', // 15 RPM, 250K TPM, 50 RPD - last resort
    dailyLimit: 200,
    complexity: 'simple',
  },
  quick_triage: {
    primary: 'gemini-2.0-flash', // 15 RPM, 1M TPM, 200 RPD - best balance
    secondary: 'gemini-2.5-flash', // 10 RPM, 250K TPM, 250 RPD - quality option
    fallback: 'gemini-2.0-flash-lite', // 30 RPM, 1M TPM, 200 RPD - fast fallback
    deprecated_fallback: 'gemini-1.5-flash', // 15 RPM, 250K TPM, 50 RPD - last resort
    dailyLimit: 200,
    complexity: 'medium',
  },
  complex_analysis: {
    primary: 'gemini-2.5-pro', // 5 RPM, 250K TPM, 100 RPD - best for complex
    secondary: 'gemini-2.5-flash', // 10 RPM, 250K TPM, 250 RPD - good fallback
    fallback: 'gemini-2.0-flash', // 15 RPM, 1M TPM, 200 RPD - reliable option
    deprecated_fallback: 'gemini-1.5-flash', // 15 RPM, 250K TPM, 50 RPD - last resort
    dailyLimit: 100,
    complexity: 'complex',
  },
  final_response: {
    primary: 'gemini-2.0-flash', // 15 RPM, 1M TPM, 200 RPD - best balance
    secondary: 'gemini-2.5-flash', // 10 RPM, 250K TPM, 250 RPD - quality option
    fallback: 'gemini-2.0-flash-lite', // 30 RPM, 1M TPM, 200 RPD - fast fallback
    deprecated_fallback: 'gemini-1.5-flash', // 15 RPM, 250K TPM, 50 RPD - last resort
    dailyLimit: 200,
    complexity: 'medium',
  },
} as const;

// Usage tracking (simple in-memory for now - would use Supabase for production)
const modelUsageTracker = new Map<string, number>();

function getModelUsage(model: string): number {
  return modelUsageTracker.get(model) || 0;
}

function incrementModelUsage(model: string): void {
  modelUsageTracker.set(model, getModelUsage(model) + 1);
}

// Helper functions
function convertDuration(
  duration: string
): 'less_than_3_days' | '3_to_7_days' | 'more_than_7_days' {
  if (!duration) return 'less_than_3_days';

  const lower = duration.toLowerCase();
  if (
    lower.includes('week') ||
    lower.includes('month') ||
    lower.includes('7') ||
    lower.includes('more')
  ) {
    return 'more_than_7_days';
  }
  if (
    lower.includes('3') ||
    lower.includes('4') ||
    lower.includes('5') ||
    lower.includes('6') ||
    lower.includes('several')
  ) {
    return '3_to_7_days';
  }
  return 'less_than_3_days';
}

function extractIntensity(text: string): number {
  const numbers = text.match(/\b([1-9]|10)\b/g);
  if (numbers) {
    return Math.max(...numbers.map((n) => parseInt(n)));
  }

  const lower = text.toLowerCase();
  if (
    lower.includes('severe') ||
    lower.includes('worst') ||
    lower.includes('unbearable')
  )
    return 9;
  if (lower.includes('moderate') || lower.includes('significant')) return 6;
  if (
    lower.includes('mild') ||
    lower.includes('slight') ||
    lower.includes('minor')
  )
    return 3;

  return 5; // Default moderate
}

function extractFever(text: string): number | undefined {
  const tempMatch = text.match(/\b(\d{2,3}(?:\.\d)?)\s*°?[Ff]?\b/);
  if (tempMatch) {
    const temp = parseFloat(tempMatch[1]);
    if (temp >= 95 && temp <= 110) return temp;
  }
  return undefined;
}

// Smart model selection with fallback chain
function selectModel(
  taskType: keyof typeof INTELLIGENT_MODEL_STRATEGIES
): string {
  const strategy = INTELLIGENT_MODEL_STRATEGIES[taskType];

  // Check primary model availability
  if (getModelUsage(strategy.primary) < strategy.dailyLimit) {
    return strategy.primary;
  }

  // Try secondary
  if (
    getModelUsage(strategy.secondary) <
    INTELLIGENT_MODEL_STRATEGIES[taskType].dailyLimit
  ) {
    return strategy.secondary;
  }

  // Try fallback
  if (getModelUsage(strategy.fallback) < 500) {
    // Conservative fallback limit
    return strategy.fallback;
  }

  // Last resort - deprecated model
  return strategy.deprecated_fallback;
}

// Enhanced Google AI API call with structured output support
async function callGoogleAIStructured(
  prompt: string,
  apiKey: string,
  model: string,
  responseSchema?: any,
  stream: boolean = false
): Promise<string> {
  const requestBody: any = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  // Add structured output schema if provided
  if (responseSchema) {
    requestBody.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
    };
  }

  const endpoint = stream
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(
      `Google AI API error: ${response.status} - ${response.statusText}`
    );
  }

  const result = await response.json();
  if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response from Google AI API');
  }

  return result.candidates[0].content.parts[0].text;
}

// Streaming response handler
async function callGoogleAIStreaming(
  prompt: string,
  apiKey: string,
  model: string,
  responseSchema?: any
): Promise<ReadableStream> {
  const requestBody: any = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  if (responseSchema) {
    requestBody.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Google AI API error: ${response.status} - ${response.statusText}`
    );
  }

  return response.body!;
}

// Helper function to normalize care level format
function normalizeCareLevel(careLevel: string): string {
  return careLevel.replace('_', '-'); // Convert self_care -> self-care
}

// Medical Definitions for Emergency Symptoms
const EMERGENCY_MEDICAL_DEFINITIONS = {
  'uncontrolled bleeding': {
    medicalCriteria: [
      'Bleeding continues despite 10-15 minutes of direct pressure',
      'Bleeding soaks through multiple bandages or dressings',
      'Arterial bleeding (bright red, spurting, pulsatile flow)',
      'Signs of hemorrhagic shock (dizziness, weakness, rapid pulse, pale skin)',
      'Bleeding from critical locations (head, neck, chest, abdomen, major vessels)',
      'Heavy bleeding that creates pooling of blood or continuous dripping',
    ],
    clarifyingQuestions: [
      'How long has the bleeding been going on?',
      'Have you tried applying direct pressure for 10-15 minutes? Did it stop the bleeding?',
      'Is the bleeding bright red and spurting, or dark and steady?',
      'Are you feeling dizzy, weak, or lightheaded?',
      'Where exactly is the bleeding located?',
      'How much blood have you lost (estimate in cups/tablespoons)?',
    ],
  },
  'severe difficulty breathing': {
    medicalCriteria: [
      'Cannot speak in full sentences due to breathlessness',
      'Using accessory muscles to breathe (neck, shoulder muscles straining)',
      'Cyanosis (blue lips, fingernails, or face)',
      'Gasping for air or feeling like suffocating',
      'Sudden onset severe shortness of breath',
      'Breathing rate over 30 breaths per minute',
    ],
    clarifyingQuestions: [
      'Can you speak in full sentences or only a few words at a time?',
      'When did the breathing difficulty start - suddenly or gradually?',
      'Are your lips, fingernails, or face turning blue?',
      'Are you using your neck and shoulder muscles to help you breathe?',
      "Do you feel like you're suffocating or can't get enough air?",
      'On a scale of 1-10, how severe is your breathing difficulty?',
    ],
  },
  'chest pain': {
    medicalCriteria: [
      'Crushing, squeezing, or pressure sensation in chest',
      'Pain radiating to left arm, jaw, neck, or back',
      'Associated with shortness of breath, nausea, or sweating',
      'Sudden onset severe chest pain (8-10/10 intensity)',
      'Pain worsens with exertion or stress',
      "Described as 'worst pain ever' or 'like an elephant on chest'",
    ],
    clarifyingQuestions: [
      'Describe the chest pain - is it crushing, stabbing, burning, or pressure?',
      'On a scale of 1-10, how severe is the pain?',
      'Does the pain radiate to your arm, jaw, neck, or back?',
      'Are you also experiencing shortness of breath, nausea, or sweating?',
      'When did the pain start and did it come on suddenly?',
      'Does the pain get worse with movement or deep breathing?',
    ],
  },
  'severe headache': {
    medicalCriteria: [
      "Sudden onset severe headache ('thunderclap' - worst headache of life)",
      'Headache with fever, stiff neck, or confusion',
      'Headache after head injury or trauma',
      'Headache with vision changes, weakness, or speech problems',
      "Headache intensity 9-10/10 that's different from usual headaches",
      'Headache with persistent vomiting',
    ],
    clarifyingQuestions: [
      "Did this headache come on suddenly like a 'thunderclap'?",
      'On a scale of 1-10, how severe is this headache?',
      "Is this the worst headache you've ever had?",
      'Do you have fever, stiff neck, or confusion along with the headache?',
      'Are you experiencing any vision changes, weakness, or difficulty speaking?',
      'Did you have any recent head injury or trauma?',
    ],
  },
};

// Simplified Hybrid Medical Classification (Rule-Based Safety + AI Backup)
async function classifyWithHybridLogic(
  symptoms: string[],
  context: string,
  apiKey: string
): Promise<{
  careLevel: 'emergency' | 'urgent' | 'primary' | 'self_care';
  reasoning: string[];
  redFlags: string[];
  needsMoreInfo: boolean;
  clarificationQuestions: string[];
}> {
  const fullText = `${symptoms.join(' ')} ${context}`.toLowerCase();

  // Step 1: Quick rule-based safety checks for vague + emergency combinations
  const emergencyKeywords = [
    'bleeding',
    'blood',
    'chest pain',
    'chest discomfort',
    "can't breath",
    'difficulty breath',
    'breathing',
  ];
  const hasEmergencyKeywords = emergencyKeywords.some((keyword) =>
    fullText.includes(keyword)
  );

  const vagueTerms = [
    'feel bad',
    'really bad',
    'unwell',
    'not good',
    'some',
    'something wrong',
  ];
  const isVague = vagueTerms.some((term) => fullText.includes(term));

  // Safety escalation for vague + emergency combinations
  if (isVague && hasEmergencyKeywords) {
    return {
      careLevel: 'urgent',
      reasoning: [
        'Vague symptoms with potential emergency indicators detected',
        'Safety escalation to ensure proper medical evaluation',
        'Emergency conditions must be ruled out',
      ],
      redFlags: ['Insufficient detail for emergency symptoms'],
      needsMoreInfo: true,
      clarificationQuestions: [
        'Can you provide more specific details about your symptoms?',
        'How long have you been experiencing these symptoms?',
        'On a scale of 1-10, how severe are your symptoms?',
        'Are you experiencing severe chest pain, difficulty breathing, or uncontrolled bleeding?',
      ],
    };
  }

  // Step 2: Check for clear emergency patterns (bleeding with duration/severity indicators)
  const hasBleedingWithSeverity =
    /bleeding|blood/.test(fullText) &&
    /won't stop|continuous|despite pressure|minutes|hours|deep|severe|spurting|soaking/.test(
      fullText
    );

  if (hasBleedingWithSeverity) {
    return {
      careLevel: 'emergency',
      reasoning: [
        'Uncontrolled bleeding indicators detected',
        'Bleeding with duration or severity markers',
        'Immediate medical attention required',
      ],
      redFlags: ['Uncontrolled bleeding'],
      needsMoreInfo: false,
      clarificationQuestions: [],
    };
  }

  // Step 3: Emergency keywords without vagueness need clarification or escalation
  if (hasEmergencyKeywords) {
    return {
      careLevel: 'urgent',
      reasoning: [
        'Emergency-related symptoms detected',
        'Urgent evaluation required to rule out emergency conditions',
        'Medical assessment needed for safety',
      ],
      redFlags: ['Potential emergency symptoms'],
      needsMoreInfo: true,
      clarificationQuestions: [
        'Can you describe your symptoms in more detail?',
        'How severe are your symptoms on a scale of 1-10?',
        'When did these symptoms start?',
      ],
    };
  }

  // Step 4: Check for symptoms that need clarification
  const needsMoreInfoPatterns = [
    /pain/i.test(fullText) &&
      !/severe|sharp|crushing|stabbing|throbbing|constant/i.test(fullText),
    /\bache\b/i.test(fullText) && !/severe|sharp|throbbing/i.test(fullText),
    /discomfort/i.test(fullText) && !/severe|sharp/i.test(fullText),
    /feel.*bad|unwell|not.*good/i.test(fullText),
    /something.*wrong/i.test(fullText),
    /bothering/i.test(fullText) && !/severe|sharp|bad/i.test(fullText),
  ];

  const lacksSpecifics = [
    !/\d+.*10|scale/i.test(fullText), // No severity scale mentioned
    !/hour|day|week|month|yesterday|today|recently/i.test(fullText), // No duration
    !/getting.*worse|better|same/i.test(fullText), // No progression info
  ];

  const hasCommonSymptoms = /pain|ache|discomfort|sore|hurt|bothering/i.test(
    fullText
  );
  const needsMoreInfo =
    needsMoreInfoPatterns.some(Boolean) ||
    (hasCommonSymptoms && lacksSpecifics.filter(Boolean).length >= 2);

  if (needsMoreInfo) {
    return {
      careLevel: 'primary',
      reasoning: [
        'More information needed for accurate assessment',
        'Standard medical evaluation recommended',
        'Clarification needed on symptom details',
      ],
      redFlags: [],
      needsMoreInfo: true,
      clarificationQuestions: [
        'On a scale of 1-10, how would you rate the severity of your symptoms?',
        'When did these symptoms first start?',
        'Are the symptoms getting better, worse, or staying the same?',
        'What makes the symptoms better or worse?',
        'Have you tried any treatments or medications for this?',
      ],
    };
  }

  // Step 5: Multiple vague symptoms need clarification
  if (
    symptoms.length > 1 &&
    (isVague || /dizzy|nauseous|tired|confused/.test(fullText))
  ) {
    return {
      careLevel: 'primary',
      reasoning: [
        'Multiple symptoms requiring clarification',
        'More information needed for accurate assessment',
        'Standard medical evaluation recommended',
      ],
      redFlags: [],
      needsMoreInfo: true,
      clarificationQuestions: [
        'When did each symptom start?',
        'Are you experiencing any severe pain, difficulty breathing, or chest discomfort?',
        'Have you had any recent injuries or medical procedures?',
      ],
    };
  }

  // Step 6: Default to standard evaluation
  return {
    careLevel: 'primary',
    reasoning: [
      'Standard medical evaluation recommended',
      'No emergency indicators identified',
    ],
    redFlags: [],
    needsMoreInfo: false,
    clarificationQuestions: [],
  };
}

// Helper function to get next steps based on care level
function getNextStepsForCareLevel(careLevel: string): string[] {
  switch (careLevel) {
    case 'emergency':
      return [
        'Call 911 immediately',
        'Go to nearest emergency room',
        'Do not drive yourself',
      ];
    case 'urgent':
      return [
        'Seek medical attention within 24 hours',
        'Visit urgent care or ER',
        'Monitor symptoms closely',
      ];
    case 'primary':
      return [
        'Schedule appointment with primary care doctor',
        'Monitor symptoms',
        'Seek urgent care if worsening',
      ];
    case 'self_care':
      return [
        'Try home remedies and rest',
        'Monitor for 3-7 days',
        'Seek care if symptoms persist or worsen',
      ];
    default:
      return ['Consult with healthcare provider'];
  }
}

// Helper function to format structured response into human-readable text
function formatStructuredResponse(structured: any, decision: any): string {
  let formatted = '';

  // Assessment section
  if (structured.assessment) {
    formatted += '**Assessment:**\n';
    formatted += `Based on your symptoms, I recommend ${structured.assessment.careLevel} care. `;
    if (structured.assessment.severity) {
      formatted += `This appears to be ${structured.assessment.severity} severity. `;
    }
    formatted += '\n\n';
  }

  // Symptoms summary
  if (structured.symptoms) {
    if (structured.symptoms.primary?.length > 0) {
      formatted += '**Symptoms Analyzed:**\n';
      formatted += `• ${structured.symptoms.primary.join(', ')}\n`;
    }

    if (structured.symptoms.redFlags?.length > 0) {
      formatted += '**Red Flags Identified:**\n';
      formatted += `• ${structured.symptoms.redFlags.join('\n• ')}\n`;
    }
    formatted += '\n';
  }

  // Recommendations
  if (structured.recommendations) {
    formatted += '**Recommendations:**\n';

    if (structured.recommendations.immediate?.length > 0) {
      formatted += '*Immediate actions:*\n';
      structured.recommendations.immediate.forEach((rec: string) => {
        formatted += `• ${rec}\n`;
      });
    }

    if (structured.recommendations.shortTerm?.length > 0) {
      formatted += '*Short-term care:*\n';
      structured.recommendations.shortTerm.forEach((rec: string) => {
        formatted += `• ${rec}\n`;
      });
    }

    if (structured.recommendations.longTerm?.length > 0) {
      formatted += '*Long-term considerations:*\n';
      structured.recommendations.longTerm.forEach((rec: string) => {
        formatted += `• ${rec}\n`;
      });
    }
    formatted += '\n';
  }

  // Next steps
  if (structured.nextSteps) {
    formatted += '**Next Steps:**\n';
    if (structured.nextSteps.seekCare) {
      formatted += `• ${structured.nextSteps.seekCare}`;
      if (structured.nextSteps.timeframe) {
        formatted += ` ${structured.nextSteps.timeframe}`;
      }
      formatted += '\n';
    }

    if (structured.nextSteps.watchFor?.length > 0) {
      formatted += '*Watch for these warning signs:*\n';
      structured.nextSteps.watchFor.forEach((sign: string) => {
        formatted += `• ${sign}\n`;
      });
    }
    formatted += '\n';
  }

  // Disclaimer
  if (structured.disclaimer) {
    formatted += '**Important:**\n';
    formatted += structured.disclaimer;
  }

  return formatted.trim();
}

// Structured response schema for triage
const TRIAGE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    assessment: {
      type: 'object',
      properties: {
        careLevel: {
          type: 'string',
          enum: ['emergency', 'urgent', 'primary', 'self-care'],
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
        },
        urgency: { type: 'string' },
        severity: { type: 'string' },
      },
      required: ['careLevel', 'confidence'],
    },
    symptoms: {
      type: 'object',
      properties: {
        primary: { type: 'array', items: { type: 'string' } },
        secondary: { type: 'array', items: { type: 'string' } },
        redFlags: { type: 'array', items: { type: 'string' } },
      },
    },
    recommendations: {
      type: 'object',
      properties: {
        immediate: { type: 'array', items: { type: 'string' } },
        shortTerm: { type: 'array', items: { type: 'string' } },
        longTerm: { type: 'array', items: { type: 'string' } },
      },
    },
    nextSteps: {
      type: 'object',
      properties: {
        seekCare: { type: 'string' },
        timeframe: { type: 'string' },
        watchFor: { type: 'array', items: { type: 'string' } },
      },
    },
    disclaimer: { type: 'string' },
  },
  required: ['assessment', 'recommendations', 'nextSteps', 'disclaimer'],
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      message,
      conversationHistory = [],
      useStreaming = false,
    } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get API key
    const apiKey = Deno.env.get('GOOGLE_GENAI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration error: API key not found' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 1: Smart model selection for symptom extraction
    const extractionModel = selectModel('symptom_extraction');
    incrementModelUsage(extractionModel);

    const conversationContext =
      conversationHistory.length > 0
        ? `\n\nPrevious conversation context:\n${conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join('\n')}`
        : '';

    const extractionPrompt = `
      Extract ONLY the information that is explicitly mentioned in this user message, considering the conversation context.
      
      User's current message: "${message}"${conversationContext}
      
      Return ONLY a JSON object with these exact fields:
      {
        "symptoms": ["list of symptoms explicitly mentioned in current message OR from previous context"],
        "duration": "exact duration mentioned, or empty string if not specified",
        "intensity": "exact severity/intensity mentioned, or empty string if not specified",
        "recentContact": "any mention of recent medical contact, or empty string if not mentioned"
      }
      
      CRITICAL: Consider the full conversation when identifying symptoms, but only extract explicitly stated information. Do NOT guess or assume details that weren't provided.
    `;

    const extractedText = await callGoogleAIStructured(
      extractionPrompt,
      apiKey,
      extractionModel
    );

    let symptomInfo;
    try {
      const parsed = JSON.parse(
        extractedText.replace(/```json\n?|\n?```/g, '')
      );
      symptomInfo = {
        symptoms: parsed.symptoms || [message],
        duration: parsed.duration || '',
        intensity: parsed.intensity || '',
        recentContact: parsed.recentContact || '',
      };
    } catch (e) {
      symptomInfo = {
        symptoms: [message],
        duration: '',
        intensity: '',
        recentContact: '',
      };
    }

    // Convert to the format expected by decision tree
    const structuredSymptomInfo = {
      symptoms: symptomInfo.symptoms,
      duration: symptomInfo.duration
        ? convertDuration(symptomInfo.duration)
        : 'less_than_3_days',
      intensity: symptomInfo.intensity
        ? extractIntensity(symptomInfo.intensity)
        : 5,
      recentContact:
        symptomInfo.recentContact.toLowerCase().includes('yes') ||
        symptomInfo.recentContact.toLowerCase().includes('recently'),
      fever: extractFever(message),
    };

    // Step 2: Apply hybrid medical classification (rule-based + AI)
    let decision;
    try {
      console.log(
        'Applying hybrid classifier with symptoms:',
        structuredSymptomInfo.symptoms
      );
      const hybridResult = await classifyWithHybridLogic(
        structuredSymptomInfo.symptoms,
        `${message} ${conversationContext}`,
        apiKey
      );

      console.log('Hybrid classifier result:', hybridResult);

      decision = {
        careLevel: hybridResult.careLevel,
        reasoning: hybridResult.reasoning,
        redFlags: hybridResult.redFlags,
        timeframe:
          hybridResult.careLevel === 'emergency'
            ? 'Immediately'
            : hybridResult.careLevel === 'urgent'
              ? 'Within 24 hours'
              : 'Within 2 weeks',
        nextSteps: getNextStepsForCareLevel(hybridResult.careLevel),
        needsMoreInfo: hybridResult.needsMoreInfo || false,
        clarificationQuestions: hybridResult.clarificationQuestions || [],
      };
    } catch (error) {
      console.error(
        'Hybrid classifier failed, falling back to decision tree:',
        error
      );
      decision = evaluateSymptoms(structuredSymptomInfo);
    }

    // Step 3: Smart model selection for final response
    const responseModel = selectModel('final_response');
    incrementModelUsage(responseModel);

    const responsePrompt = `
      ${TRIAGE_SYSTEM_PROMPT}
      
      Conversation history:${conversationContext}
      
      User's current message: "${message}"
      User symptoms identified from full conversation: ${JSON.stringify(structuredSymptomInfo.symptoms)}
      
      Based on our evidence-based triage evaluation:
      - Care Level: ${decision.careLevel}
      - Red Flags: ${decision.redFlags.join(', ') || 'None identified'}
      - Clinical Reasoning: ${decision.reasoning.join('. ')}
      
      Provide a structured, empathetic response that:
      1. Acknowledges their symptoms as described throughout the conversation
      2. Explains the ${decision.careLevel} recommendation 
      3. Provides specific next steps
      4. Includes relevant safety information
      5. Maintains professional medical disclaimers
      6. Uses clear formatting with sections and bullet points
      
      Format your response with:
      **Assessment:** Clear summary
      **Recommendations:** 
      • Immediate actions
      • Short-term steps
      **Next Steps:** When and where to seek care
      **Important:** Safety warnings and disclaimers
      
      Keep response conversational but professional, maintaining conversation flow.
    `;

    if (useStreaming) {
      // Get structured response first, then simulate streaming
      const structuredResponse = await callGoogleAIStructured(
        responsePrompt,
        apiKey,
        responseModel,
        TRIAGE_RESPONSE_SCHEMA
      );

      // Parse the structured response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(structuredResponse);
      } catch (e) {
        parsedResponse = { response: structuredResponse };
      }

      // Format the structured response into human-readable text
      const formattedResponse = formatStructuredResponse(
        parsedResponse,
        decision
      );

      // Simulate streaming by chunking the response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          const chunkSize = 20; // Characters per chunk
          const chunks = [];

          // Split response into chunks
          for (let i = 0; i < formattedResponse.length; i += chunkSize) {
            chunks.push(formattedResponse.slice(i, i + chunkSize));
          }

          let chunkIndex = 0;

          function sendNextChunk() {
            if (chunkIndex < chunks.length) {
              const data = {
                type: 'content',
                text: chunks[chunkIndex],
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
              );
              chunkIndex++;

              // Send next chunk after short delay
              setTimeout(sendNextChunk, 50);
            } else {
              // Send final metadata
              const finalData = {
                type: 'metadata',
                careLevel: normalizeCareLevel(decision.careLevel),
                reasoning: {
                  symptomsAnalyzed: structuredSymptomInfo.symptoms,
                  redFlags: decision.redFlags,
                  careLevelJustification: decision.reasoning
                    .join('. ')
                    .replace(
                      /Moderate symptom intensity \(5\/10\)/,
                      'Symptom intensity not specified by user'
                    ),
                  modelsUsed: {
                    extraction: extractionModel,
                    response: responseModel,
                  },
                },
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`)
              );
              controller.close();
            }
          }

          // Start sending chunks
          sendNextChunk();
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      // Handle non-streaming response with structured output
      const structuredResponse = await callGoogleAIStructured(
        responsePrompt,
        apiKey,
        responseModel,
        TRIAGE_RESPONSE_SCHEMA
      );

      // Parse the structured response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(structuredResponse);
      } catch (e) {
        // Fallback to text response if parsing fails
        parsedResponse = { response: structuredResponse };
      }

      // Format the structured response into human-readable text
      let formattedResponse = formatStructuredResponse(
        parsedResponse,
        decision
      );

      // Add clarification questions if needed
      if (
        decision.needsMoreInfo &&
        decision.clarificationQuestions?.length > 0
      ) {
        formattedResponse +=
          '\n\n**I need more information to provide the best guidance:**\n';
        decision.clarificationQuestions.forEach((question: string) => {
          formattedResponse += `• ${question}\n`;
        });
      }

      return new Response(
        JSON.stringify({
          response: formattedResponse,
          careLevel: normalizeCareLevel(decision.careLevel), // Normalize format
          reasoning: {
            symptomsAnalyzed: structuredSymptomInfo.symptoms,
            redFlags: decision.redFlags,
            careLevelJustification: decision.reasoning
              .join('. ')
              .replace(
                /Moderate symptom intensity \(5\/10\)/,
                'Symptom intensity not specified by user'
              ),
            modelsUsed: {
              extraction: extractionModel,
              response: responseModel,
            },
          },
          structured: true,
          needsMoreInfo: decision.needsMoreInfo || false,
          clarificationQuestions: decision.clarificationQuestions || [],
          rawStructured: parsedResponse, // Include raw structured data for debugging
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Enhanced triage error:', error);
    return new Response(
      JSON.stringify({
        error: 'An error occurred during enhanced triage analysis',
        response:
          "I'm experiencing technical difficulties. For urgent medical concerns, please contact emergency services immediately or visit your nearest emergency department.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
