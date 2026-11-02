/**
 * Live backend. Not tested here.
 * Selected with BACKEND_MODE=live. Needs GOOGLE_GENAI_API_KEY.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Backend, ChatBackend, ChatContext, ChatReply } from './types';

function buildSystemPrompt(context: ChatContext): string {
  const { currentPhase, isProviderMode, documentContent, conversationHistory } =
    context;

  let prompt = `You are Health Sherpa, an assistant specialized in helping ${
    isProviderMode ? 'healthcare providers' : 'patients'
  } understand health information.`;

  switch (currentPhase) {
    case 0:
      prompt += ` You are in the Trust & Setup phase. Focus on building rapport and understanding the user's needs.`;
      break;
    case 1:
      prompt += ` You are in the Clinical Summary phase. Help create clear, understandable summaries of health information.`;
      break;
    case 2:
      prompt += ` You are in the Insights phase. Focus on identifying patterns and generating actionable insights.`;
      break;
    case 3:
      prompt += ` You are in the Synthesis phase. Help connect different pieces of information into coherent understanding.`;
      break;
    case 4:
      prompt += ` You are in the Actions phase. Focus on prioritizing next steps and actionable recommendations.`;
      break;
  }

  if (documentContent) {
    prompt += `\n\nYou have access to the user's health document content. Reference specific information when relevant, but always maintain privacy and provide appropriate disclaimers about medical advice.`;
  }

  if (conversationHistory.length > 0) {
    prompt += `\n\nConversation context: The user has been discussing health topics. Maintain continuity with previous exchanges.`;
  }

  prompt += `\n\nGuidelines:
- Provide accurate, helpful information while being empathetic
- Always recommend consulting healthcare providers for medical decisions
- Use clear, accessible language appropriate for the user type
- Reference specific document content when relevant
- Maintain patient privacy and confidentiality
- Be honest about limitations and uncertainties`;

  return prompt;
}

export class LiveChat implements ChatBackend {
  async reply(message: string, context: ChatContext): Promise<ChatReply> {
    const key = process.env.GOOGLE_GENAI_API_KEY;
    if (!key) throw new Error('GOOGLE_GENAI_API_KEY is not set');
    const model = new GoogleGenerativeAI(key).getGenerativeModel({
      model: 'gemini-1.5-flash',
    });
    const prompt = `${buildSystemPrompt(context)}\n\nHuman Message: ${message}\n\nPlease provide a helpful, medically-informed response based on the context provided.`;
    const result = await model.generateContent(prompt);
    return {
      content: result.response.text(),
      confidence: 85,
      citations: [],
      searchQueries: [],
      groundingSources: [],
      reasoning: 'Model-generated health response',
      modelUsed: 'gemini-1.5-flash',
      suggestedActions: [
        'Consult your healthcare provider',
        'Ask more specific questions',
        'Upload health documents for better analysis',
      ],
    };
  }
}

export function createLiveBackend(): Backend {
  return { mode: 'live', chat: new LiveChat() };
}
