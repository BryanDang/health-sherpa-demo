/**
 * Mock backend. No network, no credentials. Sample data. Not medical advice.
 */

import type { Backend, ChatBackend, ChatContext, ChatReply } from './types';

const PHASE_TEXT: Record<number, string> = {
  0: 'This is the setup phase. Tell me what you want to understand about your health information.',
  1: 'Here is a plain-language summary based on the sample document: the visit notes list a routine check, one lab to repeat, and one medication to review.',
  2: 'Pattern from the sample document: the repeated lab and the medication review are linked, so ask about both at the same visit.',
  3: 'Putting the pieces together: the sample findings point to one follow-up visit with two questions.',
  4: 'Next steps from the sample document: book the follow-up, bring the medication list, and ask about the repeat lab.',
};

export class MockChat implements ChatBackend {
  async reply(message: string, context: ChatContext): Promise<ChatReply> {
    const phase = Number(context.currentPhase) || 0;
    const who = context.isProviderMode ? 'provider' : 'patient';
    const doc = context.documentContent ? ' A document is loaded.' : '';
    const asked = message.length <= 200 ? ` You asked: "${message}"` : '';
    return {
      content: `Sample reply (${who} view, phase ${phase}).${doc}${asked}\n\n${PHASE_TEXT[phase] ?? PHASE_TEXT[0]}\n\nSample data. Not medical advice.`,
      confidence: 60,
      citations: [],
      searchQueries: [],
      groundingSources: [],
      reasoning: 'Canned sample reply from the mock backend',
      modelUsed: 'mock',
      suggestedActions: [
        'Ask a more specific question',
        'Upload a document',
        'Talk to a clinician for medical decisions',
      ],
    };
  }
}

export function createMockBackend(): Backend {
  return { mode: 'mock', chat: new MockChat() };
}
