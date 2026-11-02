'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

import type { ChatMessage, PhaseNumber } from '@/types/core';
import { useDocumentState, useUIState, usePhaseState } from '@/store/hooks';

interface ChatInterfaceProps {
  className?: string;
}

export default function ChatInterface({ className = '' }: ChatInterfaceProps) {
  // ALL HOOKS MUST BE AT THE TOP - NEVER CONDITIONAL OR AFTER EARLY RETURNS
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Real state management with Zustand store
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store integration
  const { activeDocument } = useDocumentState();
  const { isProviderMode } = useUIState();
  const { currentPhase } = usePhaseState();

  // Only render on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Handle client-side check in JSX instead of early return
  if (!isClient) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center text-gray-500">
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setError(null);

    try {
      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        content: messageContent,
        role: 'user',
        phase: currentPhase,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      setIsLoading(true);
      setIsTyping(true);

      // Call AI via API route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          context: {
            documentContent: activeDocument?.content,
            currentPhase,
            conversationHistory: messages,
            isProviderMode,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const aiResponse = await response.json();

      // Add AI response with full metadata
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        content: aiResponse.content,
        role: 'assistant',
        phase: currentPhase,
        timestamp: new Date().toISOString(),
        confidence: aiResponse.confidence,
        citations: aiResponse.citations,
        metadata: {
          searchQueries: aiResponse.searchQueries,
          groundingSources: aiResponse.groundingSources,
          reasoning: aiResponse.reasoning,
          modelUsed: aiResponse.modelUsed || 'gemini-1.5-flash',
        },
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to send message'
      );

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        content:
          'I apologize, but I encountered an error. Please try again or rephrase your question.',
        role: 'assistant',
        phase: currentPhase,
        timestamp: new Date().toISOString(),
        confidence: 0,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getPhaseColor = (phase: PhaseNumber): string => {
    const colors: Record<PhaseNumber, string> = {
      0: 'bg-blue-100 text-blue-800',
      1: 'bg-green-100 text-green-800',
      2: 'bg-yellow-100 text-yellow-800',
      3: 'bg-purple-100 text-purple-800',
      4: 'bg-red-100 text-red-800',
    };
    return colors[phase] || 'bg-gray-100 text-gray-800';
  };

  const getPhaseLabel = (phase: PhaseNumber): string => {
    const labels: Record<PhaseNumber, string> = {
      0: 'Trust Building',
      1: 'Clinical Summary',
      2: 'Gather Insights',
      3: 'Synthesize Evidence',
      4: 'Prioritize Actions',
    };
    return labels[phase] || `Phase ${phase}`;
  };

  const formatMessageContent = (content: string): string => {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  };

  const renderMessage = (msg: ChatMessage) => (
    <div
      key={msg.id}
      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {msg.role === 'assistant' && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className="bg-blue-500 text-white text-xs">
            HS
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-last' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant="outline"
            className={`text-xs ${getPhaseColor(msg.phase)}`}
          >
            {getPhaseLabel(msg.phase)}
          </Badge>
          {msg.confidence && (
            <span className="text-xs text-gray-500">
              {msg.confidence}% confidence
            </span>
          )}
        </div>

        <div
          className={`rounded-lg px-4 py-2 ${
            msg.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-900 border'
          }`}
        >
          <div
            dangerouslySetInnerHTML={{
              __html: formatMessageContent(msg.content),
            }}
          />

          {msg.citations && msg.citations.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-600">
                Citations:{' '}
                {msg.citations.map((citation: any, idx: number) => (
                  <span key={idx} className="mr-2">
                    Lines {citation.lineNumbers.join(', ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 mt-1">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {msg.role === 'user' && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarFallback className="bg-gray-500 text-white text-xs">
            U
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );

  // Show empty state if no messages
  const showEmptyState = messages.length === 0;

  return (
    <div
      className={`flex flex-col ${className}`}
      style={{ height: 'calc(100vh - 200px)' }}
    >
      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Messages area - FIXED HEIGHT WITH SCROLL */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full" ref={scrollAreaRef}>
          <div className="space-y-4 p-4">
            {showEmptyState ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500 space-y-2">
                  <h3 className="text-lg font-semibold">
                    Welcome to Health Sherpa AI
                  </h3>
                  <p className="text-sm">
                    I&apos;m powered by Gemini 1.5 Flash and ready to help you
                    understand your health information.
                  </p>
                  {activeDocument ? (
                    <p className="text-xs text-green-600">
                      Document loaded and ready for analysis
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600">
                      Upload a document to get personalized insights
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Phase {currentPhase}: {getPhaseLabel(currentPhase)}
                  </p>
                </div>
              </div>
            ) : (
              messages.map(renderMessage)
            )}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-blue-500 text-white text-xs">
                    HS
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-gray-600 text-sm">
                    Health Sherpa is thinking...
                  </span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input area - STICKY AT BOTTOM */}
      <div className="border-t bg-white p-4 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              placeholder={
                activeDocument
                  ? `Ask me about your health document... (Phase ${currentPhase}: ${getPhaseLabel(currentPhase)})`
                  : 'Upload a document first, then ask me anything about your health information...'
              }
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setInputValue(e.target.value)
              }
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="min-h-[40px] max-h-32 resize-none"
              rows={1}
            />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="sm"
            className="h-10 px-3"
            data-testid="send-button"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span className="text-blue-600">Powered by Gemini 1.5 Flash</span>
        </div>
      </div>
    </div>
  );
}
