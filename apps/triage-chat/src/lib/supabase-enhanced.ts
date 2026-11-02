import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Enhanced function to call edge functions with streaming support
export async function callEdgeFunctionEnhanced(
  functionName: string,
  body: any,
  useStreaming: boolean = false
) {
  try {
    if (useStreaming) {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...body, useStreaming: true }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Edge Function returned ${response.status}: ${response.statusText}`
        );
      }

      return response; // Return the response for streaming handling
    } else {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Edge Function returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Enhanced edge function error:', error);
    throw error;
  }
}

// Streaming response handler
export async function handleStreamingResponse(
  response: Response,
  onChunk: (chunk: string) => void,
  onComplete: (metadata: any) => void,
  onError: (error: Error) => void
) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error('No response body available for streaming');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'content') {
              onChunk(data.text);
            } else if (data.type === 'metadata') {
              onComplete(data);
            }
          } catch (e) {
            console.warn('Failed to parse streaming chunk:', line);
          }
        }
      }
    }
  } catch (error) {
    onError(error as Error);
  } finally {
    reader.releaseLock();
  }
}
