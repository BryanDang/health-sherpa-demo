import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== DEBUG ECHO FUNCTION ===');
    console.log('Method:', req.method);
    const headers = Object.fromEntries(req.headers.entries());
    console.log('Headers:', headers);

    const body = await req.text();
    console.log('Raw body:', body);
    console.log('Body length:', body.length);
    console.log('Body type:', typeof body);

    // Try to parse JSON
    let parsedBody = null;
    let parseError = null;
    try {
      parsedBody = JSON.parse(body);
    } catch (e) {
      parseError = e.message;
    }

    return new Response(
      JSON.stringify({
        received: {
          method: req.method,
          headers: headers,
          body: body,
          parsedBody: parsedBody,
          parseError: parseError,
          bodyLength: body.length,
          bodyType: typeof body,
          clientType: headers['x-client-info'] || 'unknown',
          hasApiKey: !!headers['apikey'],
          hasAuth: !!headers['authorization'],
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Echo error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
