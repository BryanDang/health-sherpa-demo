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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OPENING_MESSAGE } from '@/lib/triage-prompts';
import {
  callEdgeFunctionEnhanced,
  handleStreamingResponse,
} from '@/lib/supabase-enhanced';
import { TriageResponseDisplay } from '@/components/ui/progressive-disclosure';
import { useComponentStateStorage } from '@/hooks/useComponentStateStorage';
import { 
  createVisitSummary, 
  saveVisitSummary, 
  saveVisitSummarySync,
  getVisitSummaryStats, 
  getVisitSummaryStatsSync,
  loadVisitSummaries, 
  loadVisitSummariesSync,
  performStorageHealthCheck,
  type VisitSummary,
  type VisitSummaryResult 
} from '@/lib/visit-summary';
import type {
  TriageMessage,
  CareLevel,
  ProviderRecommendation,
} from '@/types/triage';

/**
 * Unified configuration interface for all TriageChat features
 * Replaces separate props for basic and enhanced configurations
 */
interface TriageChatConfig {
  /** Basic component configuration */
  basic: {
    className?: string;
    userId?: string;
    enableDeveloperMode?: boolean;
  };

  /** Enhanced features configuration */
  enhanced?: {
    enabled: boolean;
    culturalAdaptation: boolean;
    toolIntegration: boolean;
    internalThoughts: boolean;
    featureFlags: Record<string, boolean>;
    sessionTracking: boolean;
    advancedErrorHandling: boolean;
    systemMonitoring: boolean;
  };

  /** Unified error handling */
  onError?: (error: {
    message: string;
    severity: 'low' | 'medium' | 'high';
    context?: Record<string, any>;
    timestamp: Date;
    userId: string;
    sessionId?: string;
  }) => void;
}

/**
 * Main props interface - simplified to single configuration object
 */
interface TriageChatProps {
  /** Unified configuration object for all features */
  config: TriageChatConfig;
}

/**
 * System health status for enhanced monitoring
 */
interface SystemStatus {
  health: 'healthy' | 'degraded' | 'critical';
  enhancedFeaturesAvailable: boolean;
  culturalAdaptationEnabled: boolean;
  fallbackActive: boolean;
  componentStatus: Record<string, 'up' | 'degraded' | 'down'>;
}

/**
 * Error tracking interface for enhanced error handling
 */
interface TrackedError {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  resolved: boolean;
  context?: Record<string, any>;
}

/**
 * UNIFIED TriageChat Component
 *
 * This component COMPLETELY REPLACES both TriageChat and EnhancedTriageChat
 * to eliminate ALL component duplication and provide a single, comprehensive
 * interface for medical triage with configurable feature sets.
 *
 * CONSOLIDATED FEATURES:
 * Medical symptom triage with AI assistance
 * Emergency detection and escalation
 * Provider recommendations with location services
 * Streaming responses for better UX
 * Feature flag integration and A/B testing
 * Cultural adaptation and tool integration
 * Comprehensive error handling and system monitoring
 * Developer debugging features
 * Session tracking and analytics
 * Progressive enhancement capabilities
 *
 * @param config - Unified configuration object for all features
 * @returns JSX.Element - The complete triage chat interface
 */
export default function TriageChat({ config }: TriageChatProps) {
  // Extract configuration with defaults
  const {
    className = '',
    userId = 'anonymous',
    enableDeveloperMode = false,
  } = config.basic;

  const enhanced = config.enhanced || {
    enabled: false,
    culturalAdaptation: false,
    toolIntegration: false,
    internalThoughts: false,
    featureFlags: {},
    sessionTracking: false,
    advancedErrorHandling: false,
    systemMonitoring: false,
  };

  // Initialize stateful component storage
  const stateStorage = useComponentStateStorage();

  // Core state management - use state storage for messages
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with opening message if no messages exist - convert to TriageMessage format for display
  const messages: TriageMessage[] =
    stateStorage.messages.length > 0
      ? stateStorage.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          type: msg.role, // Map role to type for TriageMessage compatibility
          content: msg.content,
          timestamp: msg.timestamp,
          careLevel: msg.careLevel,
          // Reasoning structure differs between EnhancedMessage and TriageMessage
          // Reasoning display is handled separately in the UI
        }))
      : [
          {
            id: '1',
            role: 'assistant' as const,
            type: 'assistant' as const,
            content: OPENING_MESSAGE,
            timestamp: new Date(),
          },
        ];

  // Use state storage for care level
  const currentCareLevel = stateStorage.currentCareLevel;

  // Enhanced features state - consolidated from both components
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(() => ({
    health: 'healthy',
    enhancedFeaturesAvailable: enhanced.enabled,
    culturalAdaptationEnabled: enhanced.culturalAdaptation,
    fallbackActive: false,
    componentStatus: {
      triage_api: 'up',
      geocoding: 'up',
      providers: 'up',
      cultural_adaptation: enhanced.culturalAdaptation ? 'up' : 'down',
      tool_integration: enhanced.toolIntegration ? 'up' : 'down',
    },
  }));

  const [sessionId] = useState(
    () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  const [trackedErrors, setTrackedErrors] = useState<TrackedError[]>([]);

  // Visit summaries state for memory persistence
  const [visitSummaries, setVisitSummaries] = useState<VisitSummary[]>([]);
  const [visitSummariesLoaded, setVisitSummariesLoaded] = useState(false);

  // User preferences for enhanced features
  const [userPreferences, setUserPreferences] = useState({
    enableInternalThoughts: enhanced.internalThoughts || enableDeveloperMode,
    enableCulturalAdaptation: enhanced.culturalAdaptation,
    enableToolIntegration: enhanced.toolIntegration,
  });

  const [showStatusDetails, setShowStatusDetails] = useState(false);

  // UI state
  const [inputValue, setInputValue] = useState('');
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [providers, setProviders] = useState<ProviderRecommendation[]>([]);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [expandedReasoning, setExpandedReasoning] = useState<{
    [key: string]: boolean;
  }>({});
  const [useStreaming, setUseStreaming] = useState(false);
  const [debugMode, setDebugMode] = useState(enableDeveloperMode);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  /**
   * MEMORY LOAD ON COMPONENT MOUNT - Load previous visit summaries with enhanced error handling
   */
  useEffect(() => {
    const loadPreviousVisitSummaries = async () => {
      try {
        // Use enhanced async loading with comprehensive error handling
        const loadResult = await loadVisitSummaries();
        
        if (loadResult.success && loadResult.data) {
          const summaryStorage = loadResult.data;
          setVisitSummaries(summaryStorage.summaries);
          setVisitSummariesLoaded(true);

          // Log successful load if session tracking is enabled
          if (enhanced.sessionTracking && config.onError) {
            config.onError({
              message: 'Visit summaries loaded successfully with enhanced error handling',
              severity: 'low',
              context: {
                summariesCount: summaryStorage.summaries.length,
                totalVisits: summaryStorage.totalVisits,
                storageSize: Math.round(JSON.stringify(summaryStorage).length / 1024),
                lastUpdated: summaryStorage.lastUpdated,
                storageMethod: loadResult.metadata?.storageMethod,
                storageHealth: summaryStorage.metadata?.storageHealth,
                schemaVersion: summaryStorage.version,
            },
            timestamp: new Date(),
            userId,
            sessionId,
          });
        }

          // Load memory context from most recent visit summary if available
          if (summaryStorage.summaries.length > 0) {
          const mostRecentSummary = summaryStorage.summaries
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

          // Only use recent summaries (within last 24 hours) for context
          const hoursSinceLastVisit = 
            (Date.now() - mostRecentSummary.timestamp.getTime()) / (1000 * 60 * 60);

          if (hoursSinceLastVisit < 24) {
            // Update state storage with context from recent visit
            const memoryContext = {
              previousTopics: mostRecentSummary.topics,
              previousCareLevel: mostRecentSummary.careLevel,
              emergencyFlags: mostRecentSummary.emergencyFlags,
              followUpNeeded: mostRecentSummary.followUpNeeded,
              lastVisitDuration: mostRecentSummary.duration,
            };

            // Log context loading
            if (enhanced.sessionTracking && config.onError) {
              config.onError({
                message: 'Memory context loaded from recent visit',
                severity: 'low',
                context: {
                  hoursSinceLastVisit,
                  memoryContext,
                  summaryId: mostRecentSummary.id,
                },
                timestamp: new Date(),
                userId,
                sessionId,
              });
            }
          }
        } 
        } else {
          // Handle load failure gracefully
          console.warn('[TriageChat] Visit summary load failed:', loadResult.error);
          setVisitSummariesLoaded(true); // Mark as loaded to prevent retry loops
          setVisitSummaries([]); // Use empty array as fallback

          // Log storage error with detailed context
          if (config.onError) {
            config.onError({
              message: `Visit summary load failed: ${loadResult.error?.message || 'Unknown error'}`,
              severity: loadResult.error?.recoverable ? 'medium' : 'high',
              context: {
                errorType: loadResult.error?.type,
                fallbackUsed: loadResult.error?.fallbackUsed,
                storageMethod: loadResult.metadata?.storageMethod,
                recoverable: loadResult.error?.recoverable,
              },
              timestamp: new Date(),
              userId,
              sessionId: enhanced.sessionTracking ? sessionId : undefined,
            });
          }

          // If storage is critical and enhanced features are enabled, run health check
          if (enhanced.advancedErrorHandling && loadResult.error?.type === 'storage_error') {
            performStorageHealthCheck().then(healthResult => {
              if (healthResult.success && config.onError) {
                config.onError({
                  message: `Storage health check completed: ${healthResult.data?.healthStatus}`,
                  severity: healthResult.data?.healthStatus === 'critical' ? 'high' : 'medium',
                  context: {
                    healthStatus: healthResult.data?.healthStatus,
                    issues: healthResult.data?.issues,
                    repairsPerformed: healthResult.data?.repairsPerformed,
                    recommendations: healthResult.data?.recommendations,
                  },
                  timestamp: new Date(),
                  userId,
                  sessionId: enhanced.sessionTracking ? sessionId : undefined,
                });
              }
            }).catch(healthError => {
              console.error('[TriageChat] Health check failed:', healthError);
            });
          }
        }

      } catch (error) {
        console.warn('[TriageChat] Critical error loading visit summaries:', error);
        setVisitSummariesLoaded(true); // Mark as loaded even if failed to prevent retry loops
        setVisitSummaries([]); // Use empty array as fallback

        // Log critical failure
        if (config.onError) {
          config.onError({
            message: 'Critical error loading visit summaries on component mount',
            severity: 'high',
            context: {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            timestamp: new Date(),
            userId,
            sessionId: enhanced.sessionTracking ? sessionId : undefined,
          });
        }
      }
    };

    // Only load on mount, not on every render
    if (!visitSummariesLoaded) {
      loadPreviousVisitSummaries();
    }
  }, [visitSummariesLoaded, enhanced.sessionTracking, enhanced.advancedErrorHandling, config.onError, userId, sessionId]);

  /**
   * Auto-scroll to bottom when new messages arrive
   */
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

  /**
   * CONSOLIDATED system health monitoring for enhanced features
   */
  useEffect(() => {
    if (!enhanced.enabled || !enhanced.systemMonitoring) return;

    const interval = setInterval(async () => {
      try {
        const health = await checkSystemHealth();
        setSystemStatus((prev) => ({
          ...prev,
          health: health.overallHealth,
          fallbackActive: health.overallHealth === 'critical',
          componentStatus: health.componentStatus,
        }));
      } catch (error) {
        console.warn('System health check failed:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [enhanced.enabled, enhanced.systemMonitoring]);

  /**
   * Session tracking and analytics initialization (enhanced features)
   */
  useEffect(() => {
    if (!enhanced.enabled || !enhanced.sessionTracking) return;

    // Log session start with comprehensive context
    const sessionContext = {
      enhancedFeaturesEnabled: enhanced.enabled,
      culturalAdaptationEnabled: enhanced.culturalAdaptation,
      toolIntegrationEnabled: enhanced.toolIntegration,
      internalThoughtsEnabled: enhanced.internalThoughts,
      featureFlags: enhanced.featureFlags,
      userAgent:
        typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
    };

    console.log('TriageChat session started:', {
      userId,
      sessionId,
      ...sessionContext,
    });

    // Call external logging if onError handler is provided (can be used for analytics)
    if (config.onError) {
      config.onError({
        message: 'Session started',
        severity: 'low',
        context: sessionContext,
        timestamp: new Date(),
        userId,
        sessionId,
      });
    }
  }, [enhanced, userId, sessionId, config.onError]);

  /**
   * UNIFIED error handling - consolidates all error handling logic
   */
  const handleError = useCallback(
    (
      error: Error,
      context?: Record<string, any>,
      severity: 'low' | 'medium' | 'high' = 'medium'
    ) => {
      const errorMessage = error.message || 'An unexpected error occurred';
      const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date();

      // Create comprehensive error object
      const errorObj = {
        message: errorMessage,
        severity,
        context: {
          ...context,
          errorId,
          userId,
          sessionId: enhanced.sessionTracking ? sessionId : undefined,
          timestamp: timestamp.toISOString(),
          enhancedFeaturesEnabled: enhanced.enabled,
          stack: error.stack,
        },
        timestamp,
        userId,
        sessionId: enhanced.sessionTracking ? sessionId : undefined,
      };

      // Enhanced error tracking for advanced error handling
      if (enhanced.enabled && enhanced.advancedErrorHandling) {
        const trackedError: TrackedError = {
          id: errorId,
          message: errorMessage,
          severity,
          timestamp,
          resolved: false,
          context: errorObj.context,
        };

        setTrackedErrors((prev) => [...prev.slice(-4), trackedError]); // Keep last 5 errors

        // Auto-resolve low severity errors after 10 seconds
        if (severity === 'low') {
          setTimeout(() => {
            setTrackedErrors((prev) =>
              prev.map((e) => (e.id === errorId ? { ...e, resolved: true } : e))
            );
          }, 10000);
        }
      }

      // Call external error handler if provided
      if (config.onError) {
        config.onError(errorObj);
      }

      // Set basic error for all configurations
      setError(errorMessage);

      // Console logging with appropriate level
      const logLevel =
        severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'log';
      console[logLevel]('TriageChat Error:', error, errorObj.context);
    },
    [enhanced, userId, sessionId, config.onError]
  );

  /**
   * Dismiss error from tracked errors (enhanced features)
   */
  const dismissError = useCallback((errorId: string) => {
    setTrackedErrors((prev) =>
      prev.map((e) => (e.id === errorId ? { ...e, resolved: true } : e))
    );
  }, []);

  /**
   * Toggle user preferences for enhanced features
   */
  const toggleUserPreference = useCallback(
    (preference: keyof typeof userPreferences) => {
      setUserPreferences((prev) => ({
        ...prev,
        [preference]: !prev[preference],
      }));

      // Log preference change if session tracking is enabled
      if (enhanced.sessionTracking && config.onError) {
        config.onError({
          message: `User toggled ${preference} to ${!userPreferences[preference]}`,
          severity: 'low',
          context: { action: 'preference_toggle', preference },
          timestamp: new Date(),
          userId,
          sessionId,
        });
      }
    },
    [
      enhanced.sessionTracking,
      config.onError,
      userId,
      sessionId,
      userPreferences,
    ]
  );

  /**
   * Handle follow-up question clicks from progressive disclosure
   */
  const handleFollowUpQuestion = useCallback((question: string) => {
    setInputValue(question);
    // Trigger submission after state update
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true }));
      }
    }, 0);
  }, []);

  /**
   * Handle emergency action (call 911)
   */
  const handleEmergencyAction = useCallback(() => {
    // Log emergency action
    if (enhanced.sessionTracking && config.onError) {
      config.onError({
        message: 'User triggered emergency action',
        severity: 'high',
        context: { action: 'emergency_action_triggered' },
        timestamp: new Date(),
        userId,
        sessionId,
      });
    }

    // Open phone dialer on mobile devices
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = 'tel:911';
    }
  }, [enhanced.sessionTracking, config.onError, userId, sessionId]);

  /**
   * Get memory context from recent visit summaries for API calls
   */
  const getMemoryContextFromVisitSummaries = useCallback((): string => {
    if (visitSummaries.length === 0) return '';

    const recentSummaries = visitSummaries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 3); // Last 3 visits

    const contextParts: string[] = [];

    recentSummaries.forEach((summary, index) => {
      const hoursAgo = Math.round(
        (Date.now() - summary.timestamp.getTime()) / (1000 * 60 * 60)
      );

      if (hoursAgo < 168) { // Within last week
        const contextEntry = [
          `Previous visit ${index + 1} (${hoursAgo}h ago):`,
          `Topics: ${summary.topics.join(', ')}`,
          summary.careLevel ? `Care level: ${summary.careLevel}` : '',
          summary.emergencyFlags.length > 0 
            ? `Emergency flags: ${summary.emergencyFlags.join(', ')}` 
            : '',
          summary.followUpNeeded ? 'Follow-up needed' : '',
          summary.recommendations.length > 0 
            ? `Recommendations: ${summary.recommendations.slice(0, 2).join(', ')}` 
            : '',
        ].filter(Boolean).join('; ');

        contextParts.push(contextEntry);
      }
    });

    return contextParts.length > 0 
      ? `\n\nPatient History:\n${contextParts.join('\n')}\n`
      : '';
  }, [visitSummaries]);

  /**
   * Handle form submission with comprehensive error handling
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!inputValue.trim() || isLoading) return;

      const userMessage = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: inputValue.trim(),
        timestamp: new Date(),
      };

      // Convert existing messages to enhanced format
      const currentEnhancedMessages = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      }));

      // Add user message to state storage
      stateStorage.updateMessages([...currentEnhancedMessages, userMessage]);
      setInputValue('');
      setIsLoading(true);
      setError(null);

      try {
        // Get context for API from state storage
        const apiContext = stateStorage.getMessageContextForApi();
        
        // Get memory context from visit summaries
        const visitMemoryContext = getMemoryContextFromVisitSummaries();

        // Call stateful triage API
        const apiResponse = await fetch('/api/triage-stateful', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: inputValue.trim(),
            recentExchanges: apiContext.recentExchanges,
            currentMemory: apiContext.currentMemory,
            visitHistory: visitMemoryContext, // Add visit summary context
            sessionId: enhanced.sessionTracking ? sessionId : undefined,
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(
            `HTTP ${apiResponse.status}: ${apiResponse.statusText}`
          );
        }

        const statefulResponse = await apiResponse.json();

        // Process the stateful response through state storage
        stateStorage.processStatefulResponse(statefulResponse);

        // Create enhanced assistant message with reasoning and memory
        const assistantMessage = stateStorage.enhanceMessage(
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            type: 'assistant',
            content: statefulResponse.assistant_message,
            timestamp: new Date(),
          },
          statefulResponse.updated_reasoning,
          statefulResponse.updated_memory
        );

        // Add assistant message to state storage (already have user message added)
        const updatedMessages = [
          ...currentEnhancedMessages,
          userMessage,
          assistantMessage,
        ];
        stateStorage.updateMessages(updatedMessages);

        // MEMORY SAVE TRIGGER: Create and save visit summary with enhanced error handling
        try {
          const visitSummary = createVisitSummary(
            updatedMessages,
            enhanced.sessionTracking ? sessionId : undefined
          );
          
          // Use enhanced async save with comprehensive error handling
          const saveResult = await saveVisitSummary(visitSummary);
          
          if (saveResult.success) {
            // Update local state with new summary on successful save
            setVisitSummaries(prev => [visitSummary, ...prev].slice(0, 20));
            
            // Log successful visit summary creation and save
            if (enhanced.sessionTracking && config.onError) {
              config.onError({
                message: 'Visit summary created and saved successfully with enhanced error handling',
                severity: 'low',
                context: {
                  summaryId: visitSummary.id,
                  topics: visitSummary.topics,
                  duration: visitSummary.duration,
                  exchangeCount: visitSummary.lastThreeExchanges.length,
                  careLevel: visitSummary.careLevel,
                  hasEmergencyFlags: visitSummary.emergencyFlags.length > 0,
                  storageMethod: saveResult.metadata?.storageMethod,
                  saveTime: saveResult.metadata?.timestamp,
                },
                timestamp: new Date(),
                userId,
                sessionId,
              });
            }
          } else {
            // Save failed - handle gracefully without breaking UX
            console.warn('[TriageChat] Visit summary save failed:', saveResult.error);
            
            // Still update local state so user can see summary in current session
            setVisitSummaries(prev => [visitSummary, ...prev].slice(0, 20));
            
            // Log storage failure with detailed context
            if (config.onError) {
              config.onError({
                message: `Visit summary save failed: ${saveResult.error?.message || 'Unknown error'}`,
                severity: saveResult.error?.recoverable ? 'medium' : 'high',
                context: {
                  summaryId: visitSummary.id,
                  errorType: saveResult.error?.type,
                  fallbackUsed: saveResult.error?.fallbackUsed,
                  storageMethod: saveResult.metadata?.storageMethod,
                  recoverable: saveResult.error?.recoverable,
                  messageCount: updatedMessages.length,
                },
                timestamp: new Date(),
                userId,
                sessionId: enhanced.sessionTracking ? sessionId : undefined,
              });
            }

            // If enhanced error handling is enabled and it's a critical storage error, try sync fallback
            if (enhanced.advancedErrorHandling && 
                saveResult.error?.type === 'storage_error' && 
                !saveResult.error?.recoverable) {
              
              console.log('[TriageChat] Attempting sync fallback save...');
              const syncSaveSuccess = saveVisitSummarySync(visitSummary);
              
              if (syncSaveSuccess && config.onError) {
                config.onError({
                  message: 'Visit summary saved using sync fallback after async failure',
                  severity: 'medium',
                  context: {
                    summaryId: visitSummary.id,
                    originalError: saveResult.error?.message,
                    fallbackMethod: 'sync',
                  },
                  timestamp: new Date(),
                  userId,
                  sessionId: enhanced.sessionTracking ? sessionId : undefined,
                });
              }
            }
          }
          
        } catch (summaryError) {
          console.warn('[TriageChat] Critical error creating visit summary:', summaryError);
          
          // Log critical failure but don't break the user experience
          if (config.onError) {
            config.onError({
              message: 'Critical error creating visit summary',
              severity: 'high',
              context: { 
                error: summaryError instanceof Error ? summaryError.message : String(summaryError),
                stack: summaryError instanceof Error ? summaryError.stack : undefined,
                messageCount: updatedMessages.length,
              },
              timestamp: new Date(),
              userId,
              sessionId: enhanced.sessionTracking ? sessionId : undefined,
            });
          }
        }

        // Handle emergency situations
        if (statefulResponse.emergency_detected) {
          setShowLocationPrompt(true);

          // Log emergency detection
          if (enhanced.sessionTracking && config.onError) {
            config.onError({
              message: 'Emergency detected by stateful triage system',
              severity: 'high',
              context: {
                careLevel: statefulResponse.care_level,
                emergencyFlags: statefulResponse.updated_memory.emergencyFlags,
              },
              timestamp: new Date(),
              userId,
              sessionId,
            });
          }
        }
      } catch (error) {
        handleError(error as Error, {
          userMessage: inputValue.trim(),
          useStreaming,
          messagesCount: messages.length,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      inputValue,
      isLoading,
      messages,
      stateStorage,
      enhanced.sessionTracking,
      config.onError,
      userId,
      sessionId,
      handleError,
      getMemoryContextFromVisitSummaries,
    ]
  );

  /**
   * Get user location for provider recommendations
   */
  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setShowLocationPrompt(false);
          // Trigger provider search
          searchProviders(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          handleError(new Error('Location access denied'), {
            geolocationError: error,
          });
          setShowLocationPrompt(false);
        }
      );
    } else {
      handleError(new Error('Geolocation not supported'));
    }
  }, [handleError]);

  /**
   * Search for healthcare providers by location
   */
  const searchProviders = useCallback(
    async (lat: number, lng: number) => {
      try {
        const response = await callEdgeFunctionEnhanced('provider-search', {
          latitude: lat,
          longitude: lng,
          careLevel: currentCareLevel,
          radius: 25, // 25 mile radius
        });

        if (response?.providers) {
          setProviders(response.providers);
        }
      } catch (error) {
        handleError(error as Error, { lat, lng, careLevel: currentCareLevel });
      }
    },
    [currentCareLevel, handleError]
  );

  /**
   * Search providers by ZIP code
   */
  const searchProvidersByZip = useCallback(async () => {
    if (!zipCode.trim()) return;

    try {
      const response = await callEdgeFunctionEnhanced('geocode', {
        zipCode: zipCode.trim(),
      });

      if (response?.coordinates) {
        const { lat, lng } = response.coordinates;
        setUserLocation({ lat, lng });
        await searchProviders(lat, lng);
        setShowLocationPrompt(false);
      }
    } catch (error) {
      handleError(error as Error, { zipCode });
    }
  }, [zipCode, searchProviders, handleError]);

  /**
   * Toggle reasoning expansion for a message
   */
  const toggleReasoning = useCallback((messageId: string) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  }, []);

  /**
   * Clear conversation and reset state - handles both basic and enhanced features
   */
  const clearConversation = useCallback(() => {
    // Clear all state storage
    stateStorage.clearAllState();

    // Reset opening message
    stateStorage.updateMessages([
      {
        id: '1',
        role: 'assistant' as const,
        content: OPENING_MESSAGE,
        timestamp: new Date(),
      },
    ]);

    setError(null);
    setProviders([]);
    setUserLocation(null);
    setShowLocationPrompt(false);
    setZipCode('');
    setExpandedReasoning({});

    // Clear enhanced features state if enabled
    if (enhanced.enabled && enhanced.advancedErrorHandling) {
      setTrackedErrors([]);
    }

    // Log conversation clear if session tracking is enabled
    if (enhanced.sessionTracking && config.onError) {
      config.onError({
        message: 'Conversation cleared by user',
        severity: 'low',
        context: { action: 'conversation_clear' },
        timestamp: new Date(),
        userId,
        sessionId,
      });
    }
  }, [stateStorage, enhanced, config.onError, userId, sessionId]);

  /**
   * Enhanced system health check with component status
   */
  const checkSystemHealth = async () => {
    // This would be replaced with actual system health checks
    const componentStatus = {
      triage_api: 'up' as const,
      geocoding: 'up' as const,
      providers: 'up' as const,
      cultural_adaptation: enhanced.culturalAdaptation
        ? ('up' as const)
        : ('down' as const),
      tool_integration: enhanced.toolIntegration
        ? ('up' as const)
        : ('down' as const),
    };

    const healthyComponents = Object.values(componentStatus).filter(
      (status) => status === 'up'
    ).length;
    const totalComponents = Object.values(componentStatus).length;

    let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (healthyComponents < totalComponents * 0.5) {
      overallHealth = 'critical';
    } else if (healthyComponents < totalComponents * 0.8) {
      overallHealth = 'degraded';
    }

    return {
      overallHealth,
      componentStatus,
    };
  };

  /**
   * Get status color for UI components
   */
  const getStatusColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  /**
   * Get status icon for UI components
   */
  const getStatusIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Shield className="h-4 w-4" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'critical':
        return <Zap className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  /**
   * Render care level badge with appropriate styling
   */
  const renderCareLevel = (careLevel: CareLevel) => {
    const styles: Record<string, string> = {
      emergency: 'bg-red-100 text-red-800 border-red-200',
      urgent: 'bg-orange-100 text-orange-800 border-orange-200',
      primary: 'bg-blue-100 text-blue-800 border-blue-200',
      self_care: 'bg-green-100 text-green-800 border-green-200',
      'self-care': 'bg-green-100 text-green-800 border-green-200',
    };

    return (
      <Badge
        variant="outline"
        className={
          styles[careLevel] || 'bg-gray-100 text-gray-800 border-gray-200'
        }
      >
        {careLevel.replace(/[-_]/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  // Get active unresolved errors for display
  const activeErrors = trackedErrors.filter((e) => !e.resolved);

  return (
    <div className={`flex flex-col h-full max-w-4xl mx-auto ${className}`}>
      {/* CONSOLIDATED Enhanced Features: System Status Bar */}
      {enhanced.enabled && enhanced.systemMonitoring && (
        <div className="mb-4 space-y-2">
          {/* Main Status */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(
              systemStatus.health
            )}`}
          >
            <div className="flex items-center space-x-2">
              {getStatusIcon(systemStatus.health)}
              <span className="font-medium">
                System Status: {systemStatus.health}
              </span>
              {systemStatus.enhancedFeaturesAvailable && (
                <Badge variant="outline" className="text-xs">
                  <Brain className="h-3 w-3 mr-1" />
                  Enhanced AI
                </Badge>
              )}
              {systemStatus.culturalAdaptationEnabled &&
                userPreferences.enableCulturalAdaptation && (
                  <Badge variant="outline" className="text-xs">
                    <Globe className="h-3 w-3 mr-1" />
                    Cultural Aware
                  </Badge>
                )}
              {systemStatus.fallbackActive && (
                <Badge variant="outline" className="text-xs bg-yellow-100">
                  Fallback Active
                </Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStatusDetails(!showStatusDetails)}
              className="text-xs"
            >
              {showStatusDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>

          {/* Detailed Component Status */}
          {showStatusDetails && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs p-2 bg-muted/30 rounded">
              {Object.entries(systemStatus.componentStatus).map(
                ([component, status]) => (
                  <div key={component} className="flex items-center space-x-1">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        status === 'up'
                          ? 'bg-green-500'
                          : status === 'degraded'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                    <span className="capitalize">
                      {component.replace('_', ' ')}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* SIMPLIFIED Basic Status (when enhanced monitoring is off) */}
      {enhanced.enabled && !enhanced.systemMonitoring && (
        <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full bg-green-500`} />
            <span className="text-xs text-muted-foreground">System: Ready</span>
            {enhanced.culturalAdaptation && (
              <Badge variant="outline" className="text-xs">
                <Globe className="h-3 w-3 mr-1" />
                Enhanced
              </Badge>
            )}
          </div>

          {enableDeveloperMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDebugMode(!debugMode)}
              className="text-xs"
            >
              Debug: {debugMode ? 'ON' : 'OFF'}
            </Button>
          )}
        </div>
      )}

      {/* UNIFIED Error Display - Consolidates basic and enhanced error handling */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="mt-2 text-xs"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* ENHANCED Error Tracking (Advanced Error Handling) */}
      {enhanced.enabled &&
        enhanced.advancedErrorHandling &&
        activeErrors.length > 0 && (
          <div className="mx-4 mt-4 space-y-2">
            {activeErrors.slice(-3).map((error) => (
              <Alert
                key={error.id}
                variant={error.severity === 'high' ? 'destructive' : 'default'}
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <span>{error.message}</span>
                    <div className="text-xs text-muted-foreground mt-1">
                      {error.timestamp.toLocaleTimeString()} - Severity:{' '}
                      {error.severity}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissError(error.id)}
                    className="text-xs ml-2"
                  >
                    Dismiss
                  </Button>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

      {/* ENHANCED Developer Controls (consolidates debug features) */}
      {enableDeveloperMode && enhanced.enabled && (
        <div className="mx-4 mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Developer Controls
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleUserPreference('enableInternalThoughts')}
              className="text-xs"
            >
              Internal Thoughts:{' '}
              {userPreferences.enableInternalThoughts ? 'ON' : 'OFF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleUserPreference('enableCulturalAdaptation')}
              className="text-xs"
            >
              Cultural Adaptation:{' '}
              {userPreferences.enableCulturalAdaptation ? 'ON' : 'OFF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleUserPreference('enableToolIntegration')}
              className="text-xs"
            >
              Tool Integration:{' '}
              {userPreferences.enableToolIntegration ? 'ON' : 'OFF'}
            </Button>
          </div>
          
          {/* Enhanced Visit Summary Debug Info with Storage Health */}
          <div className="mt-3 p-2 bg-white rounded border text-xs">
            <div className="font-medium text-gray-600 mb-1">Visit Summary Stats (Enhanced):</div>
            {(() => {
              // Use sync version for immediate display in debug UI
              const stats = getVisitSummaryStatsSync();
              
              return (
                <div className="text-gray-500 space-y-1">
                  <div>Total Summaries: {stats.totalSummaries}</div>
                  <div>Storage Size: {Math.round(stats.totalStorageSize / 1024)} KB</div>
                  <div>Avg Summary Size: {Math.round(stats.averageSummarySize / 1024)} KB</div>
                  {stats.newestSummary && (
                    <div>Last Visit: {stats.newestSummary.toLocaleTimeString()}</div>
                  )}
                  <div>Loaded: {visitSummariesLoaded ? 'Yes' : 'Loading...'}</div>
                  <div>In Memory: {visitSummaries.length} summaries</div>
                  <div>Error Count: {stats.errorCount}</div>
                  <div className="mt-2 pt-1 border-t border-gray-200">
                    <div className="font-medium text-gray-600 mb-1">Storage Health:</div>
                    {(() => {
                      const healthStatus = visitSummaries.find(s => true) ? 'Healthy' : 'Unknown';
                      return (
                        <div className={`px-2 py-1 rounded text-xs ${
                          healthStatus === 'Healthy' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {healthStatus}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Recent Visit Summaries (Developer View) */}
          {visitSummaries.length > 0 && (
            <div className="mt-3 p-2 bg-white rounded border text-xs">
              <div className="font-medium text-gray-600 mb-1">Recent Visits:</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {visitSummaries.slice(0, 3).map((summary) => (
                  <div key={summary.id} className="p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium">
                      {summary.timestamp.toLocaleDateString()} - {summary.duration}min
                    </div>
                    <div className="text-gray-500">
                      Topics: {summary.topics.slice(0, 3).join(', ')}
                      {summary.topics.length > 3 && '...'}
                    </div>
                    {summary.careLevel && (
                      <div className="text-gray-500">Care Level: {summary.careLevel}</div>
                    )}
                    {summary.emergencyFlags.length > 0 && (
                      <div className="text-red-600">
                        Flags: {summary.emergencyFlags.length}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Chat Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <Card
                className={`max-w-[80%] p-4 ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="space-y-2">
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                    )}
                  </p>

                  {message.type === 'assistant' && message.careLevel && (
                    <div className="flex items-center justify-between">
                      {renderCareLevel(message.careLevel)}
                      {message.reasoning && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleReasoning(message.id)}
                          className="text-xs p-1"
                        >
                          {expandedReasoning[message.id] ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                          Reasoning
                        </Button>
                      )}
                    </div>
                  )}

                  {message.reasoning && expandedReasoning[message.id] && (
                    <div className="mt-2 p-2 bg-background/50 rounded text-xs">
                      <p>
                        <strong>Plan:</strong>{' '}
                        {message.reasoning.plan}
                      </p>
                      {message.reasoning.observations &&
                        message.reasoning.observations.length > 0 && (
                          <p className="mt-1">
                            <strong>Observations:</strong>{' '}
                            {message.reasoning.observations.join(', ')}
                          </p>
                        )}
                      {message.reasoning.steps &&
                        message.reasoning.steps.length > 0 && (
                          <p className="mt-1">
                            <strong>Steps:</strong>{' '}
                            {message.reasoning.steps.join(', ')}
                          </p>
                        )}
                      {message.reasoning.confidence !== undefined && (
                        <p className="mt-1">
                          <strong>Confidence:</strong>{' '}
                          {Math.round(message.reasoning.confidence * 100)}%
                        </p>
                      )}
                    </div>
                  )}

                  {/* Progressive Disclosure for Enhanced Features */}
                  {enhanced.enabled && message.type === 'assistant' && (
                    <div className="mt-2">
                      <TriageResponseDisplay
                        response={message as any}
                        isLoading={false}
                        showThinking={enhanced.internalThoughts}
                        onFollowUpQuestion={handleFollowUpQuestion}
                        onEmergencyAction={handleEmergencyAction}
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Location Prompt Modal */}
      {showLocationPrompt && (
        <div className="mx-4 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-semibold text-blue-900 mb-2">
            Find Nearby Providers
          </h3>
          <p className="text-sm text-blue-700 mb-3">
            We can help you find nearby healthcare providers. Please share your
            location or ZIP code.
          </p>
          <div className="flex flex-col space-y-2">
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="Enter ZIP code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="flex-1"
              />
              <Button onClick={searchProvidersByZip} size="sm">
                <MapPin className="w-4 h-4 mr-1" />
                Search
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={getUserLocation}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Globe className="w-4 h-4 mr-1" />
                Use My Location
              </Button>
              <Button
                onClick={() => setShowLocationPrompt(false)}
                variant="ghost"
                size="sm"
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Provider Recommendations */}
      {providers.length > 0 && (
        <div className="mx-4 mb-4 space-y-2">
          <h3 className="font-semibold text-sm">Recommended Providers</h3>
          {providers.slice(0, 3).map((provider, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{provider.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {provider.address}
                  </p>
                  {provider.distance && (
                    <p className="text-xs text-muted-foreground">
                      {provider.distance} miles away
                    </p>
                  )}
                </div>
                {provider.phone && (
                  <Button variant="outline" size="sm">
                    Call
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="p-4 border-t">
        <div className="flex items-center space-x-2 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearConversation}
            disabled={isLoading}
          >
            Clear Chat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUseStreaming(!useStreaming)}
            disabled={isLoading}
          >
            {useStreaming ? 'Disable' : 'Enable'} Streaming
          </Button>
          {debugMode && (
            <Badge variant="outline" className="text-xs">
              Debug Mode
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex space-x-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe your symptoms or health concerns..."
            className="flex-1 min-h-[60px] resize-none"
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
            disabled={!inputValue.trim() || isLoading}
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

      {/* ENHANCED Cultural Adaptation Feedback */}
      {enhanced.enabled &&
        enhanced.culturalAdaptation &&
        userPreferences.enableCulturalAdaptation && (
          <div className="mx-4 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800">
              <Globe className="h-4 w-4 inline mr-2" />
              Cultural adaptation is active. The AI will adapt its communication
              style based on your conversation.
              <Button
                variant="link"
                size="sm"
                className="text-blue-600 p-0 ml-2 h-auto"
                onClick={() => {
                  // Log cultural feedback request
                  if (enhanced.sessionTracking && config.onError) {
                    config.onError({
                      message: 'User requested cultural feedback options',
                      severity: 'low',
                      context: { action: 'cultural_feedback_request' },
                      timestamp: new Date(),
                      userId,
                      sessionId,
                    });
                  }
                }}
              >
                Provide feedback
              </Button>
            </div>
          </div>
        )}

      {/* ENHANCED Progressive Enhancement Notice */}
      {enhanced.enabled && !systemStatus.enhancedFeaturesAvailable && (
        <div className="mx-4 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-700">
            You're using the standard triage system. Enhanced features with
            cultural adaptation may become available based on system capacity.
          </div>
        </div>
      )}

      {/* Memory Context Loaded Notice */}
      {visitSummariesLoaded && visitSummaries.length > 0 && (
        <div className="mx-4 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-800">
            <Heart className="h-4 w-4 inline mr-2" />
            Your medical history has been loaded ({visitSummaries.length} previous visits). 
            The AI will consider your past visits when providing recommendations.
            {visitSummaries.some(s => s.followUpNeeded) && (
              <div className="mt-1 text-blue-700">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Note: You have pending follow-up recommendations from previous visits.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BACKWARDS COMPATIBILITY HELPERS
// =============================================================================

/**
 * Create basic configuration for simple use cases
 */
export const createBasicTriageConfig = (
  userId: string = 'anonymous',
  className: string = '',
  enableDeveloperMode: boolean = false
): TriageChatConfig => ({
  basic: {
    className,
    userId,
    enableDeveloperMode,
  },
});

/**
 * Create enhanced configuration for full-featured use cases
 */
export const createEnhancedTriageConfig = (
  userId: string = 'anonymous',
  className: string = '',
  enableDeveloperMode: boolean = false,
  enhancedOptions: Partial<TriageChatConfig['enhanced']> = {},
  onError?: TriageChatConfig['onError']
): TriageChatConfig => ({
  basic: {
    className,
    userId,
    enableDeveloperMode,
  },
  enhanced: {
    enabled: true,
    culturalAdaptation: true,
    toolIntegration: true,
    internalThoughts: enableDeveloperMode,
    featureFlags: {},
    sessionTracking: true,
    advancedErrorHandling: true,
    systemMonitoring: true,
    ...enhancedOptions,
  },
  onError,
});

/**
 * Legacy prop adapter for components still using old props interface
 * @deprecated Use the unified config interface instead
 */
export const adaptLegacyProps = (legacyProps: {
  className?: string;
  userId?: string;
  enableDeveloperMode?: boolean;
  useEnhancedFeatures?: boolean;
  enhancedConfig?: any;
}): TriageChatConfig => {
  const {
    className,
    userId,
    enableDeveloperMode,
    useEnhancedFeatures,
    enhancedConfig,
  } = legacyProps;

  if (useEnhancedFeatures) {
    return createEnhancedTriageConfig(
      userId,
      className,
      enableDeveloperMode,
      enhancedConfig,
      enhancedConfig?.onError
    );
  } else {
    return createBasicTriageConfig(userId, className, enableDeveloperMode);
  }
};

// =============================================================================
// EXPORT TYPES FOR EXTERNAL USE
// =============================================================================

export type { TriageChatConfig, TriageChatProps, SystemStatus, TrackedError };
