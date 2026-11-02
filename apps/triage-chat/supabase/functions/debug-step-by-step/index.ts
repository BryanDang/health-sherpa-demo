import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Step-by-step debug function called');

    const { message, step = 1 } = await req.json();
    console.log('Message received:', message, 'Step:', step);

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

    // Step 1: Test basic imports
    if (step === 1) {
      console.log('Step 1: Testing imports');

      try {
        // Test decision tree import
        const { evaluateSymptoms } = await import('../triage/decisionTree.ts');
        console.log('decisionTree.ts imported successfully');

        // Test triage prompts import
        const { TRIAGE_SYSTEM_PROMPT } = await import(
          '../triage/triage-prompts.ts'
        );
        console.log('triage-prompts.ts imported successfully');

        return new Response(
          JSON.stringify({
            success: true,
            step: 1,
            message: 'All imports successful',
            details: {
              decisionTreeImported: true,
              triagePromptsImported: true,
              triagePromptLength: TRIAGE_SYSTEM_PROMPT.length,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (importError) {
        console.error('Import error:', importError);
        return new Response(
          JSON.stringify({
            error: 'Import error in step 1',
            details: importError.message,
            stack: importError.stack,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Step 2: Test hybrid classifier import
    if (step === 2) {
      console.log('Step 2: Testing hybrid classifier import');

      try {
        const { HybridMedicalClassifier } = await import(
          './hybrid-medical-classifier.ts'
        );
        console.log('HybridMedicalClassifier imported successfully');

        const classifier = new HybridMedicalClassifier();
        console.log('HybridMedicalClassifier instantiated successfully');

        return new Response(
          JSON.stringify({
            success: true,
            step: 2,
            message: 'Hybrid classifier import and instantiation successful',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (importError) {
        console.error('Hybrid classifier import error:', importError);
        return new Response(
          JSON.stringify({
            error: 'Hybrid classifier import error in step 2',
            details: importError.message,
            stack: importError.stack,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Step 3: Test symptom extraction
    if (step === 3) {
      console.log('Step 3: Testing symptom extraction');

      try {
        const extractionPrompt = `
        Extract ONLY the information that is explicitly mentioned in this user message.
        
        User's current message: "${message}"
        
        Return ONLY a JSON object with these exact fields:
        {
          "symptoms": ["list of symptoms explicitly mentioned"],
          "duration": "exact duration mentioned, or empty string if not specified",
          "intensity": "exact severity/intensity mentioned, or empty string if not specified",
          "recentContact": "any mention of recent medical contact, or empty string if not mentioned"
        }
      `;

        const requestBody = {
          contents: [
            {
              parts: [{ text: extractionPrompt }],
            },
          ],
        };

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
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

        const result = await response.json();
        const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        console.log('Raw extraction result:', extractedText);

        // Try to parse the JSON
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
        } catch (parseError) {
          console.log('JSON parse failed, using fallback');
          symptomInfo = {
            symptoms: [message],
            duration: '',
            intensity: '',
            recentContact: '',
          };
        }

        return new Response(
          JSON.stringify({
            success: true,
            step: 3,
            message: 'Symptom extraction successful',
            symptomInfo: symptomInfo,
            rawExtraction: extractedText,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (extractionError) {
        console.error('Symptom extraction error:', extractionError);
        return new Response(
          JSON.stringify({
            error: 'Symptom extraction error in step 3',
            details: extractionError.message,
            stack: extractionError.stack,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Invalid step',
        validSteps: [1, 2, 3],
        currentStep: step,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Step-by-step debug function error:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: 'Step-by-step debug function error',
        details: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
