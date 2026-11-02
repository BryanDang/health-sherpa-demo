/**
 * Visit Summary Utility
 * 
 * Production-ready visit summary system with comprehensive error handling.
 * Handles creation and storage of visit summaries for medical triage sessions.
 * Stores concise 5KB summaries instead of full conversation transcripts (100KB+).
 * Follows EHR patterns with appendix of visit summaries.
 * 
 * Features:
 * - Robust localStorage error handling with automatic recovery
 * - Storage quota management with intelligent cleanup
 * - Corrupted data detection and sanitization  
 * - Browser compatibility with multiple fallback mechanisms
 * - Concurrent access protection for multi-tab scenarios
 * - Data migration support for schema version changes
 * - Comprehensive logging for production debugging
 * - Never breaks user experience even when storage fails
 */

import type { EnhancedMessage } from '../../tests/contracts/component-state-storage.contract';
import { safeLocalStorage, storageErrorHandler, type StorageResult } from './storage-error-handler';

/**
 * Visit summary structure (approximately 5KB each)
 */
export interface VisitSummary {
  id: string;
  timestamp: Date;
  sessionId?: string;
  duration: number; // in minutes
  topics: string[]; // Main conversation topics
  lastThreeExchanges: {
    user: string;
    assistant: string;
    timestamp: Date;
  }[];
  careLevel?: string;
  emergencyFlags: string[];
  keyFindings: string[];
  recommendations: string[];
  followUpNeeded: boolean;
  metadata: {
    messageCount: number;
    userInitiated: boolean;
    completedSuccessfully: boolean;
  };
}

/**
 * Storage interface for visit summaries with versioning
 */
export interface VisitSummaryStorage {
  summaries: VisitSummary[];
  lastUpdated: Date;
  totalVisits: number;
  version?: string; // Schema version for migration support
  metadata?: {
    storageHealth: 'healthy' | 'degraded' | 'fallback';
    lastCleanup?: Date;
    errorCount?: number;
  };
}

/**
 * Visit summary operation result with detailed error information
 */
export interface VisitSummaryResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    type: 'storage_error' | 'validation_error' | 'quota_exceeded' | 'corrupted_data';
    message: string;
    recoverable: boolean;
    fallbackUsed: boolean;
  };
  metadata?: {
    operation: string;
    timestamp: Date;
    storageMethod: 'localStorage' | 'sessionStorage' | 'memory';
    retryCount?: number;
  };
}

/**
 * LocalStorage key for visit summaries
 */
const VISIT_SUMMARIES_KEY = 'triage_visit_summaries';

/**
 * Maximum number of visit summaries to store (prevent storage bloat)
 */
const MAX_STORED_SUMMARIES = 20;

/**
 * Current schema version for data migration
 */
const CURRENT_SCHEMA_VERSION = '2.0.0';

/**
 * Storage operation timeout (for async operations)
 */
const STORAGE_OPERATION_TIMEOUT = 5000;

/**
 * Extract conversation topics from messages using keyword analysis
 */
function extractTopics(messages: EnhancedMessage[]): string[] {
  const topics = new Set<string>();
  
  // Medical topic keywords to look for
  const medicalKeywords = {
    symptoms: ['pain', 'fever', 'headache', 'nausea', 'fatigue', 'cough', 'shortness', 'chest', 'stomach'],
    conditions: ['diabetes', 'hypertension', 'asthma', 'allergies', 'infection', 'injury'],
    bodyParts: ['head', 'chest', 'abdomen', 'back', 'arm', 'leg', 'throat', 'heart'],
    urgency: ['emergency', 'urgent', 'severe', 'mild', 'chronic', 'acute']
  };
  
  const allMessages = messages.map(m => m.content.toLowerCase()).join(' ');
  
  // Check for medical keywords and add relevant topics
  Object.entries(medicalKeywords).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (allMessages.includes(keyword)) {
        topics.add(keyword);
      }
    });
  });
  
  // Limit to most relevant topics
  return Array.from(topics).slice(0, 8);
}

/**
 * Get the last three user-assistant exchanges
 */
function getLastThreeExchanges(messages: EnhancedMessage[]): VisitSummary['lastThreeExchanges'] {
  const exchanges: VisitSummary['lastThreeExchanges'] = [];
  let currentExchange: Partial<VisitSummary['lastThreeExchanges'][0]> = {};
  
  // Process messages in reverse to get the most recent exchanges
  for (let i = messages.length - 1; i >= 0 && exchanges.length < 3; i--) {
    const message = messages[i];
    
    if (message.role === 'assistant' && !currentExchange.assistant) {
      currentExchange.assistant = message.content;
      currentExchange.timestamp = message.timestamp;
    } else if (message.role === 'user' && !currentExchange.user) {
      currentExchange.user = message.content;
      
      // Complete the exchange when both parts exist
      if (currentExchange.assistant && currentExchange.timestamp) {
        exchanges.unshift({
          user: currentExchange.user,
          assistant: currentExchange.assistant,
          timestamp: currentExchange.timestamp,
        });
        currentExchange = {};
      }
    }
  }
  
  return exchanges;
}

/**
 * Extract emergency flags from memory and reasoning
 */
function extractEmergencyFlags(messages: EnhancedMessage[]): string[] {
  const flags = new Set<string>();
  
  messages.forEach(message => {
    if (message.role === 'assistant' && message.reasoning) {
      // Add red flags from reasoning
      if (message.reasoning.redFlags) {
        message.reasoning.redFlags.forEach((flag: string) => flags.add(flag));
      }
      
      // Check for emergency care level
      if (message.reasoning.careLevel === 'emergency') {
        flags.add('Emergency care level detected');
      }
    }
    
    // Check memory for emergency flags
    if (message.memory?.emergencyFlags) {
      message.memory.emergencyFlags.forEach((flag: string) => flags.add(flag));
    }
  });
  
  return Array.from(flags).slice(0, 5); // Limit to most important flags
}

/**
 * Extract key findings from assistant messages
 */
function extractKeyFindings(messages: EnhancedMessage[]): string[] {
  const findings = new Set<string>();
  
  messages.forEach(message => {
    if (message.role === 'assistant' && message.reasoning) {
      // Add key observations from stateful LLM reasoning
      if (message.reasoning.observations) {
        message.reasoning.observations.forEach((obs: string) => findings.add(obs));
      }
      
      // Add the medical plan as a key finding
      if (message.reasoning.plan) {
        findings.add(message.reasoning.plan);
      }
    }
  });
  
  return Array.from(findings).slice(0, 5); // Limit to most important findings
}

/**
 * Extract recommendations from assistant messages
 */
function extractRecommendations(messages: EnhancedMessage[]): string[] {
  const recommendations = new Set<string>();
  
  messages.forEach(message => {
    if (message.role === 'assistant' && message.reasoning) {
      // Add steps from stateful LLM reasoning as recommendations
      if (message.reasoning.steps) {
        message.reasoning.steps.forEach((step: string) => recommendations.add(step));
      }
    }
  });
  
  return Array.from(recommendations).slice(0, 5); // Limit to most important recommendations
}

/**
 * Calculate session duration from first to last message
 */
function calculateSessionDuration(messages: EnhancedMessage[]): number {
  if (messages.length < 2) return 0;
  
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  
  const durationMs = lastMessage.timestamp.getTime() - firstMessage.timestamp.getTime();
  return Math.round(durationMs / 60000); // Convert to minutes
}

/**
 * Extract care level from assistant messages with stateful LLM reasoning
 */
function extractCareLevel(messages: EnhancedMessage[]): string | undefined {
  // Look for care level in assistant messages (prioritize most recent)
  const assistantMessages = messages
    .filter(m => m.role === 'assistant')
    .reverse(); // Start with most recent
  
  for (const message of assistantMessages) {
    // Check if message has careLevel property (from enhanced messages)
    if (message.careLevel) {
      return message.careLevel;
    }
    
    // Check memory for emergency flags that indicate care level
    if (message.memory?.emergencyFlags?.length > 0) {
      return 'emergency';
    }
    
    // Infer care level from reasoning observations
    if (message.reasoning?.observations) {
      const observations = message.reasoning.observations.join(' ').toLowerCase();
      if (observations.includes('emergency') || observations.includes('911')) {
        return 'emergency';
      }
      if (observations.includes('urgent') || observations.includes('immediate')) {
        return 'urgent';
      }
      if (observations.includes('primary') || observations.includes('doctor')) {
        return 'primary';
      }
      if (observations.includes('self-care') || observations.includes('home')) {
        return 'self_care';
      }
    }
  }
  
  return undefined;
}

/**
 * Determine if follow-up is needed based on care level and recommendations
 */
function determineFollowUpNeeded(messages: EnhancedMessage[]): boolean {
  // Use the new extractCareLevel function
  const careLevel = extractCareLevel(messages);
  
  // Follow-up needed for urgent/emergency care levels
  if (careLevel && (careLevel === 'emergency' || careLevel === 'urgent')) {
    return true;
  }
  
  // Follow-up needed if recommendations mention scheduling
  const recommendations = extractRecommendations(messages);
  return recommendations.some(rec => 
    rec.toLowerCase().includes('follow') || 
    rec.toLowerCase().includes('schedule') ||
    rec.toLowerCase().includes('appointment')
  );
}

/**
 * Create a visit summary from current conversation
 */
export function createVisitSummary(
  messages: EnhancedMessage[],
  sessionId?: string
): VisitSummary {
  if (messages.length === 0) {
    throw new Error('Cannot create visit summary from empty conversation');
  }
  
  const sessionStart = messages[0].timestamp;
  const lastAssistantMessage = messages
    .filter(m => m.role === 'assistant')
    .pop();
  
  return {
    id: `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    sessionId,
    duration: calculateSessionDuration(messages),
    topics: extractTopics(messages),
    lastThreeExchanges: getLastThreeExchanges(messages),
    careLevel: extractCareLevel(messages),
    emergencyFlags: extractEmergencyFlags(messages),
    keyFindings: extractKeyFindings(messages),
    recommendations: extractRecommendations(messages),
    followUpNeeded: determineFollowUpNeeded(messages),
    metadata: {
      messageCount: messages.length,
      userInitiated: messages[0]?.role === 'user',
      completedSuccessfully: messages.length > 1, // At least one exchange
    },
  };
}

/**
 * Load visit summaries with comprehensive error handling and recovery
 */
export async function loadVisitSummaries(): Promise<VisitSummaryResult<VisitSummaryStorage>> {
  const operation = 'loadVisitSummaries';
  const startTime = Date.now();

  try {
    // Use enhanced storage handler with timeout protection
    const storageResult = await Promise.race([
      safeLocalStorage.getItem(VISIT_SUMMARIES_KEY),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Storage operation timeout')), STORAGE_OPERATION_TIMEOUT)
      )
    ]);

    // Handle empty storage gracefully
    if (!storageResult) {
      const defaultStorage: VisitSummaryStorage = {
        summaries: [],
        lastUpdated: new Date(),
        totalVisits: 0,
        version: CURRENT_SCHEMA_VERSION,
        metadata: {
          storageHealth: 'healthy',
          errorCount: 0,
        },
      };

      return {
        success: true,
        data: defaultStorage,
        metadata: {
          operation,
          timestamp: new Date(),
          storageMethod: 'localStorage',
          retryCount: 0,
        },
      };
    }

    // Data validation and sanitization is handled by the storage error handler
    const validatedStorage = storageResult as VisitSummaryStorage;

    // Ensure schema version and metadata exist
    if (!validatedStorage.version) {
      validatedStorage.version = CURRENT_SCHEMA_VERSION;
    }
    if (!validatedStorage.metadata) {
      validatedStorage.metadata = {
        storageHealth: 'healthy',
        errorCount: 0,
      };
    }

    // Convert string timestamps back to Date objects (migration support)
    validatedStorage.summaries = validatedStorage.summaries.map((summary: any) => ({
      ...summary,
      timestamp: summary.timestamp instanceof Date ? summary.timestamp : new Date(summary.timestamp),
      lastThreeExchanges: (summary.lastThreeExchanges || []).map((exchange: any) => ({
        ...exchange,
        timestamp: exchange.timestamp instanceof Date ? exchange.timestamp : new Date(exchange.timestamp),
      })),
    }));

    validatedStorage.lastUpdated = validatedStorage.lastUpdated instanceof Date 
      ? validatedStorage.lastUpdated 
      : new Date(validatedStorage.lastUpdated);

    // Log successful load for monitoring
    console.log('[VisitSummary] Successfully loaded summaries:', {
      count: validatedStorage.summaries.length,
      version: validatedStorage.version,
      storageHealth: validatedStorage.metadata?.storageHealth,
      loadTime: Date.now() - startTime,
    });

    return {
      success: true,
      data: validatedStorage,
      metadata: {
        operation,
        timestamp: new Date(),
        storageMethod: 'localStorage',
        retryCount: 0,
      },
    };

  } catch (error) {
    // Log error for debugging
    console.error('[VisitSummary] Failed to load visit summaries:', error);

    // Return default data to prevent application crash
    const fallbackStorage: VisitSummaryStorage = {
      summaries: [],
      lastUpdated: new Date(),
      totalVisits: 0,
      version: CURRENT_SCHEMA_VERSION,
      metadata: {
        storageHealth: 'degraded',
        errorCount: 1,
      },
    };

    return {
      success: false,
      data: fallbackStorage,
      error: {
        type: 'storage_error',
        message: `Failed to load visit summaries: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: true,
        fallbackUsed: true,
      },
      metadata: {
        operation,
        timestamp: new Date(),
        storageMethod: 'memory',
        retryCount: 0,
      },
    };
  }
}

/**
 * Synchronous version for backward compatibility (with degraded error handling)
 */
export function loadVisitSummariesSync(): VisitSummaryStorage {
  try {
    // Try to get from localStorage directly for immediate needs
    const stored = localStorage.getItem(VISIT_SUMMARIES_KEY);
    if (!stored) {
      return {
        summaries: [],
        lastUpdated: new Date(),
        totalVisits: 0,
        version: CURRENT_SCHEMA_VERSION,
        metadata: { storageHealth: 'healthy', errorCount: 0 },
      };
    }

    const parsed = JSON.parse(stored);
    
    // Basic date conversion for sync version
    if (parsed.summaries) {
      parsed.summaries = parsed.summaries.map((summary: any) => ({
        ...summary,
        timestamp: new Date(summary.timestamp),
        lastThreeExchanges: (summary.lastThreeExchanges || []).map((exchange: any) => ({
          ...exchange,
          timestamp: new Date(exchange.timestamp),
        })),
      }));
    }
    
    parsed.lastUpdated = new Date(parsed.lastUpdated);
    
    return parsed;
  } catch (error) {
    console.error('[VisitSummary] Sync load failed:', error);
    return {
      summaries: [],
      lastUpdated: new Date(),
      totalVisits: 0,
      version: CURRENT_SCHEMA_VERSION,
      metadata: { storageHealth: 'degraded', errorCount: 1 },
    };
  }
}

/**
 * Save visit summary with comprehensive error handling and recovery
 */
export async function saveVisitSummary(summary: VisitSummary): Promise<VisitSummaryResult<void>> {
  const operation = 'saveVisitSummary';
  const startTime = Date.now();

  try {
    // Input validation
    if (!summary || !summary.id) {
      return {
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid visit summary: missing required fields',
          recoverable: false,
          fallbackUsed: false,
        },
        metadata: {
          operation,
          timestamp: new Date(),
          storageMethod: 'localStorage',
        },
      };
    }

    // Load existing storage with error handling
    const loadResult = await loadVisitSummaries();
    let storage: VisitSummaryStorage;

    if (loadResult.success && loadResult.data) {
      storage = loadResult.data;
    } else {
      // Use fallback storage if load failed
      storage = {
        summaries: [],
        lastUpdated: new Date(),
        totalVisits: 0,
        version: CURRENT_SCHEMA_VERSION,
        metadata: {
          storageHealth: 'degraded',
          errorCount: 1,
        },
      };
    }

    // Check for duplicate summaries (prevent data corruption)
    const existingIndex = storage.summaries.findIndex(s => s.id === summary.id);
    if (existingIndex >= 0) {
      // Update existing summary instead of duplicating
      storage.summaries[existingIndex] = summary;
      console.log('[VisitSummary] Updated existing summary:', summary.id);
    } else {
      // Add new summary
      storage.summaries.push(summary);
      storage.totalVisits += 1;
    }

    // Update metadata
    storage.lastUpdated = new Date();
    storage.version = CURRENT_SCHEMA_VERSION;
    
    // Ensure metadata exists
    if (!storage.metadata) {
      storage.metadata = { storageHealth: 'healthy', errorCount: 0 };
    }

    // Intelligent cleanup to prevent storage bloat
    if (storage.summaries.length > MAX_STORED_SUMMARIES) {
      const removedCount = storage.summaries.length - MAX_STORED_SUMMARIES;
      storage.summaries = storage.summaries
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, MAX_STORED_SUMMARIES);
      
      console.log(`[VisitSummary] Cleaned up ${removedCount} old summaries`);
    }

    // Enhanced save with retry and fallback mechanisms
    const saveSuccess = await safeLocalStorage.setItem(VISIT_SUMMARIES_KEY, storage);
    
    if (saveSuccess) {
      // Log successful save for monitoring
      console.log('[VisitSummary] Successfully saved summary:', {
        id: summary.id,
        topics: summary.topics,
        duration: summary.duration,
        exchangeCount: summary.lastThreeExchanges.length,
        totalSummaries: storage.summaries.length,
        saveTime: Date.now() - startTime,
        storageHealth: storage.metadata?.storageHealth,
      });

      return {
        success: true,
        metadata: {
          operation,
          timestamp: new Date(),
          storageMethod: 'localStorage',
        },
      };
    } else {
      // Save failed - storage handler already logged details
      const healthStatus = safeLocalStorage.getHealthStatus();
      
      return {
        success: false,
        error: {
          type: 'storage_error',
          message: `Failed to save visit summary. Storage: ${healthStatus.storageMethod}`,
          recoverable: true,
          fallbackUsed: healthStatus.fallbackActive,
        },
        metadata: {
          operation,
          timestamp: new Date(),
          storageMethod: healthStatus.storageMethod as any,
        },
      };
    }

  } catch (error) {
    // Log error for debugging
    console.error('[VisitSummary] Critical save error:', error);

    return {
      success: false,
      error: {
        type: 'storage_error',
        message: `Critical save error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: false,
        fallbackUsed: false,
      },
      metadata: {
        operation,
        timestamp: new Date(),
        storageMethod: 'localStorage',
      },
    };
  }
}

/**
 * Synchronous save for backward compatibility (with degraded error handling)
 */
export function saveVisitSummarySync(summary: VisitSummary): boolean {
  try {
    // Basic validation
    if (!summary || !summary.id) {
      console.error('[VisitSummary] Invalid summary provided');
      return false;
    }

    const storage = loadVisitSummariesSync();
    
    // Add new summary
    storage.summaries.push(summary);
    storage.totalVisits += 1;
    storage.lastUpdated = new Date();
    
    // Keep only recent summaries
    if (storage.summaries.length > MAX_STORED_SUMMARIES) {
      storage.summaries = storage.summaries
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, MAX_STORED_SUMMARIES);
    }
    
    localStorage.setItem(VISIT_SUMMARIES_KEY, JSON.stringify(storage));
    
    console.log('[VisitSummary] Sync save successful:', summary.id);
    return true;
  } catch (error) {
    console.error('[VisitSummary] Sync save failed:', error);
    
    // Basic quota exceeded handling
    if (error instanceof DOMException && error.code === 22) {
      try {
        // Emergency cleanup - save only this summary
        const emergencyStorage = {
          summaries: [summary],
          lastUpdated: new Date(),
          totalVisits: 1,
          version: CURRENT_SCHEMA_VERSION,
          metadata: { storageHealth: 'degraded', errorCount: 1 },
        };
        localStorage.setItem(VISIT_SUMMARIES_KEY, JSON.stringify(emergencyStorage));
        console.warn('[VisitSummary] Emergency save after quota exceeded');
        return true;
      } catch (retryError) {
        console.error('[VisitSummary] Emergency save also failed:', retryError);
      }
    }
    
    return false;
  }
}

/**
 * Clear oldest visit summaries with enhanced error handling
 */
export async function clearOldestVisitSummaries(keepCount: number = 5): Promise<VisitSummaryResult<number>> {
  const operation = 'clearOldestVisitSummaries';
  
  try {
    // Load current storage
    const loadResult = await loadVisitSummaries();
    if (!loadResult.success || !loadResult.data) {
      return {
        success: false,
        error: {
          type: 'storage_error',
          message: 'Could not load summaries for cleanup',
          recoverable: true,
          fallbackUsed: false,
        },
        metadata: {
          operation,
          timestamp: new Date(),
          storageMethod: 'localStorage',
        },
      };
    }

    const storage = loadResult.data;
    const originalCount = storage.summaries.length;
    
    // Sort by timestamp and keep only the most recent
    storage.summaries = storage.summaries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, Math.max(1, keepCount)); // Always keep at least 1 summary
    
    const removedCount = originalCount - storage.summaries.length;
    
    // Update metadata
    storage.lastUpdated = new Date();
    if (storage.metadata) {
      storage.metadata.lastCleanup = new Date();
    }
    
    // Save the cleaned storage
    const saveSuccess = await safeLocalStorage.setItem(VISIT_SUMMARIES_KEY, storage);
    
    if (saveSuccess) {
      console.log(`[VisitSummary] Cleanup successful: removed ${removedCount} summaries, kept ${storage.summaries.length}`);
      
      return {
        success: true,
        data: removedCount,
        metadata: {
          operation,
          timestamp: new Date(),
          storageMethod: 'localStorage',
        },
      };
    } else {
      return {
        success: false,
        error: {
          type: 'storage_error',
          message: 'Could not save cleaned summaries',
          recoverable: true,
          fallbackUsed: false,
        },
        metadata: {
          operation,
          timestamp: new Date(),
          storageMethod: 'localStorage',
        },
      };
    }
    
  } catch (error) {
    console.error('[VisitSummary] Cleanup failed:', error);
    
    return {
      success: false,
      error: {
        type: 'storage_error',
        message: `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: false,
        fallbackUsed: false,
      },
      metadata: {
        operation,
        timestamp: new Date(),
        storageMethod: 'localStorage',
      },
    };
  }
}

/**
 * Synchronous cleanup for backward compatibility
 */
export function clearOldestVisitSummariesSync(keepCount: number = 5): number {
  try {
    const storage = loadVisitSummariesSync();
    const originalCount = storage.summaries.length;
    
    // Keep only the most recent summaries
    storage.summaries = storage.summaries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, Math.max(1, keepCount));
    
    storage.lastUpdated = new Date();
    
    localStorage.setItem(VISIT_SUMMARIES_KEY, JSON.stringify(storage));
    
    const removedCount = originalCount - storage.summaries.length;
    console.log(`[VisitSummary] Sync cleanup: removed ${removedCount} summaries`);
    return removedCount;
  } catch (error) {
    console.error('[VisitSummary] Sync cleanup failed:', error);
    return 0;
  }
}

/**
 * Enhanced visit summary statistics with storage health monitoring
 */
export async function getVisitSummaryStats(): Promise<VisitSummaryResult<{
  totalSummaries: number;
  totalStorageSize: number;
  averageSummarySize: number;
  oldestSummary?: Date;
  newestSummary?: Date;
  storageHealth: {
    available: boolean;
    usagePercent: number;
    fallbackActive: boolean;
    storageMethod: string;
    lastCleanup?: Date;
    errorCount?: number;
  };
  schemaVersion?: string;
  corruptedEntries: number;
}>> {
  const operation = 'getVisitSummaryStats';
  
  try {
    // Get storage health status
    const healthStatus = safeLocalStorage.getHealthStatus();
    
    // Load summaries with error handling
    const loadResult = await loadVisitSummaries();
    
    if (!loadResult.success || !loadResult.data) {
      return {
        success: false,
        error: {
          type: 'storage_error',
          message: 'Could not load summaries for stats',
          recoverable: true,
          fallbackUsed: healthStatus.fallbackActive,
        },
        metadata: {
          operation,
          timestamp: new Date(),
          storageMethod: healthStatus.storageMethod as any,
        },
      };
    }

    const storage = loadResult.data;
    
    // Calculate storage size
    let storageSizeBytes = 0;
    try {
      const serialized = JSON.stringify(storage);
      storageSizeBytes = new Blob([serialized]).size;
    } catch {
      storageSizeBytes = 0;
    }
    
    // Extract timestamps for age analysis
    const validTimestamps = storage.summaries
      .map(s => s.timestamp)
      .filter(t => t instanceof Date && !isNaN(t.getTime()));
    
    // Count corrupted entries (summaries that don't meet validation)
    const corruptedEntries = storage.summaries.length - storage.summaries.filter(summary => {
      try {
        return (
          summary &&
          typeof summary.id === 'string' &&
          summary.timestamp instanceof Date &&
          Array.isArray(summary.topics) &&
          Array.isArray(summary.emergencyFlags)
        );
      } catch {
        return false;
      }
    }).length;

    const stats = {
      totalSummaries: storage.summaries.length,
      totalStorageSize: storageSizeBytes,
      averageSummarySize: storage.summaries.length > 0 
        ? Math.round(storageSizeBytes / storage.summaries.length)
        : 0,
      oldestSummary: validTimestamps.length > 0 
        ? new Date(Math.min(...validTimestamps.map(t => t.getTime())))
        : undefined,
      newestSummary: validTimestamps.length > 0
        ? new Date(Math.max(...validTimestamps.map(t => t.getTime())))
        : undefined,
      storageHealth: {
        available: healthStatus.available,
        usagePercent: healthStatus.usagePercent,
        fallbackActive: healthStatus.fallbackActive,
        storageMethod: healthStatus.storageMethod,
        lastCleanup: storage.metadata?.lastCleanup,
        errorCount: storage.metadata?.errorCount || 0,
      },
      schemaVersion: storage.version,
      corruptedEntries,
    };

    console.log('[VisitSummary] Stats collected:', {
      summaries: stats.totalSummaries,
      sizeKB: Math.round(stats.totalStorageSize / 1024),
      health: stats.storageHealth.storageMethod,
      corrupted: stats.corruptedEntries,
    });

    return {
      success: true,
      data: stats,
      metadata: {
        operation,
        timestamp: new Date(),
        storageMethod: healthStatus.storageMethod as any,
      },
    };

  } catch (error) {
    console.error('[VisitSummary] Stats collection failed:', error);

    return {
      success: false,
      error: {
        type: 'storage_error',
        message: `Stats collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: false,
        fallbackUsed: false,
      },
      metadata: {
        operation,
        timestamp: new Date(),
        storageMethod: 'localStorage',
      },
    };
  }
}

/**
 * Synchronous stats for backward compatibility
 */
export function getVisitSummaryStatsSync(): {
  totalSummaries: number;
  totalStorageSize: number;
  averageSummarySize: number;
  oldestSummary?: Date;
  newestSummary?: Date;
  errorCount: number;
} {
  try {
    const storage = loadVisitSummariesSync();
    
    let storageSizeBytes = 0;
    try {
      const serialized = JSON.stringify(storage);
      storageSizeBytes = new Blob([serialized]).size;
    } catch {
      storageSizeBytes = 0;
    }
    
    const timestamps = storage.summaries
      .map(s => s.timestamp)
      .filter(t => t instanceof Date);
    
    return {
      totalSummaries: storage.summaries.length,
      totalStorageSize: storageSizeBytes,
      averageSummarySize: storage.summaries.length > 0 
        ? Math.round(storageSizeBytes / storage.summaries.length)
        : 0,
      oldestSummary: timestamps.length > 0 
        ? new Date(Math.min(...timestamps.map(t => t.getTime())))
        : undefined,
      newestSummary: timestamps.length > 0
        ? new Date(Math.max(...timestamps.map(t => t.getTime())))
        : undefined,
      errorCount: storage.metadata?.errorCount || 0,
    };
  } catch (error) {
    console.error('[VisitSummary] Sync stats failed:', error);
    return {
      totalSummaries: 0,
      totalStorageSize: 0,
      averageSummarySize: 0,
      errorCount: 1,
    };
  }
}

/**
 * Comprehensive storage health check and repair
 */
export async function performStorageHealthCheck(): Promise<VisitSummaryResult<{
  healthStatus: 'healthy' | 'degraded' | 'critical';
  issues: string[];
  repairsPerformed: string[];
  recommendations: string[];
}>> {
  const operation = 'performStorageHealthCheck';
  const issues: string[] = [];
  const repairsPerformed: string[] = [];
  const recommendations: string[] = [];

  try {
    // Check storage availability
    const healthStatus = safeLocalStorage.getHealthStatus();
    if (!healthStatus.available) {
      issues.push('Storage not available');
      recommendations.push('Check browser privacy settings');
    }

    if (healthStatus.fallbackActive) {
      issues.push('Using fallback memory storage');
      recommendations.push('Data will be lost on page refresh');
    }

    if (healthStatus.usagePercent > 80) {
      issues.push(`Storage usage high: ${healthStatus.usagePercent}%`);
      recommendations.push('Run cleanup to free space');
    }

    // Load and validate data
    const loadResult = await loadVisitSummaries();
    if (!loadResult.success) {
      issues.push('Failed to load visit summaries');
      if (loadResult.error?.recoverable) {
        recommendations.push('Try clearing storage and restart');
      }
    } else if (loadResult.data) {
      const storage = loadResult.data;
      
      // Check for corrupted summaries
      const validSummaries = storage.summaries.filter(summary => {
        try {
          return (
            summary &&
            typeof summary.id === 'string' &&
            summary.timestamp instanceof Date &&
            Array.isArray(summary.topics)
          );
        } catch {
          return false;
        }
      });

      const corruptedCount = storage.summaries.length - validSummaries.length;
      if (corruptedCount > 0) {
        issues.push(`${corruptedCount} corrupted summaries found`);
        
        // Auto-repair: remove corrupted summaries
        if (corruptedCount < storage.summaries.length) {
          storage.summaries = validSummaries;
          const saveSuccess = await safeLocalStorage.setItem(VISIT_SUMMARIES_KEY, storage);
          if (saveSuccess) {
            repairsPerformed.push(`Removed ${corruptedCount} corrupted summaries`);
          }
        }
      }

      // Check schema version
      if (!storage.version || storage.version !== CURRENT_SCHEMA_VERSION) {
        issues.push(`Schema version mismatch: ${storage.version} vs ${CURRENT_SCHEMA_VERSION}`);
        recommendations.push('Data migration may be needed');
      }
    }

    // Determine overall health status
    let overallHealth: 'healthy' | 'degraded' | 'critical';
    if (issues.length === 0) {
      overallHealth = 'healthy';
    } else if (issues.some(issue => issue.includes('critical') || issue.includes('not available'))) {
      overallHealth = 'critical';
    } else {
      overallHealth = 'degraded';
    }

    const result = {
      healthStatus: overallHealth,
      issues,
      repairsPerformed,
      recommendations,
    };

    console.log('[VisitSummary] Health check completed:', result);

    return {
      success: true,
      data: result,
      metadata: {
        operation,
        timestamp: new Date(),
        storageMethod: healthStatus.storageMethod as any,
      },
    };

  } catch (error) {
    console.error('[VisitSummary] Health check failed:', error);

    return {
      success: false,
      error: {
        type: 'storage_error',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        recoverable: false,
        fallbackUsed: false,
      },
      metadata: {
        operation,
        timestamp: new Date(),
        storageMethod: 'localStorage',
      },
    };
  }
}