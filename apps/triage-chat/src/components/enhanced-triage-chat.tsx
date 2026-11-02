'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Loader2,
  Target,
  Brain,
  Settings,
  RefreshCw,
  Upload,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GoalSettingModal } from '@/components/ui/goal-setting-modal';
import { CheckpointModal } from '@/components/ui/checkpoint-modal';
import { callEdgeFunctionEnhanced } from '@/lib/supabase-enhanced';
import {
  conversationMemory,
  ConversationGoal,
  PersistentMemory,
  useConversationMemory,
  useGoalProgress,
} from '@/lib/conversation-memory';
import {
  SessionCheckpoint,
  CheckpointImportResult,
} from '@/lib/checkpoint-system';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  careLevel?: string;
  reasoning?: any;
  isStreaming?: boolean;
}

interface EnhancedTriageChatProps {
  userId?: string;
  className?: string;
  onError?: (error: any) => void;
}

export default function EnhancedTriageChat({
  userId = 'anonymous',
  className = '',
  onError,
}: EnhancedTriageChatProps) {
  // Core state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Checkpoint system state
  const [showCheckpointModal, setShowCheckpointModal] = useState(false);
  const [checkpointMode, setCheckpointMode] = useState<'import' | 'export'>(
    'import'
  );
  const [sessionStartTime] = useState(() => Date.now());
  const [accomplishments, setAccomplishments] = useState<string[]>([]);
  const [importedCheckpoint, setImportedCheckpoint] =
    useState<SessionCheckpoint | null>(null);
  const [showImportOption, setShowImportOption] = useState(true);

  // Memory integration
  const { memory, updateMemory } = useConversationMemory(userId);
  const { currentGoal, setGoalProgress } = useGoalProgress(userId);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Initialize memory and set welcome message
  useEffect(() => {
    const initializeSession = async () => {
      if (!memory) {
        // Initialize empty memory for new session
        await conversationMemory.initializeMemory(userId, sessionId);
        await updateMemory();
      }
    };

    initializeSession();
  }, [userId, sessionId, memory, updateMemory]);

  // Auto-scroll to bottom
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

  // Handle checkpoint import
  const handleCheckpointImport = useCallback(
    async (result: CheckpointImportResult) => {
      if (result.success && result.merged && result.newSessionData) {
        setImportedCheckpoint(result.merged);

        // Initialize memory with imported data
        await conversationMemory.initializeMemory(userId, sessionId);
        // Then update with imported context
        const newMemory = result.newSessionData;
        newMemory.sessionId = sessionId;
        await conversationMemory.saveMemory(newMemory);
        await updateMemory();

        // Add welcome back message
        const welcomeMessage: Message = {
          id: 'welcome-back',
          type: 'system',
          content: `Welcome back! I've restored your session from ${new Date(result.merged.exportedAt).toLocaleDateString()}. You've had ${result.merged.evolvingProfile.totalSessions} previous sessions, and last time you accomplished: ${result.merged.currentSession.accomplishments.join(', ')}. How can I help you today?`,
          timestamp: new Date(),
        };

        setMessages([welcomeMessage]);
        setShowImportOption(false);
        setShowGoalModal(false);
      }
    },
    [userId, sessionId, updateMemory]
  );

  // Handle goal setting
  const handleGoalSet = useCallback(
    async (goalDescription: string, context: any) => {
      const goal: ConversationGoal = {
        id: `goal_${Date.now()}`,
        description: goalDescription,
        type: context.goalType,
        isCompleted: false,
        progress: 0,
        subGoals: getSubGoalsForType(context.goalType),
        completedSubGoals: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Initialize memory with goal
      await conversationMemory.initializeMemory(userId, sessionId, goal);
      await updateMemory();

      // Add welcome message with goal
      const welcomeMessage: Message = {
        id: 'welcome',
        type: 'system',
        content: `Great! I'll help you ${goalDescription.toLowerCase()}. I'll remember this goal throughout our conversation and track our progress together. What would you like to start with?`,
        timestamp: new Date(),
      };

      setMessages([welcomeMessage]);
      setShowGoalModal(false);
      setShowImportOption(false);

      // Auto-focus on input
      setTimeout(() => {
        const textarea = document.querySelector(
          'textarea[placeholder*="Tell me"]'
        );
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.focus();
        }
      }, 100);
    },
    [userId, sessionId, updateMemory]
  );

  // Enhanced message submission with memory integration
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!inputValue.trim() || isLoading) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: inputValue.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);

      try {
        // Record message in memory
        await conversationMemory.recordMessage(
          userId,
          'user',
          userMessage.content
        );

        // Get conversation context from memory
        const memoryContext = await conversationMemory.getContextForAI(userId);

        // Prepare stateful API payload with memory context
        const payload = {
          message: userMessage.content,
          recentExchanges: messages.slice(-5).map(msg => ({
            role: msg.type,
            content: msg.content,
            timestamp: msg.timestamp.toISOString()
          })),
          currentMemory: memoryContext, // Pass conversation memory context to API
          sessionId,
        };

        // Use stateful triage API for natural empathy and complete reasoning
        const fetchResponse = await fetch('/api/triage-stateful', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!fetchResponse.ok) {
          throw new Error(`HTTP error! status: ${fetchResponse.status}`);
        }

        const response = await fetchResponse.json();

        if (!response?.assistant_message && !response?.error) {
          throw new Error('No response received from stateful triage service');
        }

        // Handle error responses
        if (response?.error) {
          throw new Error(response.error);
        }

        // Record assistant message in memory with care level and reasoning
        await conversationMemory.recordMessage(
          userId,
          'assistant',
          response.assistant_message,
          response.care_level,
          response.updated_reasoning
        );

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response.assistant_message,
          timestamp: new Date(),
          careLevel: response.care_level,
          reasoning: response.updated_reasoning,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Update goal progress if applicable
        if (currentGoal && !currentGoal.isCompleted) {
          const progressIncrease = calculateProgressIncrease(
            userMessage.content,
            response,
            currentGoal
          );
          if (progressIncrease > 0) {
            await setGoalProgress(
              Math.min(100, currentGoal.progress + progressIncrease),
              getCompletedSubGoal(userMessage.content, response, currentGoal)
            );

            // Track accomplishments for checkpoint
            const newAccomplishment = getAccomplishmentDescription(
              userMessage.content,
              response,
              currentGoal
            );
            if (newAccomplishment) {
              setAccomplishments((prev) => [...prev, newAccomplishment]);
            }
          }
        }

        await updateMemory();
      } catch (error) {
        console.error('Enhanced triage error:', error);

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'system',
          content:
            "I'm experiencing technical difficulties. For urgent medical concerns, please contact emergency services immediately or visit your nearest emergency department.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);

        if (onError) {
          onError(error);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      inputValue,
      isLoading,
      messages,
      userId,
      currentGoal,
      setGoalProgress,
      updateMemory,
      onError,
    ]
  );

  // Clear conversation and restart
  const handleClearConversation = useCallback(async () => {
    setMessages([]);
    await conversationMemory.initializeMemory(userId, sessionId);
    await updateMemory();
    setShowGoalModal(true);
  }, [userId, sessionId, updateMemory]);

  // Get current response for progressive disclosure
  const currentResponse =
    messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <div className={`flex flex-col h-full max-w-4xl mx-auto ${className}`}>
      {/* Import Checkpoint Option */}
      {showImportOption && (
        <Card className="m-4 p-4 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-green-900">
                Continue Previous Session?
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Import a checkpoint to pick up where you left off with your
                medical questions.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCheckpointMode('import');
                  setShowCheckpointModal(true);
                }}
                className="text-green-700 border-green-300"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowImportOption(false);
                  setShowGoalModal(true);
                }}
                className="text-green-600"
              >
                Start Fresh
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Goal Setting Modal */}
      <GoalSettingModal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        onGoalSet={handleGoalSet}
      />

      {/* Checkpoint Modal */}
      <CheckpointModal
        isOpen={showCheckpointModal}
        onClose={() => setShowCheckpointModal(false)}
        mode={checkpointMode}
        currentMemory={memory || undefined}
        sessionDuration={(Date.now() - sessionStartTime) / 1000 / 60}
        accomplishments={accomplishments}
        previousCheckpoint={importedCheckpoint || undefined}
        onImportComplete={handleCheckpointImport}
      />

      {/* Goal Progress Header */}
      {currentGoal && !showGoalModal && (
        <Card className="m-4 p-4 bg-blue-50 border-blue-200">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">Current Goal</span>
                <Badge variant="outline" className="text-xs">
                  {currentGoal.progress}% complete
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGoalModal(true)}
                className="text-blue-600"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-sm text-blue-800">{currentGoal.description}</p>

            <Progress value={currentGoal.progress} className="h-2" />

            {currentGoal.completedSubGoals.length > 0 && (
              <div className="text-xs text-blue-700">
                Completed: {currentGoal.completedSubGoals.join(', ')}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Memory Context Indicator */}
      {memory && memory.conversationSummary.establishedFacts.length > 0 && (
        <div className="mx-4 mb-2">
          <Badge variant="outline" className="text-xs">
            <Brain className="h-3 w-3 mr-1" />
            Remembering {memory.conversationSummary.establishedFacts.length} key
            facts
          </Badge>
        </div>
      )}

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div
                className={`flex ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <Card
                  className={`max-w-[80%] p-4 ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.type === 'system'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                    )}
                  </p>

                  {message.careLevel && (
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className={
                          message.careLevel === 'emergency'
                            ? 'bg-red-100 text-red-800'
                            : message.careLevel === 'urgent'
                              ? 'bg-orange-100 text-orange-800'
                              : message.careLevel === 'primary'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                        }
                      >
                        {message.careLevel.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  )}
                </Card>
              </div>

              {/* AI Reasoning Display for Assistant Messages */}
              {message.type === 'assistant' && message.reasoning && showThinking && (
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border-l-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-slate-700">AI Reasoning</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    {message.reasoning.plan && (
                      <div>
                        <span className="font-medium text-slate-600">Plan:</span>
                        <p className="text-slate-800 mt-1">{message.reasoning.plan}</p>
                      </div>
                    )}
                    {message.reasoning.observations && message.reasoning.observations.length > 0 && (
                      <div>
                        <span className="font-medium text-slate-600">Observations:</span>
                        <ul className="list-disc list-inside text-slate-800 mt-1">
                          {message.reasoning.observations.map((obs: string, idx: number) => (
                            <li key={idx}>{obs}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {message.reasoning.steps && message.reasoning.steps.length > 0 && (
                      <div>
                        <span className="font-medium text-slate-600">Next Steps:</span>
                        <ul className="list-disc list-inside text-slate-800 mt-1">
                          {message.reasoning.steps.map((step: string, idx: number) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {message.reasoning.confidence !== undefined && (
                      <div>
                        <span className="font-medium text-slate-600">Confidence:</span>
                        <span className="text-slate-800 ml-2">
                          {Math.round(message.reasoning.confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-4 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t">
        <div className="flex items-center space-x-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearConversation}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            New Conversation
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowThinking(!showThinking)}
            disabled={isLoading}
          >
            <Brain className="w-4 h-4 mr-1" />
            {showThinking ? 'Hide' : 'Show'} AI Reasoning
          </Button>
          {messages.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCheckpointMode('export');
                setShowCheckpointModal(true);
              }}
              disabled={isLoading}
              className="text-blue-600 border-blue-300"
            >
              <Download className="w-4 h-4 mr-1" />
              Export Session
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              currentGoal
                ? 'Tell me more about your situation...'
                : "Start by sharing what you'd like help with..."
            }
            className="flex-1 min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={isLoading || showGoalModal}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isLoading || showGoalModal}
            size="sm"
            className="self-end"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground mt-2">
          This is not a substitute for professional medical advice. In
          emergencies, call 911.
        </p>
      </div>
    </div>
  );
}

// Helper functions

function getSubGoalsForType(goalType: string): string[] {
  switch (goalType) {
    case 'understand_symptoms':
      return [
        'Describe symptoms',
        'Assess severity',
        'Understand causes',
        'Get care recommendations',
      ];
    case 'emergency_guidance':
      return [
        'Assess urgency',
        'Identify red flags',
        'Get immediate steps',
        'Find emergency care',
      ];
    case 'find_providers':
      return [
        'Determine care type needed',
        'Get provider recommendations',
        'Check availability',
        'Get contact information',
      ];
    case 'prepare_visit':
      return [
        'Organize symptoms',
        'Prepare questions',
        'Gather medical history',
        'Understand next steps',
      ];
    default:
      return ['Understand situation', 'Get recommendations', 'Take action'];
  }
}

function calculateProgressIncrease(
  userMessage: string,
  response: any,
  goal: ConversationGoal
): number {
  // Simple progress calculation based on keywords and response quality
  let increase = 0;

  // Base increase for any meaningful exchange
  increase += 10;

  // Additional increase based on goal type and content
  switch (goal.type) {
    case 'understand_symptoms':
      if (
        userMessage.toLowerCase().includes('pain') ||
        userMessage.toLowerCase().includes('hurt')
      ) {
        increase += 15;
      }
      if (response.careLevel) {
        increase += 20;
      }
      break;
    case 'emergency_guidance':
      if (
        response.careLevel === 'emergency' ||
        response.careLevel === 'urgent'
      ) {
        increase += 30;
      }
      break;
    case 'find_providers':
      if (
        response.response?.toLowerCase().includes('provider') ||
        response.response?.toLowerCase().includes('doctor')
      ) {
        increase += 25;
      }
      break;
  }

  return Math.min(25, increase); // Cap at 25% per interaction
}

function getCompletedSubGoal(
  userMessage: string,
  response: any,
  goal: ConversationGoal
): string | undefined {
  const remaining = goal.subGoals.filter(
    (sg) => !goal.completedSubGoals.includes(sg)
  );

  if (remaining.length > 0 && response.careLevel) {
    return remaining[0]; // Complete first remaining sub-goal
  }

  return undefined;
}

function getAccomplishmentDescription(
  userMessage: string,
  response: any,
  goal: ConversationGoal
): string | undefined {
  // Generate meaningful accomplishment descriptions
  if (response.careLevel === 'emergency') {
    return 'Identified emergency-level symptoms requiring immediate care';
  }

  if (response.careLevel === 'urgent') {
    return 'Assessed urgent symptoms and provided care recommendations';
  }

  if (
    response.response?.toLowerCase().includes('provider') ||
    response.response?.toLowerCase().includes('doctor')
  ) {
    return 'Received healthcare provider guidance';
  }

  if (userMessage.toLowerCase().includes('pain') && response.careLevel) {
    return `Analyzed pain symptoms and determined ${response.careLevel} care level`;
  }

  // Goal-specific accomplishments
  switch (goal.type) {
    case 'understand_symptoms':
      if (response.reasoning?.symptomsAnalyzed?.length > 0) {
        return `Analyzed symptoms: ${response.reasoning.symptomsAnalyzed.join(', ')}`;
      }
      break;
    case 'emergency_guidance':
      if (response.careLevel) {
        return `Received emergency assessment: ${response.careLevel} level care`;
      }
      break;
    case 'find_providers':
      return 'Received provider search guidance';
    case 'prepare_visit':
      return 'Organized information for medical visit';
  }

  return undefined;
}
