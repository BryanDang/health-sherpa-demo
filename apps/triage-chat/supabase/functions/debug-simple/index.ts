import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Debug function called');

    const { message } = await req.json();
    console.log('Message received:', message);

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test 1: Basic response
    console.log('Test 1: Basic response');

    // Test 2: Check environment variables
    const apiKey = Deno.env.get('GOOGLE_GENAI_API_KEY');
    console.log('Test 2: API key present:', apiKey ? 'YES' : 'NO');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration error: API key not found' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Test 3: Try simple Google AI call
    console.log('Test 3: Attempting Google AI call');

    const simplePrompt =
      'Say "Hello World" in JSON format: {"response": "Hello World"}';

    const requestBody = {
      contents: [
        {
          parts: [{ text: simplePrompt }],
        },
      ],
    };

    console.log('Request body:', JSON.stringify(requestBody));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    console.log('Google AI response status:', response.status);
    console.log('Google AI response headers:', response.headers);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google AI error response:', errorText);
      return new Response(
        JSON.stringify({
          error: `Google AI API error: ${response.status}`,
          details: errorText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await response.json();
    console.log('Google AI result:', JSON.stringify(result));

    const aiResponse =
      result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    return new Response(
      JSON.stringify({
        success: true,
        message: `Debug test successful for: ${message}`,
        apiKeyPresent: true,
        googleAIResponse: aiResponse,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Debug function error:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: 'Debug function error',
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
