import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { evaluateSymptoms } from './decisionTree.ts';
import { TRIAGE_SYSTEM_PROMPT } from './triage-prompts.ts';

// Helper functions to convert AI responses to structured data
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

// Google AI REST API helper
async function callGoogleAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Google AI API error: ${response.status}`);
  }

  const result = await response.json();
  if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response from Google AI API');
  }

  return result.candidates[0].content.parts[0].text;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] } = await req.json();

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

    // Step 1: Use Google AI to extract structured information from user input
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

    const extractedText = await callGoogleAI(extractionPrompt, apiKey);

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
      // Fallback if JSON parsing fails
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
        : 5, // Default to moderate only if not specified
      recentContact:
        symptomInfo.recentContact.toLowerCase().includes('yes') ||
        symptomInfo.recentContact.toLowerCase().includes('recently'),
      fever: extractFever(message),
    };

    // Step 2: Apply evidence-based decision tree
    const decision = evaluateSymptoms(structuredSymptomInfo);

    // Step 3: Generate comprehensive response with Google AI
    const responsePrompt = `
      ${TRIAGE_SYSTEM_PROMPT}
      
      Conversation history:${conversationContext}
      
      User's current message: "${message}"
      User symptoms identified from full conversation: ${JSON.stringify(structuredSymptomInfo.symptoms)}
      
      Based on our evidence-based triage evaluation:
      - Care Level: ${decision.careLevel}
      - Red Flags: ${decision.redFlags.join(', ') || 'None identified'}
      - Clinical Reasoning: ${decision.reasoning.join('. ')}
      
      IMPORTANT: 
      - Consider the FULL conversation context when responding
      - Only reference information the user actually provided across all messages
      - Do NOT ask for information already provided in previous messages
      - Build upon the ongoing conversation naturally
      
      Provide a clear, empathetic response that:
      1. Acknowledges their symptoms as described throughout the conversation
      2. Explains the ${decision.careLevel} recommendation 
      3. Provides specific next steps
      4. Includes relevant safety information
      5. Maintains professional medical disclaimers
      6. If missing information is needed for better assessment, ASK for it rather than assuming (but don't re-ask for information already provided)
      
      Keep response conversational but professional, maintaining conversation flow.
    `;

    const finalResponse = await callGoogleAI(responsePrompt, apiKey);

    return new Response(
      JSON.stringify({
        response: finalResponse,
        careLevel: decision.careLevel,
        reasoning: {
          symptomsAnalyzed: structuredSymptomInfo.symptoms,
          redFlags: decision.redFlags,
          careLevelJustification: decision.reasoning
            .join('. ')
            .replace(
              /Moderate symptom intensity \(5\/10\)/,
              'Symptom intensity not specified by user'
            ),
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Triage error:', error);
    return new Response(
      JSON.stringify({
        error: 'An error occurred during triage analysis',
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
