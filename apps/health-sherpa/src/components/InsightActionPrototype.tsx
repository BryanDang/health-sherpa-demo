'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  MessageSquare,
  Target,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Download,
  Brain,
  Users,
  Lightbulb,
} from 'lucide-react';

// Types for the data structures.
interface InsightItem {
  id: string;
  title: string;
  description: string;
  category: 'clinical' | 'emotional' | 'practical';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'exploring' | 'completed';
  gatheringNotes?: string[];
  finalAction?: string;
}

interface UserContext {
  sherpaSession?: string;
  redactedDocument?: string;
  clinicalSummary?: string;
  aiOpinion?: string;
}

interface PageProps {
  onNext: () => void;
  onBack?: () => void;
  userContext: UserContext;
  setUserContext: (context: UserContext) => void;
  currentInsight?: InsightItem;
  setCurrentInsight: (insight: InsightItem) => void;
  insights: InsightItem[];
  setInsights: (insights: InsightItem[]) => void;
}

// Page 2: Summarization & Opinion Forming  
const SummarizationPage: React.FC<PageProps> = ({ 
  onNext, 
  onBack, 
  userContext, 
  setUserContext, 
  insights, 
  setInsights, 
  setCurrentInsight 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedInsightId, setSelectedInsightId] = useState<string>('');

  const generateSummaryAndInsights = useCallback(async () => {
    if (!userContext.sherpaSession || !userContext.redactedDocument) return;
    
    setIsGenerating(true);
    
    try {
      // Call AI API to generate clinical summary and insights
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are a friendly medical expert helping a patient understand their health information and turn concerns into actionable steps.

TASK: Analyze the provided health context and generate:
1. A comprehensive clinical summary (with key findings)
2. An empathetic opinion layer connecting findings to patient concerns  
3. A list of 4-6 discrete, actionable insight items

PATIENT CONTEXT:
${userContext.sherpaSession}

CLINICAL DATA:
${userContext.redactedDocument}

Please respond in this JSON format:
{
  "clinicalSummary": "Comprehensive summary of clinical findings with key data points...",
  "aiOpinion": "A doctor might say... A nurse might wonder... [empathetic interpretation connecting clinical data to patient concerns]",
  "insights": [
    {
      "id": "insight1",
      "title": "Clear, actionable insight title",
      "description": "Brief description of what this insight addresses",
      "category": "clinical|emotional|practical", 
      "priority": "high|medium|low"
    }
  ]
}

Focus on insights that:
- Address specific patient concerns mentioned in the session
- Are actionable (patient can do something about them)
- Are learnable (patient can understand them better)
- Connect clinical findings to real-world impact`,
          context: {
            currentPhase: 0,
            conversationHistory: [],
            isProviderMode: false,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to generate insights');
      
      const data = await response.json();
      
      // Try to parse JSON from AI response
      const jsonMatch = data.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Reply had no structured insights');
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Update context with AI-generated content
        setUserContext({
          ...userContext,
          clinicalSummary: parsed.clinicalSummary,
          aiOpinion: parsed.aiOpinion
        });
        
        // Format insights with proper structure
        const formattedInsights: InsightItem[] = parsed.insights.map((insight: any, index: number) => ({
          ...insight,
          id: insight.id || `insight-${index + 1}`,
          status: 'pending' as const,
          gatheringNotes: [],
          finalAction: undefined
        }));
        
        setInsights(formattedInsights);
      }
    } catch (error) {
      console.info('Using sample insights:', error instanceof Error ? error.message : error);
      // No structured reply (the mock backend never sends one). Use the built-in sample insights.
      setUserContext({
        ...userContext,
        clinicalSummary: "Based on your health records, there are several key findings that relate to your concerns about managing your condition effectively...",
        aiOpinion: "A doctor might say that your recent test results show good progress, but there are still opportunities for improvement. A nurse might wonder about how you're managing day-to-day symptoms and whether you're getting the support you need..."
      });
      
      const sampleInsights: InsightItem[] = [
        {
          id: 'insight-1',
          title: 'Understanding Your Lab Results',
          description: 'Key values and what they mean for your health',
          category: 'clinical',
          priority: 'high',
          status: 'pending',
          gatheringNotes: [],
        },
        {
          id: 'insight-2', 
          title: 'Managing Daily Symptoms',
          description: 'Practical strategies for symptom tracking and relief',
          category: 'practical',
          priority: 'high',
          status: 'pending',
          gatheringNotes: [],
        },
        {
          id: 'insight-3',
          title: 'Communication with Healthcare Team',
          description: 'How to prepare for appointments and ask the right questions',
          category: 'practical',
          priority: 'medium',
          status: 'pending',
          gatheringNotes: [],
        },
        {
          id: 'insight-4',
          title: 'Emotional Well-being & Support',
          description: 'Addressing anxiety and finding support resources',
          category: 'emotional',
          priority: 'medium',
          status: 'pending',
          gatheringNotes: [],
        }
      ];
      
      setInsights(sampleInsights);
    }
    
    setIsGenerating(false);
  }, [userContext, setUserContext, setInsights]);

  const handleSelectInsight = (insightId: string) => {
    const insight = insights.find(i => i.id === insightId);
    if (insight) {
      setCurrentInsight({ ...insight, status: 'exploring' });
      setSelectedInsightId(insightId);
    }
  };

  const handleContinueWithInsight = () => {
    if (selectedInsightId) {
      // Update insights list to mark selected one as exploring
      setInsights(insights.map(i => 
        i.id === selectedInsightId 
          ? { ...i, status: 'exploring' } 
          : i
      ));
      onNext();
    }
  };

  // Auto-generate on mount when context exists and no summary.
  React.useEffect(() => {
    if (userContext.sherpaSession && userContext.redactedDocument && !userContext.clinicalSummary && !isGenerating) {
      generateSummaryAndInsights();
    }
  }, [userContext, generateSummaryAndInsights, isGenerating]);

  if (isGenerating) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <Brain className="h-16 w-16 text-blue-600 mx-auto animate-pulse" />
          <h1 className="text-3xl font-bold">Analyzing Your Health Context</h1>
          <p className="text-gray-600">
            AI is reviewing your information and generating personalized insights...
          </p>
        </div>
        
        <Card>
          <CardContent className="p-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <span>Processing your Sherpa session context...</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <span>Analyzing clinical data...</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                <span>Generating actionable insights...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Brain className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Your Health Summary & Insights</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          AI has analyzed your context and identified key insights. Select one to explore in depth.
        </p>
      </div>

      {/* Clinical Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-green-600" />
            <span>Clinical Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed">
            {userContext.clinicalSummary}
          </p>
        </CardContent>
      </Card>

      {/* AI Opinion Layer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <span>Professional Perspective</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed italic">
            {userContext.aiOpinion}
          </p>
        </CardContent>
      </Card>

      {/* Insight Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <span>Actionable Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Choose one insight to explore in depth. You&apos;ll work through each one systematically.
          </p>
          
          <div className="grid gap-3">
            {insights.map((insight) => {
              const isSelected = selectedInsightId === insight.id;
              const categoryColors = {
                clinical: 'border-l-blue-500 bg-blue-50',
                practical: 'border-l-green-500 bg-green-50', 
                emotional: 'border-l-purple-500 bg-purple-50'
              };
              
              return (
                <div 
                  key={insight.id}
                  className={`
                    border-l-4 p-4 rounded-r-lg cursor-pointer transition-all
                    ${categoryColors[insight.category]}
                    ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-sm'}
                    ${insight.status === 'completed' ? 'opacity-60' : ''}
                  `}
                  onClick={() => insight.status !== 'completed' && handleSelectInsight(insight.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium">{insight.title}</h3>
                        <Badge variant={insight.priority === 'high' ? 'destructive' : 'secondary'}>
                          {insight.priority}
                        </Badge>
                        {insight.status === 'completed' && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{insight.description}</p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {insight.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="outline" className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Intake</span>
        </Button>
        
        <Button 
          onClick={handleContinueWithInsight}
          disabled={!selectedInsightId}
          className="flex items-center space-x-2"
        >
          <span>Explore Selected Insight</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Page 1: Intake Portal
const IntakePortal: React.FC<PageProps> = ({ onNext, userContext, setUserContext }) => {
  const [sherpaFile, setSherpaFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = useCallback(async (file: File, type: 'sherpa' | 'document') => {
    const text = await file.text();
    if (type === 'sherpa') {
      setSherpaFile(file);
      setUserContext({ ...userContext, sherpaSession: text });
    } else {
      setDocumentFile(file);
      setUserContext({ ...userContext, redactedDocument: text });
    }
  }, [userContext, setUserContext]);

  const canProceed = sherpaFile && documentFile && userContext.sherpaSession && userContext.redactedDocument;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Upload className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Health Context Intake</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Upload your Sherpa session and health document to begin your personalized insight-to-action journey.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sherpa Session Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <span>Sherpa Session</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              Your questions, concerns, goals, and personal context from your Health Sherpa session.
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".txt"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'sherpa')}
                className="hidden"
                id="sherpa-upload"
              />
              <label htmlFor="sherpa-upload" className="cursor-pointer">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <div className="font-medium">
                  {sherpaFile ? sherpaFile.name : 'Click to upload sherpa-session.txt'}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Contains your personal health concerns and goals
                </div>
              </label>
            </div>
            
            {sherpaFile && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Session context loaded</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Health Document Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-green-600" />
              <span>Health Document</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600">
              Your de-identified clinical data, lab results, or health records.
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".txt"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'document')}
                className="hidden"
                id="document-upload"
              />
              <label htmlFor="document-upload" className="cursor-pointer">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <div className="font-medium">
                  {documentFile ? documentFile.name : 'Click to upload redacted-document.txt'}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  De-identified clinical or health data
                </div>
              </label>
            </div>
            
            {documentFile && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Health data loaded</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status and Action */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-medium">
                Ready to Generate Insights?
              </div>
              <div className="text-sm text-gray-600">
                {canProceed 
                  ? "Both files uploaded successfully. Ready to analyze your health context."
                  : "Please upload both your Sherpa session and health document to continue."
                }
              </div>
            </div>
            
            <Button 
              onClick={onNext} 
              disabled={!canProceed || isProcessing}
              className="flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <Brain className="h-4 w-4 animate-pulse" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Generate Insights</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Page 3: Gathering (Explore & Understand)
const GatheringPage: React.FC<PageProps> = ({ 
  onNext, 
  onBack, 
  userContext, 
  currentInsight, 
  setCurrentInsight, 
  insights, 
  setInsights 
}) => {
  const [messages, setMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string}>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingInsights, setPendingInsights] = useState<string[]>([]);

  // Initialize conversation
  React.useEffect(() => {
    if (currentInsight && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant', 
        content: `Let's explore "${currentInsight.title}" together. ${currentInsight.description}

I'm here to help you understand this insight fully before we move to action. Feel free to ask questions, share concerns, or tell me more about your experience with this topic.

What would you like to know or discuss first?`
      }]);
    }
  }, [currentInsight, messages.length]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !currentInsight) return;
    
    const userMessage = { 
      id: `msg-${Date.now()}`, 
      role: 'user' as const, 
      content: inputMessage.trim() 
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const conversationHistory = [...messages, userMessage]
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are a friendly, empathetic medical expert helping a patient explore a health insight in depth. 

CURRENT INSIGHT: ${currentInsight.title} - ${currentInsight.description}

PATIENT CONTEXT: ${userContext.sherpaSession}
CLINICAL DATA: ${userContext.redactedDocument}
CLINICAL SUMMARY: ${userContext.clinicalSummary}

CONVERSATION SO FAR:
${conversationHistory}

Your goals:
1. Help the patient understand the insight thoroughly
2. Answer questions clearly and empathetically  
3. Prompt for missing personal context when relevant
4. Identify knowledge gaps that need addressing
5. If they raise tangential topics, acknowledge but note they can be addressed later

Style: Conversational, supportive, non-advisory. Use phrases like "A doctor might suggest..." or "Many patients find..."

IMPORTANT: If the user raises topics unrelated to the current insight, respond like: "That's a great question about [topic]. Let me make a note that we should explore that as a separate insight after we finish with [current insight]. For now, let's focus on..."

Respond as the helpful medical expert.`,
          context: {
            currentPhase: 0,
            conversationHistory: [],
            isProviderMode: false,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');
      
      const data = await response.json();
      
      // Check if response mentions tangential topics
      const hasTangentialTopic = data.content.includes('make a note') || 
                                data.content.includes('separate insight') ||
                                data.content.includes('explore that later');
      
      if (hasTangentialTopic) {
        // Extract potential new insight from user message for pending list
        setPendingInsights(prev => [...prev, inputMessage.trim()]);
      }
      
      const assistantMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant' as const,
        content: data.content
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update gathering notes for current insight
      if (currentInsight) {
        const updatedInsight = {
          ...currentInsight,
          gatheringNotes: [
            ...(currentInsight.gatheringNotes || []),
            `Q: ${inputMessage.trim()}`,
            `A: ${data.content.substring(0, 100)}...`
          ]
        };
        setCurrentInsight(updatedInsight);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant' as const,
        content: "I'm sorry, I'm having trouble responding right now. Could you try rephrasing your question?"
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    
    setIsLoading(false);
  }, [inputMessage, currentInsight, messages, userContext, setCurrentInsight]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReadyForAction = () => {
    // Mark current insight as ready for action
    if (currentInsight) {
      const updatedInsight = { ...currentInsight, status: 'pending' as const };
      setCurrentInsight(updatedInsight);
      
      // Add any pending insights back to the main list
      if (pendingInsights.length > 0) {
        const newInsights = pendingInsights.map((topic, index) => ({
          id: `pending-${Date.now()}-${index}`,
          title: topic.substring(0, 50) + (topic.length > 50 ? '...' : ''),
          description: 'Tangential topic to explore',
          category: 'practical' as const,
          priority: 'low' as const,
          status: 'pending' as const,
          gatheringNotes: []
        }));
        
        setInsights([...insights, ...newInsights]);
      }
    }
    
    onNext();
  };

  if (!currentInsight) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Insight Selected</h2>
          <p className="text-gray-600 mb-4">Please go back and select an insight to explore.</p>
          <Button onClick={onBack}>Back to Insights</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <MessageSquare className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Exploring: {currentInsight.title}</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Let&apos;s dive deep into this insight. Ask questions, share your experience, and gather the information you need.
        </p>
      </div>

      {/* Insight Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Lightbulb className="h-5 w-5 text-amber-600 mt-1" />
            <div>
              <h3 className="font-medium">{currentInsight.title}</h3>
              <p className="text-sm text-gray-600">{currentInsight.description}</p>
              <Badge variant="outline" className="mt-2">
                {currentInsight.category} • {currentInsight.priority} priority
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Conversation</span>
            {pendingInsights.length > 0 && (
              <Badge variant="secondary">
                {pendingInsights.length} topics noted for later
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Messages */}
          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`
                  max-w-[80%] p-3 rounded-lg
                  ${message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-900'
                  }
                `}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex space-x-2">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question or share your thoughts..."
              className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={isLoading}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="self-end"
            >
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="outline" className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Insights</span>
        </Button>
        
        <div className="space-x-2">
          <Button 
            onClick={handleReadyForAction}
            className="flex items-center space-x-2"
          >
            <span>Ready for Action</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Page 4: Action  
const ActionPage: React.FC<PageProps> = ({ 
  onBack, 
  userContext, 
  currentInsight, 
  setCurrentInsight, 
  insights, 
  setInsights 
}) => {
  const [proposedAction, setProposedAction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalAction, setFinalAction] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [actionStatus, setActionStatus] = useState<'generating' | 'reviewing' | 'modifying' | 'confirmed'>('generating');

  // Generate initial action proposal
  const generateActionProposal = useCallback(async () => {
    if (!currentInsight) return;
    
    setIsGenerating(true);
    setActionStatus('generating');

    try {
      const gatheringNotes = currentInsight.gatheringNotes?.join('\n') || '';
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are a helpful medical expert helping a patient convert their insight exploration into a concrete, actionable step.

INSIGHT: ${currentInsight.title} - ${currentInsight.description}

PATIENT CONTEXT: ${userContext.sherpaSession}
CLINICAL SUMMARY: ${userContext.clinicalSummary}
GATHERING CONVERSATION NOTES: ${gatheringNotes}

Based on all this context, propose ONE specific, actionable step the patient can take related to this insight. The action should be:
- Concrete and specific
- Something they can actually do
- Relevant to their personal situation
- Helpful for their health journey

Format your response as:
ACTION: [One clear, specific action they can take]

RATIONALE: [Brief explanation of why this action makes sense based on their situation and the conversation]

Example format:
ACTION: Schedule a 15-minute conversation with your primary care doctor about your recent lab results, specifically asking about your cholesterol levels and what the trend means for your heart health.

RATIONALE: Based on your concerns about understanding your numbers and our discussion about feeling uncertain when reviewing lab results, having a focused conversation with your doctor will give you the clarity you need to feel more confident about your health status.`,
          context: {
            currentPhase: 0,
            conversationHistory: [],
            isProviderMode: false,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to generate action');
      
      const data = await response.json();
      setProposedAction(data.content);
      setActionStatus('reviewing');
      
    } catch (error) {
      console.error('Error generating action:', error);
      // Fallback proposal
      setProposedAction(`ACTION: Based on our discussion about "${currentInsight.title}", consider taking one specific step this week to address your concerns.

RATIONALE: This action builds on the insights you've gained and moves you toward your health goals.`);
      setActionStatus('reviewing');
    }
    
    setIsGenerating(false);
  }, [currentInsight, userContext]);

  // Auto-generate on mount
  React.useEffect(() => {
    if (currentInsight && !proposedAction && actionStatus === 'generating') {
      generateActionProposal();
    }
  }, [currentInsight, proposedAction, actionStatus, generateActionProposal]);

  const handleModifyAction = () => {
    setActionStatus('modifying');
    setIsModifying(true);
  };

  const handleConfirmAction = () => {
    const confirmedAction = finalAction || proposedAction;
    
    if (currentInsight) {
      // Update the insight with final action
      const updatedInsight = {
        ...currentInsight,
        finalAction: confirmedAction,
        status: 'completed' as const
      };
      
      setCurrentInsight(updatedInsight);
      
      // Update insights list
      setInsights(insights.map(i => 
        i.id === currentInsight.id ? updatedInsight : i
      ));
    }
    
    setActionStatus('confirmed');
    
    // Check if there are more pending insights
    const pendingInsights = insights.filter(i => i.status === 'pending');
    if (pendingInsights.length > 1) { // More than current one
      // Go back to page 2 to select next insight
      if (currentInsight) {
        setCurrentInsight(currentInsight);
      }
      onBack?.(); 
      onBack?.(); // Go back twice to reach page 2
    } else {
      // All insights completed - could go to summary/export page
      // For now, stay on this page
    }
  };

  const handleReturnToGathering = () => {
    onBack?.();
  };

  if (!currentInsight) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Insight Selected</h2>
          <Button onClick={onBack}>Back to Insights</Button>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <Target className="h-16 w-16 text-green-600 mx-auto animate-pulse" />
          <h1 className="text-3xl font-bold">Creating Your Action Plan</h1>
          <p className="text-gray-600">
            Analyzing your conversation and generating a personalized action step...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Target className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold">Your Action Step</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Based on your exploration of &ldquo;{currentInsight.title}&rdquo;, here&apos;s a concrete action you can take.
        </p>
      </div>

      {/* Insight Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Lightbulb className="h-5 w-5 text-amber-600 mt-1" />
            <div>
              <h3 className="font-medium">{currentInsight.title}</h3>
              <p className="text-sm text-gray-600">{currentInsight.description}</p>
              {currentInsight.gatheringNotes && currentInsight.gatheringNotes.length > 0 && (
                <Badge variant="outline" className="mt-2">
                  {Math.floor(currentInsight.gatheringNotes.length / 2)} discussion points covered
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposed Action */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-green-600" />
            <span>Proposed Action</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="whitespace-pre-wrap text-gray-900">
              {actionStatus === 'modifying' ? (
                <textarea
                  value={finalAction}
                  onChange={(e) => setFinalAction(e.target.value)}
                  className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Modify the action to better fit your needs..."
                />
              ) : (
                <div>{proposedAction}</div>
              )}
            </div>
          </div>

          {actionStatus === 'reviewing' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Does this action feel right for you? You can accept it as-is, modify it, or go back to gather more information.
              </p>
              
              <div className="flex space-x-3">
                <Button 
                  onClick={handleConfirmAction}
                  className="flex items-center space-x-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Accept This Action</span>
                </Button>
                
                <Button 
                  onClick={handleModifyAction}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <span>Modify Action</span>
                </Button>
                
                <Button 
                  onClick={handleReturnToGathering}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>More Discussion</span>
                </Button>
              </div>
            </div>
          )}

          {actionStatus === 'modifying' && (
            <div className="flex space-x-3">
              <Button 
                onClick={() => {
                  setActionStatus('confirmed');
                  handleConfirmAction();
                }}
                className="flex items-center space-x-2"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Confirm Modified Action</span>
              </Button>
              
              <Button 
                onClick={() => {
                  setActionStatus('reviewing');
                  setIsModifying(false);
                  setFinalAction('');
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          )}

          {actionStatus === 'confirmed' && (
            <div className="bg-green-100 border border-green-300 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Action Confirmed!</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                Great! You&apos;ve created a concrete action step from this insight. 
                {insights.filter(i => i.status === 'pending').length > 1 ? 
                  " Let&apos;s move on to your next insight." : 
                  " You&apos;ve completed all your insights!"
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="outline" className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Discussion</span>
        </Button>
        
        {actionStatus === 'confirmed' && (
          <div className="space-x-2">
            {insights.filter(i => i.status === 'pending').length > 1 ? (
              <Button 
                onClick={() => {
                  // Find next pending insight
                  const nextInsight = insights.find(i => i.status === 'pending' && i.id !== currentInsight?.id);
                  if (nextInsight) {
                    setCurrentInsight(nextInsight);
                  }
                  onBack?.(); 
                  onBack?.();
                }}
                className="flex items-center space-x-2"
              >
                <span>Next Insight</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                className="flex items-center space-x-2"
                onClick={() => {/* Could implement export/summary page */}}
              >
                <Download className="h-4 w-4" />
                <span>View Summary</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Progress Tracker Component
const ProgressTracker: React.FC<{
  currentPage: number;
  completedInsights: number;
  totalInsights: number;
  currentInsightTitle?: string;
}> = ({ currentPage, completedInsights, totalInsights, currentInsightTitle }) => {
  const pages = [
    { label: 'Intake', icon: Upload },
    { label: 'Summary', icon: Brain },
    { label: 'Gathering', icon: MessageSquare },
    { label: 'Action', icon: Target },
  ];

  const progressPercentage = currentPage === 1 ? 
    (currentPage / 4) * 100 : 
    ((currentPage - 1) / 4 + (completedInsights / totalInsights) / 4) * 100;

  return (
    <div className="bg-white border-b shadow-sm p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Insight-to-Action Navigator</h2>
          <Badge variant="outline">
            {completedInsights}/{totalInsights} insights completed
          </Badge>
        </div>
        
        <div className="space-y-3">
          <Progress value={progressPercentage} className="h-2" />
          
          <div className="flex items-center justify-between">
            {pages.map((page, index) => {
              const Icon = page.icon;
              const isActive = currentPage === index + 1;
              const isCompleted = currentPage > index + 1;
              
              return (
                <div key={page.label} className="flex items-center space-x-2">
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2
                    ${isActive 
                      ? 'border-blue-600 bg-blue-600 text-white' 
                      : isCompleted 
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 text-gray-400'
                    }
                  `}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`text-sm font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {page.label}
                  </span>
                </div>
              );
            })}
          </div>
          
          {currentInsightTitle && (
            <div className="text-center">
              <span className="text-sm text-gray-600">
                Currently exploring: <span className="font-medium">{currentInsightTitle}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Component
export default function InsightActionPrototype() {
  const [currentPage, setCurrentPage] = useState(1);
  const [userContext, setUserContext] = useState<UserContext>({});
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [currentInsight, setCurrentInsight] = useState<InsightItem | undefined>();

  const completedInsights = insights.filter(i => i.status === 'completed').length;

  const handleNext = () => {
    setCurrentPage(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  return (
    <div className="min-h-full bg-gray-50">
      <ProgressTracker 
        currentPage={currentPage}
        completedInsights={completedInsights}
        totalInsights={insights.length}
        currentInsightTitle={currentInsight?.title}
      />
      
      <main className="py-8">
        {currentPage === 1 && (
          <IntakePortal
            onNext={handleNext}
            userContext={userContext}
            setUserContext={setUserContext}
            currentInsight={currentInsight}
            setCurrentInsight={setCurrentInsight}
            insights={insights}
            setInsights={setInsights}
          />
        )}
        
        {currentPage === 2 && (
          <SummarizationPage
            onNext={handleNext}
            onBack={handleBack}
            userContext={userContext}
            setUserContext={setUserContext}
            currentInsight={currentInsight}
            setCurrentInsight={setCurrentInsight}
            insights={insights}
            setInsights={setInsights}
          />
        )}
        
        {currentPage === 3 && (
          <GatheringPage
            onNext={handleNext}
            onBack={handleBack}
            userContext={userContext}
            setUserContext={setUserContext}
            currentInsight={currentInsight}
            setCurrentInsight={setCurrentInsight}
            insights={insights}
            setInsights={setInsights}
          />
        )}
        
        {currentPage === 4 && (
          <ActionPage
            onNext={handleNext}
            onBack={handleBack}
            userContext={userContext}
            setUserContext={setUserContext}
            currentInsight={currentInsight}
            setCurrentInsight={setCurrentInsight}
            insights={insights}
            setInsights={setInsights}
          />
        )}
      </main>
    </div>
  );
}