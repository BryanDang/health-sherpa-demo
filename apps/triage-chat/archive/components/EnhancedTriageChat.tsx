/**
 * Enhanced Triage Chat Component with MCP Integration
 * 
 * Extends the existing TriageChat component with MCP orchestration capabilities
 * while maintaining full backward compatibility and graceful degradation.
 * 
 * Features:
 * - Seamless integration with MCP orchestrator
 * - Provider search and mapping integration
 * - Pricing analysis and comparison
 * - Real-time location services
 * - Enhanced UI for multi-server responses
 * - Fallback to existing stateful system
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Loader2,
  MapPin,
  DollarSign,
  AlertTriangle,
  Heart,
  ChevronDown,
  ChevronUp,
  Brain,
  Zap,
  Globe,
  Shield,
  Navigation,
  Building,
  Clock,
  Star,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OPENING_MESSAGE } from '@/lib/triage-prompts';
import { useComponentStateStorage } from '@/hooks/useComponentStateStorage';
import type {
  TriageMessage,
  CareLevel,
  ProviderRecommendation,
} from '@/types/triage';

// Enhanced Types for MCP Integration
interface MCPTriageResponse {
  updated_reasoning: {
    plan: string;
    steps: string[];
    observations: string[];
    confidence: number;
  };
  assistant_message: string;
  updated_memory: any;
  emergency_detected: boolean;
  care_level: CareLevel;
  timestamp: string;
  mcp_enabled: boolean;
  mcp_insights?: {
    intent_detected: any;
    servers_consulted: string[];
    provider_recommendations?: ProviderRecommendation[];
    pricing_information?: any;
    enhanced_assessment?: any;
  };
  fallback_reason?: string;
}

interface LocationState {
  latitude?: number;
  longitude?: number;
  address?: string;
  isLoading: boolean;
  error?: string;
}

interface MCPPreferences {
  includeProviderSearch: boolean;
  includePricingAnalysis: boolean;
  preferredRadius: number;
  affordabilityFilter: 'free' | 'low_cost' | 'moderate' | 'any';
}

export function EnhancedTriageChat() {
  // Existing state from TriageChat
  const [messages, setMessages] = useState<TriageMessage[]>([
    {
      id: '1',
      content: OPENING_MESSAGE,
      isUser: false,
      timestamp: new Date(),
      careLevel: 'self_care',
    },
  ]);
  
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentExchanges, setRecentExchanges] = useState<any[]>([]);
  const [currentMemory, setCurrentMemory] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Enhanced state for MCP integration
  const [mcpEnabled, setMcpEnabled] = useState(true);
  const [location, setLocation] = useState<LocationState>({
    isLoading: false,
  });
  const [mcpPreferences, setMcpPreferences] = useState<MCPPreferences>({
    includeProviderSearch: true,
    includePricingAnalysis: true,
    preferredRadius: 10, // 10 km
    affordabilityFilter: 'moderate',
  });
  const [mcpStatus, setMcpStatus] = useState<any>(null);
  
  // Component state storage
  const {
    state: componentState,
    updateState: updateComponentState,
    clearState: clearComponentState,
  } = useComponentStateStorage('enhanced-triage-chat', {
    messages: [],
    currentMemory: null,
    location: null,
    mcpPreferences,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load component state on mount
  useEffect(() => {
    if (componentState.messages?.length > 1) {
      setMessages(componentState.messages);
    }
    if (componentState.currentMemory) {
      setCurrentMemory(componentState.currentMemory);
    }
    if (componentState.location) {
      setLocation(prev => ({ ...prev, ...componentState.location }));
    }
    if (componentState.mcpPreferences) {
      setMcpPreferences(componentState.mcpPreferences);
    }
  }, [componentState]);

  // Get user location
  const requestLocation = useCallback(async () => {
    setLocation(prev => ({ ...prev, isLoading: true, error: undefined }));
    
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        });
      });

      const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        isLoading: false,
      };

      // Try to get address from coordinates
      try {
        const response = await fetch(`/api/geocode?lat=${newLocation.latitude}&lng=${newLocation.longitude}`);
        if (response.ok) {
          const data = await response.json();
          newLocation.address = data.address;
        }
      } catch (geocodeError) {
        console.warn('Failed to get address from coordinates:', geocodeError);
      }

      setLocation(newLocation);
      updateComponentState({ location: newLocation });
    } catch (error) {
      console.error('Failed to get location:', error);
      setLocation(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get location',
      }));
    }
  }, [updateComponentState]);

  // Check MCP status
  const checkMcpStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/triage-mcp');
      if (response.ok) {
        const status = await response.json();
        setMcpStatus(status);
      }
    } catch (error) {
      console.error('Failed to check MCP status:', error);
    }
  }, []);

  // Check MCP status on mount
  useEffect(() => {
    checkMcpStatus();
  }, [checkMcpStatus]);

  // Enhanced send message function
  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage: TriageMessage = {
      id: Date.now().toString(),
      content: currentMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const requestBody = {
        message: currentMessage,
        recentExchanges,
        currentMemory,
        sessionId: `session_${Date.now()}`,
        location: location.latitude && location.longitude ? {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
        } : undefined,
        enableMCP: mcpEnabled,
        mcpPreferences,
      };

      const response = await fetch('/api/triage-mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: MCPTriageResponse = await response.json();

      const assistantMessage: TriageMessage = {
        id: (Date.now() + 1).toString(),
        content: data.assistant_message,
        isUser: false,
        timestamp: new Date(),
        careLevel: data.care_level,
        emergencyDetected: data.emergency_detected,
        mcpInsights: data.mcp_insights,
        reasoning: data.updated_reasoning,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentMemory(data.updated_memory);

      // Update component state
      updateComponentState({
        messages: [...messages, userMessage, assistantMessage],
        currentMemory: data.updated_memory,
      });

      // Update exchanges for next request
      setRecentExchanges(prev => [
        ...prev,
        { role: 'user', content: currentMessage },
        { role: 'assistant', content: data.assistant_message },
      ].slice(-10)); // Keep last 10 exchanges

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: TriageMessage = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but I encountered an error processing your message. Please try again or contact emergency services if this is urgent.',
        isUser: false,
        timestamp: new Date(),
        careLevel: 'urgent',
        error: true,
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Clear conversation
  const clearConversation = () => {
    setMessages([
      {
        id: '1',
        content: OPENING_MESSAGE,
        isUser: false,
        timestamp: new Date(),
        careLevel: 'self_care',
      },
    ]);
    setCurrentMemory(null);
    setRecentExchanges([]);
    clearComponentState();
  };

  // Render provider recommendations
  const renderProviderRecommendations = (providers: ProviderRecommendation[]) => {
    if (!providers?.length) return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Nearby Healthcare Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {providers.slice(0, 3).map((provider, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{provider.name}</h4>
                  {provider.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{provider.rating}</span>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-2">{provider.address}</p>
                
                <div className="flex flex-wrap gap-2 text-xs">
                  {provider.distance && (
                    <Badge variant="outline">
                      <Navigation className="h-3 w-3 mr-1" />
                      {provider.distance.toFixed(1)} km
                    </Badge>
                  )}
                  
                  {provider.openNow !== undefined && (
                    <Badge variant={provider.openNow ? "default" : "secondary"}>
                      <Clock className="h-3 w-3 mr-1" />
                      {provider.openNow ? 'Open' : 'Closed'}
                    </Badge>
                  )}
                  
                  {provider.phone && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${provider.phone}`}>
                        <Phone className="h-3 w-3 mr-1" />
                        Call
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render pricing information
  const renderPricingInformation = (pricingInfo: any) => {
    if (!pricingInfo?.data?.length) return null;

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">
            Pricing data from {pricingInfo.sources?.join(', ')} to help you make informed decisions.
          </p>
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Detailed Pricing
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header with MCP Status */}
      <div className="p-4 border-b bg-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Health Triage Assistant</h1>
            <p className="text-sm text-gray-600">Enhanced with AI-powered healthcare navigation</p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* MCP Status Indicator */}
            {mcpStatus && (
              <Badge variant={mcpStatus.overall_status === 'healthy' ? 'default' : 'secondary'}>
                <Zap className="h-3 w-3 mr-1" />
                {mcpStatus.mcp_enabled ? 'Enhanced' : 'Basic'} Mode
              </Badge>
            )}
            
            {/* Location Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={requestLocation}
              disabled={location.isLoading}
            >
              {location.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {location.latitude ? 'Location Set' : 'Get Location'}
            </Button>
            
            {/* Clear Conversation */}
            <Button variant="outline" size="sm" onClick={clearConversation}>
              Clear
            </Button>
          </div>
        </div>
        
        {/* Location Display */}
        {location.address && (
          <p className="text-xs text-gray-500 mt-2">
            <MapPin className="h-3 w-3 inline mr-1" />
            {location.address}
          </p>
        )}
        
        {location.error && (
          <Alert className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{location.error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-3xl ${message.isUser ? 'w-auto' : 'w-full'}`}>
                <Card className={`${
                  message.isUser 
                    ? 'bg-blue-50 border-blue-200 ml-8' 
                    : message.error
                    ? 'bg-red-50 border-red-200'
                    : message.emergencyDetected
                    ? 'bg-red-100 border-red-300'
                    : 'bg-white border-gray-200'
                }`}>
                  <CardContent className="p-4">
                    {/* Emergency Alert */}
                    {message.emergencyDetected && (
                      <Alert className="mb-4 border-red-300 bg-red-50">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800 font-medium">
                          Emergency condition detected. Please call 911 or go to the nearest emergency room immediately.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Main Message Content */}
                    <div className="prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ 
                        __html: message.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      }} />
                    </div>

                    {/* MCP Insights */}
                    {message.mcpInsights && (
                      <Tabs defaultValue="providers" className="mt-4">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="providers">Providers</TabsTrigger>
                          <TabsTrigger value="pricing">Pricing</TabsTrigger>
                          <TabsTrigger value="details">Details</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="providers">
                          {renderProviderRecommendations(message.mcpInsights.provider_recommendations || [])}
                        </TabsContent>
                        
                        <TabsContent value="pricing">
                          {renderPricingInformation(message.mcpInsights.pricing_information)}
                        </TabsContent>
                        
                        <TabsContent value="details">
                          <Card className="mt-4">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <Brain className="h-5 w-5" />
                                Analysis Details
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                <p><strong>Intent:</strong> {message.mcpInsights.intent_detected?.primary}</p>
                                <p><strong>Confidence:</strong> {(message.mcpInsights.intent_detected?.confidence * 100)?.toFixed(1)}%</p>
                                <p><strong>Systems Consulted:</strong> {message.mcpInsights.servers_consulted?.join(', ')}</p>
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>
                    )}

                    {/* Care Level Badge */}
                    {message.careLevel && (
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant={
                          message.careLevel === 'emergency' ? 'destructive' :
                          message.careLevel === 'urgent' ? 'default' :
                          'secondary'
                        }>
                          <Heart className="h-3 w-3 mr-1" />
                          {message.careLevel.replace('_', ' ').toUpperCase()}
                        </Badge>
                        
                        <span className="text-xs text-gray-500">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ))}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <Card className="bg-gray-50 border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-600">
                      {mcpEnabled ? 'Analyzing with enhanced systems...' : 'Processing your message...'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your symptoms or health concerns..."
            className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!currentMessage.trim() || isLoading}
            className="px-6"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* MCP Toggle */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>
            Enhanced with AI-powered provider search, pricing analysis, and location services
          </span>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mcpEnabled}
              onChange={(e) => setMcpEnabled(e.target.checked)}
              className="rounded"
            />
            Enhanced Mode
          </label>
        </div>
      </div>
    </div>
  );
}

export default EnhancedTriageChat;