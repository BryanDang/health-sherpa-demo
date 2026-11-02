'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ChevronDown, ChevronRight, RotateCcw, Download, AlertTriangle, Info, MapPin, DollarSign, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { conversationMemory } from '@/lib/conversation-memory';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'pricing';
  content: string;
  timestamp: Date;
  careLevel?: string;
  reasoning?: any;
  pricingData?: any;
}

interface CleanTriageChatProps {
  userId?: string;
  className?: string;
  onError?: (error: any) => void;
}

const SAMPLE_PROMPTS = [
  'I have chest pain and my left arm feels numb',
  'I have a mild sore throat since yesterday',
  'My zip code is 94110',
  'Compare prices for an urgent care visit',
  'Tengo dolor de cabeza desde ayer',
];

export default function CleanTriageChat({
  userId = 'anonymous',
  className = '',
  onError,
}: CleanTriageChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReasoning, setShowReasoning] = useState<{[key: string]: boolean}>({});
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [userZipCode, setUserZipCode] = useState('');
  const [showPricingPrompt, setShowPricingPrompt] = useState(false);
  const [insurancePlan, setInsurancePlan] = useState('');
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [showExportNotification, setShowExportNotification] = useState(false);
  const [hasShownImportHint, setHasShownImportHint] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<string[]>([]);
  const [hasOfferedVisitExpectations, setHasOfferedVisitExpectations] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState<Array<{timestamp: Date, message: string, type: 'info' | 'warn' | 'error'}>>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState<any>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Debug logging helper
  const logDebug = useCallback((message: string, type: 'info' | 'warn' | 'error' = 'info') => {
    if (debugMode) {
      setDebugLogs(prev => [...prev, { timestamp: new Date(), message, type }]);
    }
    // Still log to console
    console[type](message);
  }, [debugMode]);

  const formRef = useRef<HTMLFormElement>(null);
  const [autoSend, setAutoSend] = useState(false);
  useEffect(() => {
    if (autoSend && inputValue) {
      setAutoSend(false);
      formRef.current?.requestSubmit();
    }
  }, [autoSend, inputValue]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Initialize with welcome message and clean memory
  useEffect(() => {
    const initialize = async () => {
      // Initialize clean memory for this session
      try {
        await conversationMemory.initializeMemory(userId, sessionId);
        logDebug('Initialized conversation memory', 'info');
      } catch (error) {
        logDebug(`Failed to initialize conversation memory: ${error}`, 'warn');
      }

      const welcomeMessage: Message = {
        id: 'welcome',
        type: 'assistant',
        content: "Hi! I'm here to help with your health questions and guide you to the right care when you need it. What's on your mind today?",
        timestamp: new Date(),
      };
      
      const messages = [welcomeMessage];
      
      // Show import hint on first load
      if (!hasShownImportHint) {
        const importHintMessage: Message = {
          id: 'import-hint',
          type: 'assistant',
          content: 'Tip: If you have a previous conversation export, you can upload it using the upload button above to continue where you left off.',
          timestamp: new Date(),
        };
        messages.push(importHintMessage);
        setHasShownImportHint(true);
      }
      
      setMessages(messages);
    };

    initialize();
  }, [userId, sessionId]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // A zip code or a price question opens the price form without a triage call.
    const zipMatch = userMessage.content.match(/\b\d{5}\b/);
    const asksPrice = /\b(price|prices|cost|costs|compare|cheap|afford)\w*/i.test(userMessage.content);
    if (zipMatch || asksPrice) {
      if (zipMatch) setUserZipCode(zipMatch[0]);
      setShowPricingPrompt(true);
      setMessages(prev => [...prev, {
        id: `pricing-prompt-${Date.now()}`,
        type: 'assistant',
        content: zipMatch
          ? `Zip code ${zipMatch[0]} noted. Choose an insurance plan or cash, then press Compare Prices.`
          : 'Enter a five digit zip code below to compare sample prices nearby.',
        timestamp: new Date(),
      }]);
      setIsLoading(false);
      return;
    }

    // Check if user is responding to visit expectations offer
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.content?.includes('Would you like me to explain what to expect') && 
        (inputValue.toLowerCase().includes('yes') || inputValue.toLowerCase().includes('sure') || inputValue.toLowerCase().includes('please'))) {
      
      const visitInfoMessage: Message = {
        id: `visit-info-${Date.now()}`,
        type: 'assistant',
        content: getVisitExpectations(messages),
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, visitInfoMessage]);
      setIsLoading(false);
      return; // Don't send to API, we handled it locally
    }

    try {
      // Get memory context
      const memoryContext = await conversationMemory.getContextForAI(userId);

      const payload = {
        message: userMessage.content,
        recentExchanges: messages.slice(-5).map(msg => ({
          role: msg.type,
          content: msg.content,
          timestamp: msg.timestamp.toISOString()
        })),
        currentMemory: memoryContext,
        sessionId,
      };

      logDebug(`Sending triage request for: "${inputValue.trim()}"`, 'info');
      
      const fetchResponse = await fetch('/api/triage-stateful', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!fetchResponse.ok) {
        throw new Error(`HTTP error! status: ${fetchResponse.status}`);
      }

      const response = await fetchResponse.json();
      logDebug(`Received care level: ${response.care_level || 'none'}`, 'info');

      if (!response?.assistant_message && !response?.error) {
        throw new Error('No response received from triage service');
      }

      if (response?.error) {
        throw new Error(response.error);
      }

      // Record in memory
      await conversationMemory.recordMessage(userId, 'user', userMessage.content);
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

      setMessages(prev => [...prev, assistantMessage]);

      // Track unanswered questions from the AI's reasoning
      if (response.updated_reasoning?.unanswered_questions && response.updated_reasoning.unanswered_questions.length > 0) {
        setUnansweredQuestions(prev => [...prev, ...response.updated_reasoning.unanswered_questions]);
      }

      // Check if care level was determined and offer price comparison
      if (response.care_level && response.care_level !== 'self_care' && response.care_level !== null && !userZipCode) {
        const pricingPromptMessage: Message = {
          id: `pricing-prompt-${Date.now()}`,
          type: 'assistant',
          content: `Based on my assessment, you may benefit from ${response.care_level === 'emergency' ? 'emergency' : response.care_level === 'urgent' ? 'urgent' : 'primary'} care. Would you like to see pricing information for nearby facilities? I'll need your zip code to help find options in your area.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, pricingPromptMessage]);
        setShowPricingPrompt(true);
      }

      // Offer visit expectations after assessment completion
      // Check for a substantive conversation (at least 3 exchanges after welcome/import messages)
      const substantiveMessages = messages.filter(m => 
        m.id !== 'welcome' && 
        m.id !== 'import-hint' && 
        !m.id.startsWith('pricing')
      );
      const hasSubstantiveConversation = substantiveMessages.length >= 4; // At least 2 user + 2 assistant messages
      
      if (response.care_level && response.care_level !== 'self_care' && response.care_level !== null && !hasOfferedVisitExpectations && hasSubstantiveConversation) {
        const visitExpectationsMessage: Message = {
          id: `visit-expectations-${Date.now()}`,
          type: 'assistant',
          content: `Would you like me to explain what to expect during your ${response.care_level === 'emergency' ? 'emergency room' : response.care_level === 'urgent' ? 'urgent care' : 'doctor\'s'} visit? I can help you prepare so you know what questions to ask and what information to bring.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, visitExpectationsMessage]);
        setHasOfferedVisitExpectations(true);
      }

      // Show export notification after meaningful conversation (5+ messages)
      if (messages.length >= 4 && !showExportNotification) {
        setShowExportNotification(true);
      }

    } catch (error) {
      logDebug(`Triage error: ${error}`, 'error');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "I'm experiencing technical difficulties. For urgent medical concerns, please contact emergency services immediately or visit your nearest emergency department.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, userId, sessionId, onError]);

  const toggleReasoning = (messageId: string) => {
    setShowReasoning(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const getVisitExpectations = (messages: Message[]): string => {
    // Determine care level from messages
    const careLevel = messages.find(m => m.careLevel)?.careLevel || 'primary';
    
    const expectations: Record<string, string> = {
      emergency: `Here's what to expect at the emergency room:

**Before You Go:**
• Bring ID, insurance card (if you have one), and a list of current medications
• Note when symptoms started and what makes them better/worse
• Bring a phone charger - wait times can vary

**At the ER:**
• You'll check in at triage where a nurse will assess your vital signs
• Wait time depends on severity - life-threatening cases go first
• A doctor will examine you and may order tests (blood work, X-rays, etc.)
• Be honest about your symptoms and medical history

**Questions to Ask:**
• "What tests are you running and why?"
• "What are my treatment options?"
• "What should I watch for after I leave?"
• "When should I follow up, and with whom?"
• "Can I get a payment plan or financial assistance?"

**Cost Tips:**
• Ask about financial assistance programs before leaving
• Request an itemized bill
• Many hospitals offer payment plans or charity care for uninsured patients`,

      urgent: `Here's what to expect at urgent care:

**Before You Go:**
• Call ahead to confirm they treat your condition and ask about wait times
• Bring ID and any insurance information
• Make a list of your symptoms and current medications

**At Urgent Care:**
• Check-in process is usually quicker than the ER
• A nurse or medical assistant will take your vital signs
• The provider (doctor, NP, or PA) will examine you
• Basic tests like strep tests or X-rays may be done on-site

**Questions to Ask:**
• "What's causing my symptoms?"
• "What treatment do you recommend?"
• "Are there cheaper generic medication options?"
• "When should I see improvement?"
• "What symptoms would require emergency care?"
• "Do you offer a cash discount or payment plan?"

**Cost Savings:**
• Ask about cash prices upfront - often cheaper than insurance rates
• Generic medications can save 80% or more
• Some urgent cares offer membership plans for frequent visitors`,

      primary: `Here's what to expect at a primary care visit:

**Before You Go:**
• Write down all your symptoms and questions
• List all medications and supplements you take
• Note your family medical history
• Arrive 15 minutes early for paperwork

**During Your Visit:**
• A medical assistant will check vital signs and update your history
• The doctor will discuss your concerns - be specific about symptoms
• Physical exam based on your complaints
• Discussion of treatment options and next steps

**Questions to Ask:**
• "What's your assessment of my condition?"
• "What lifestyle changes might help?"
• "Are there generic medication alternatives?"
• "How long before I should see improvement?"
• "What preventive care do I need?"
• "Do you offer sliding scale fees or payment plans?"

**Building a Relationship:**
• Be honest about financial constraints - many doctors can help
• Ask about free medication samples
• Inquire about community health resources`
    };

    const baseInfo = expectations[careLevel] || expectations.primary;
    
    // Add personalized tips based on their symptoms
    const symptoms = messages.filter(m => m.type === 'user').map(m => m.content.toLowerCase()).join(' ');
    let additionalTips = '\n\n**Based on your symptoms:**\n';
    
    if (symptoms.includes('pain')) {
      additionalTips += '• Be specific about pain location, intensity (1-10), and what makes it better/worse\n';
    }
    if (symptoms.includes('fever') || symptoms.includes('cough')) {
      additionalTips += '• Mention how long you\'ve had symptoms and if anyone around you is sick\n';
    }
    if (symptoms.includes('prescription') || symptoms.includes('medication')) {
      additionalTips += '• Ask about patient assistance programs for medications\n';
    }
    
    return baseInfo + additionalTips;
  };

  const clearChat = async () => {
    // Clear local messages
    setMessages([{
      id: 'welcome',
      type: 'assistant',
      content: "Hi! I'm here to help with your health questions and guide you to the right care when you need it. What's on your mind today?",
      timestamp: new Date(),
    }]);

    // Clear conversation memory to prevent context contamination
    try {
      await conversationMemory.initializeMemory(userId, sessionId);
    } catch (error) {
      logDebug(`Failed to clear conversation memory: ${error}`, 'warn');
    }
  };

  const handlePriceComparison = async () => {
    if (!userZipCode || userZipCode.length !== 5) {
      return;
    }

    setLoadingPricing(true);
    setShowPricingPrompt(false);
    logDebug(`Starting price comparison for zip: ${userZipCode}, insurance: ${insurancePlan}`, 'info');

    try {
      // First geocode the zip code
      const geocodeResponse = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode: userZipCode }),
      });

      if (!geocodeResponse.ok) {
        throw new Error('Failed to geocode zip code');
      }

      const { latitude, longitude, formattedAddress } = await geocodeResponse.json();

      // Determine service type based on latest care level
      const latestCareLevel = messages
        .filter(m => m.careLevel)
        .pop()?.careLevel || 'primary';

      const serviceTypeMap: Record<string, string> = {
        emergency: 'emergency_visit',
        urgent: 'urgent_care_visit',
        primary: 'new_patient_visit',
      };

      // Extract symptoms from conversation
      const userSymptoms = messages
        .filter(m => m.type === 'user')
        .map(m => m.content)
        .join(' ');

      // Get pricing data with symptom context
      const pricingResponse = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          serviceType: serviceTypeMap[latestCareLevel] || 'urgent_care_visit',
          paymentType: insurancePlan ? 'insurance' : 'cash',
          insurancePlan: insurancePlan,
          symptoms: userSymptoms,
          careLevel: latestCareLevel,
        }),
      });

      if (!pricingResponse.ok) {
        throw new Error('Failed to fetch pricing data');
      }

      const pricingData = await pricingResponse.json();

      // Create pricing results message
      const pricingMessage: Message = {
        id: `pricing-${Date.now()}`,
        type: 'pricing',
        content: `Price comparison for ${formattedAddress}`,
        timestamp: new Date(),
        pricingData,
      };

      setMessages(prev => [...prev, pricingMessage]);

    } catch (error) {
      logDebug(`Pricing error: ${error}`, 'error');
      
      const errorMessage: Message = {
        id: `pricing-error-${Date.now()}`,
        type: 'assistant',
        content: "I couldn't fetch pricing information right now. You can still call facilities directly for their current rates.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoadingPricing(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      
      // Validate it's a valid export file
      if (!importedData.reportType || !importedData.reportType.includes('SBAR')) {
        throw new Error('Invalid file format');
      }

      // Show import success message
      const importMessage: Message = {
        id: `import-${Date.now()}`,
        type: 'assistant',
        content: `I've loaded your previous conversation from ${new Date(importedData.generatedAt).toLocaleDateString()}. Here's a summary of what we discussed:\n\n• Chief concern: ${importedData.situation?.chiefConcern || 'Health concern'}\n• Care level assessed: ${importedData.situation?.currentCareLevel || 'Unknown'}\n• Key findings: ${importedData.assessment?.keyFindings?.slice(0, 3).join(', ') || 'Previous assessment loaded'}\n\nYou can continue our conversation from where we left off. What would you like to discuss?`,
        timestamp: new Date(),
      };
      
      setMessages([importMessage]);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      logDebug(`Import error: ${error}`, 'error');
      const errorMessage: Message = {
        id: `import-error-${Date.now()}`,
        type: 'assistant',
        content: "I couldn't read that file. Please make sure it's a valid export file from a previous conversation.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const exportChat = () => {
    // Create provider-friendly SBAR format
    const assistantMessages = messages.filter(msg => msg.type === 'assistant' && msg.reasoning);
    const userMessages = messages.filter(msg => msg.type === 'user');
    const lastAssessment = assistantMessages[assistantMessages.length - 1];
    
    // Extract key medical information
    const allObservations = assistantMessages.flatMap(msg => msg.reasoning?.observations || []);
    const symptoms = allObservations.filter(obs => 
      obs.toLowerCase().includes('pain') || 
      obs.toLowerCase().includes('symptom') ||
      obs.toLowerCase().includes('reports')
    );
    
    const careLevel = lastAssessment?.careLevel || 'unknown';
    const highestCareLevel = messages.reduce((highest, msg) => {
      if (msg.careLevel === 'emergency') return 'emergency';
      if (msg.careLevel === 'urgent' && highest !== 'emergency') return 'urgent';
      if (msg.careLevel === 'primary' && !['emergency', 'urgent'].includes(highest)) return 'primary';
      return highest;
    }, 'self_care');

    const sbarReport = {
      // SBAR Header
      reportType: "AI Triage Assessment - SBAR Format",
      generatedAt: new Date().toISOString(),
      sessionId,
      
      // S - SITUATION
      situation: {
        chiefConcern: userMessages[0]?.content || "Health concern assessment",
        currentCareLevel: highestCareLevel,
        immediateActions: highestCareLevel === 'emergency' ? 
          ["Immediate medical evaluation required", "Consider emergency services if symptoms worsen"] : 
          ["In-person evaluation recommended", "Monitor symptoms closely"]
      },
      
      // B - BACKGROUND  
      background: {
        conversationSummary: `Patient engaged in ${messages.length} message AI triage assessment. Key symptoms and concerns were evaluated using clinical decision support.`,
        reportedSymptoms: symptoms.slice(0, 5), // Top 5 most relevant
        sessionLength: `${Math.round((new Date().getTime() - new Date(messages[0]?.timestamp).getTime()) / 60000)} minutes`
      },
      
      // A - ASSESSMENT
      assessment: {
        aiConfidence: lastAssessment?.reasoning?.confidence ? 
          `${Math.round(lastAssessment.reasoning.confidence * 100)}%` : "Not available",
        keyFindings: allObservations.slice(0, 8), // Most important observations
        riskLevel: highestCareLevel,
        medicalReasoning: lastAssessment?.reasoning?.plan || "Assessment in progress"
      },
      
      // R - RECOMMENDATIONS
      recommendations: {
        immediateActions: lastAssessment?.reasoning?.steps || ["Continue evaluation"],
        suggestedCareLevel: highestCareLevel,
        followUpQuestions: [
          "How long have symptoms been present?",
          "Any previous similar episodes?", 
          "Current medications or allergies?",
          "Any associated symptoms not yet discussed?"
        ],
        patientEducation: careLevel === 'emergency' ? 
          "Patient was advised to seek immediate medical attention" :
          "Patient was guided through symptom assessment and care recommendations"
      },
      
      // Clinical Handoff Notes
      clinicalNotes: {
        conversationContext: `AI triage session completed. Patient presented with health concerns and underwent systematic symptom evaluation. Highest acuity level reached: ${highestCareLevel}.`,
        reviewNeeded: "Provider should verify AI assessment and conduct physical examination as clinically indicated.",
        continuityOfCare: "This AI assessment is supplemental to clinical judgment and does not replace medical evaluation.",
        unansweredQuestions: unansweredQuestions.length > 0 ? {
          note: "The following patient questions were beyond the AI's scope and should be addressed by the provider:",
          questions: unansweredQuestions,
          context: "These may indicate specific concerns or information needs that require professional medical expertise."
        } : null
      },
      
      // Recent conversation for context (last 3 exchanges)
      recentExchanges: messages.slice(-6).map(msg => ({
        speaker: msg.type === 'user' ? 'Patient' : 'AI Assistant',
        message: msg.content,
        timestamp: msg.timestamp.toISOString(),
        careLevel: msg.careLevel
      })),
      
      // Metadata
      metadata: {
        totalInteractions: messages.length,
        aiModelsUsed: ["Gemini 2.0 Flash", "Stateful Medical LLM"],
        clinicalFrameworks: ["Smart Pain Assessment", "Emergency Detection Protocols"],
        disclaimers: [
          "This AI assessment is not a substitute for professional medical diagnosis",
          "In medical emergencies, call 911 immediately",
          "Clinical correlation and physical examination are required for diagnosis"
        ]
      }
    };
    
    // Store export data and show modal
    setExportData(sbarReport);
    setShowExportModal(true);
  };


  return (
    <div className={`flex flex-col h-full max-w-4xl mx-auto bg-white ${className}`}>
      {/* Export Notification Banner */}
      {showExportNotification && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-blue-800">
              You can export this conversation to share with your healthcare provider or save for later.
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              exportChat();
              setShowExportNotification(false);
            }}
            className="text-blue-600 hover:text-blue-700"
          >
            Export Now
          </Button>
        </div>
      )}

      {/* Clean Header */}
      <div className="border-b border-gray-100 p-4 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Health Chat</h1>
            <p className="text-sm text-gray-500">Get guidance on your health concerns</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              title="Upload previous conversation"
              aria-label="Upload previous conversation"
            >
              <Upload className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={clearChat} title="Clear chat"
              aria-label="Clear chat">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDebugMode(!debugMode)}
              title="Toggle debug mode"
              aria-label="Toggle debug mode"
              className={debugMode ? 'text-blue-600' : ''}
            >
              <Info className="w-4 h-4" />
            </Button>
            {messages.length > 1 && (
              <Button variant="ghost" size="sm" onClick={exportChat} title="Export conversation"
              aria-label="Export conversation">
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Clean Chat Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              {/* Pricing Results Card */}
              {message.type === 'pricing' && message.pricingData && (
                <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">{message.content}</h3>
                  </div>
                  
                  {message.pricingData.providers && message.pricingData.providers.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 mb-3">
                        Found {message.pricingData.totalFound} facilities within {Math.round(message.pricingData.searchRadius / 1000)}km
                      </p>
                      
                      {/* Potential procedures based on care level */}
                      {message.pricingData.potentialProcedures && (
                        <div className="bg-yellow-50 rounded-lg p-3 mb-4">
                          <p className="text-sm text-gray-700 font-medium mb-2">
                            Based on your symptoms, treatment may include:
                          </p>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {message.pricingData.potentialProcedures.map((proc: any, idx: number) => (
                              <li key={idx} className="flex justify-between">
                                <span>• {proc.name}</span>
                                <span className="text-gray-500">${proc.estimatedCost}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {message.pricingData.providers.slice(0, 5).map((provider: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-xl p-4 border border-gray-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{provider.providerName}</h4>
                              <p className="text-sm text-gray-500 mt-1">{provider.address}</p>
                              <p className="text-xs text-gray-400 mt-1">{provider.distance} miles away</p>
                            </div>
                            <div className="text-right">
                              <div className="mb-2">
                                <p className="text-lg font-semibold text-gray-900">
                                  ${provider.pricing.cashPrice || provider.pricing.lowestRate}
                                </p>
                                <p className="text-xs text-gray-500">Cash price</p>
                              </div>
                              {insurancePlan && insurancePlan !== 'cash' && provider.pricing.lowestRate && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700">
                                    ${provider.pricing.lowestRate}
                                  </p>
                                  <p className="text-xs text-gray-500">With insurance</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 mt-3">
                        Prices shown are for the initial visit only. Additional procedures, tests, or treatments will incur separate charges. Contact facilities directly for complete pricing information.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      No pricing data available for your area. Please contact facilities directly.
                    </p>
                  )}
                </div>
              )}

              {/* Regular Message Bubble */}
              {message.type !== 'pricing' && (
                <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${
                    message.type === 'user' 
                      ? 'bg-blue-500 text-white rounded-3xl px-5 py-4' 
                      : 'bg-gray-100 text-gray-900 rounded-3xl px-5 py-4'
                  } ${message.careLevel === 'emergency' ? 'ring-2 ring-red-200 bg-red-50 text-red-900' : ''}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  
                  {/* Subtle care level indicator - only for emergency */}
                  {message.careLevel === 'emergency' && (
                    <div className="mt-3 flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-medium">Immediate medical attention recommended</span>
                    </div>
                  )}

                  {/* Integrated AI Reasoning Toggle */}
                  {message.type === 'assistant' && message.reasoning && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => toggleReasoning(message.id)}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 w-full"
                      >
                        {showReasoning[message.id] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span>AI reasoning</span>
                        {message.reasoning.confidence && (
                          <span className="ml-auto text-xs text-gray-400">
                            {Math.round(message.reasoning.confidence * 100)}% confident
                          </span>
                        )}
                      </button>
                      
                      {showReasoning[message.id] && (
                        <div className="mt-3 space-y-3 text-xs text-gray-600">
                          {message.reasoning.plan && (
                            <div>
                              <span className="font-medium text-gray-700">Medical reasoning:</span>
                              <p className="mt-1 text-gray-600">{message.reasoning.plan}</p>
                            </div>
                          )}
                          {message.reasoning.observations?.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700">Key observations:</span>
                              <ul className="mt-1 space-y-1 text-gray-600">
                                {message.reasoning.observations.map((obs: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                                    <span>{obs}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {message.reasoning.steps?.length > 0 && (
                            <div>
                              <span className="font-medium text-gray-700">Next steps considered:</span>
                              <ul className="mt-1 space-y-1 text-gray-600">
                                {message.reasoning.steps.map((step: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          ))}

          {/* Pricing Prompt */}
          {showPricingPrompt && !loadingPricing && (
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Compare Healthcare Prices</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Zip Code
                  </label>
                  <Input
                    type="text"
                    placeholder="12345"
                    value={userZipCode}
                    onChange={(e) => setUserZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insurance Plan (optional)
                  </label>
                  <Select value={insurancePlan} onValueChange={setInsurancePlan}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select insurance or pay cash" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash/No Insurance</SelectItem>
                      <SelectItem value="aetna">Aetna</SelectItem>
                      <SelectItem value="bcbs">Blue Cross Blue Shield</SelectItem>
                      <SelectItem value="cigna">Cigna</SelectItem>
                      <SelectItem value="united">United Healthcare</SelectItem>
                      <SelectItem value="kaiser">Kaiser Permanente</SelectItem>
                      <SelectItem value="humana">Humana</SelectItem>
                      <SelectItem value="medicare">Medicare</SelectItem>
                      <SelectItem value="medicaid">Medicaid</SelectItem>
                      <SelectItem value="other">Other Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={handlePriceComparison}
                  disabled={!userZipCode || userZipCode.length !== 5}
                  className="w-full"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Compare Prices
                </Button>
              </div>
            </div>
          )}

          {/* Loading Pricing */}
          {loadingPricing && (
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Finding healthcare prices in your area...</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Clean Input Area */}
      <div className="border-t border-gray-100 p-4 bg-white">
        <div className="max-w-3xl mx-auto">
          {messages.length <= 2 && !isLoading && (
            <div className="flex flex-wrap gap-2 mb-3" aria-label="Sample prompts">
              {SAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setInputValue(prompt);
                    setAutoSend(true);
                  }}
                  className="text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 px-3 py-1 hover:bg-blue-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="flex gap-3">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tell me about your health concern..."
              className="flex-1 min-h-[50px] max-h-32 resize-none border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              disabled={isLoading}
            />
            <Button
              type="submit"
              aria-label="Send message"
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          
          <p className="text-xs text-gray-400 mt-2 text-center">
            This is not a substitute for professional medical advice. In emergencies, call 911.
          </p>
        </div>
      </div>
      
      {/* Debug Panel */}
      {debugMode && (
        <div className="fixed bottom-20 right-4 w-96 max-h-96 bg-gray-900 text-white rounded-lg shadow-lg p-4 overflow-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Debug Console</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDebugLogs([])}
              className="text-gray-400 hover:text-white"
            >
              Clear
            </Button>
          </div>
          <div className="space-y-1 text-xs font-mono">
            {debugLogs.length === 0 ? (
              <p className="text-gray-400">No debug logs yet...</p>
            ) : (
              debugLogs.map((log, idx) => (
                <div key={idx} className={`${
                  log.type === 'error' ? 'text-red-400' : 
                  log.type === 'warn' ? 'text-yellow-400' : 
                  'text-gray-300'
                }`}>
                  <span className="text-gray-500">{log.timestamp.toLocaleTimeString()}</span>
                  {' '}{log.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Export Modal */}
      {showExportModal && exportData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">Export Conversation</h2>
              <p className="text-gray-600">Review your conversation summary before sharing with your healthcare provider.</p>
            </div>
            
            {/* Chief Concern */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Chief Concern</h3>
              <p className="text-gray-700">{exportData.situation.chiefConcern}</p>
            </div>
            
            {/* Care Level */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Recommended Care Level</h3>
              <p className="text-gray-700 capitalize">{exportData.situation.currentCareLevel}</p>
            </div>
            
            {/* Key Findings */}
            {exportData.assessment.keyFindings.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Key Findings</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  {exportData.assessment.keyFindings.map((finding: string, idx: number) => (
                    <li key={idx}>{finding}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Unanswered Questions */}
            {unansweredQuestions.length > 0 && (
              <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  Questions for Your Provider
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  These questions came up during our conversation but need your healthcare provider's expertise:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  {unansweredQuestions.map((question, idx) => (
                    <li key={idx}>{question}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  // Download the file
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `medical-triage-sbar-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  
                  // Close modal and show success
                  setShowExportModal(false);
                  const exportNotification: Message = {
                    id: `export-notify-${Date.now()}`,
                    type: 'assistant',
                    content: 'Your conversation has been exported successfully! You can share this file with your healthcare provider.',
                    timestamp: new Date(),
                  };
                  setMessages(prev => [...prev, exportNotification]);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Export
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}