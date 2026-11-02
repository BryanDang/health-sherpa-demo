import { NextRequest, NextResponse } from 'next/server';
import type { ChatMessage, PhaseNumber } from '@/types/core';
import { getBackend } from '@/lib/backend';
import { overLimit } from '@/lib/backend/rate-limit';

const MAX_MESSAGE_CHARS = 8000;
const MAX_DOCUMENT_CHARS = 200000;

export interface ChatRequest {
  message: string;
  context: {
    documentContent?: string;
    currentPhase: PhaseNumber;
    conversationHistory: ChatMessage[];
    isProviderMode: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    if (overLimit(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body: ChatRequest = await request.json();
    const { message, context } = body;

    // Validate request
    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 413 });
    }
    if ((context?.documentContent?.length ?? 0) > MAX_DOCUMENT_CHARS) {
      return NextResponse.json({ error: 'Document is too long' }, { status: 413 });
    }

    try {
      const aiResponse = await getBackend().chat.reply(message, {
        ...context,
        conversationHistory: Array.isArray(context?.conversationHistory)
          ? context.conversationHistory
          : [],
      });
      return NextResponse.json(aiResponse);
    } catch (aiError) {
      console.error('AI Service error:', aiError);

      // Fallback response if AI service fails
      const fallbackResponse = {
        content: `I apologize, but I'm experiencing technical difficulties. Please try again in a moment.
        
Your question: "${message}"

In the meantime, consider:
- Reviewing any uploaded documents for immediate insights
- Asking a more specific question about your health information
- Checking back in a few minutes when the service may be restored`,
        confidence: 30,
        citations: [],
        searchQueries: [],
        groundingSources: [],
        reasoning: 'Fallback response due to AI service error',
        modelUsed: 'fallback',
        suggestedActions: [
          'Try again in a moment',
          'Rephrase your question',
          'Check your document for immediate answers',
        ],
      };

      return NextResponse.json(fallbackResponse);
    }
  } catch (error) {
    console.error('Chat API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate response',
        content:
          'I apologize, but I encountered an error. Please try again or rephrase your question.',
        confidence: 0,
        modelUsed: 'gemini-2.0-flash',
      },
      { status: 500 }
    );
  }
}
