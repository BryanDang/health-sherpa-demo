import { useState, useCallback } from 'react';
import { useTokenState } from '@/store/hooks';

interface ChatResponse {
  content: string;
  confidence: number;
  citations: any[];
  searchQueries: string[];
  groundingSources: any[];
  reasoning: string;
  modelUsed: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  suggestedActions: string[];
}

interface ChatRequest {
  message: string;
  context: {
    documentContent?: string;
    currentPhase: number;
    conversationHistory: any[];
    isProviderMode: boolean;
  };
}

export function useChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addTokenUsage } = useTokenState();

  const sendMessage = useCallback(
    async (request: ChatRequest): Promise<ChatResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: ChatResponse = await response.json();

        // Update token usage if provided
        if (data.tokenUsage) {
          addTokenUsage({
            inputTokens: data.tokenUsage.inputTokens,
            outputTokens: data.tokenUsage.outputTokens,
            totalTokens: data.tokenUsage.totalTokens,
            estimatedCost: data.tokenUsage.estimatedCost,
          });
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [addTokenUsage]
  );

  return {
    sendMessage,
    isLoading,
    error,
    clearError: () => setError(null),
  };
}
