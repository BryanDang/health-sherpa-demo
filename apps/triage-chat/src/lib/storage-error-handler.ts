/**
 * Production-Ready localStorage Error Handler
 * 
 * Comprehensive edge case handling for localStorage operations in medical triage system.
 * Ensures graceful degradation and maintains system reliability even when storage fails.
 * 
 * Key Features:
 * - Storage quota management with automatic cleanup
 * - Corrupted data detection and recovery
 * - Browser compatibility with fallback mechanisms
 * - Concurrent access protection with locks
 * - Data migration support for schema changes
 * - Exponential backoff retry mechanisms
 * - Comprehensive logging for debugging
 */

import type { VisitSummary, VisitSummaryStorage } from './visit-summary';

/**
 * Storage operation result with comprehensive error information
 */
export interface StorageResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    type: 'quota_exceeded' | 'corrupted_data' | 'not_available' | 'concurrent_access' | 'parse_error' | 'unknown';
    message: string;
    code?: string;
    recoverable: boolean;
    fallbackUsed: boolean;
  };
  metadata: {
    operation: string;
    timestamp: Date;
    retryCount: number;
    storageMethod: 'localStorage' | 'sessionStorage' | 'memory' | 'indexedDB';
  };
}

/**
 * Storage configuration with fallback options
 */
interface StorageConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  quotaThresholdPercent: number;
  enableFallbacks: boolean;
  enableConcurrencyProtection: boolean;
  enableDataValidation: boolean;
  enableMigration: boolean;
}

/**
 * In-memory fallback storage for when localStorage fails
 */
class MemoryStorage {
  private storage = new Map<string, string>();
  private maxSize = 50; // Maximum items to store in memory

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    // If at capacity, remove oldest entry
    if (this.storage.size >= this.maxSize) {
      const firstKey = this.storage.keys().next().value;
      if (firstKey) {
        this.storage.delete(firstKey);
      }
    }
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  get length(): number {
    return this.storage.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.storage.keys());
    return keys[index] || null;
  }
}

/**
 * Concurrent access lock manager
 */
class LockManager {
  private locks = new Map<string, Promise<void>>();

  async acquireLock(key: string): Promise<() => void> {
    // Wait for existing lock to be released
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(key, lockPromise);

    return () => {
      this.locks.delete(key);
      releaseLock!();
    };
  }
}

/**
 * Enhanced localStorage error handler with comprehensive edge case management
 */
export class StorageErrorHandler {
  private config: StorageConfig;
  private memoryFallback = new MemoryStorage();
  private lockManager = new LockManager();
  private storageAvailable = {
    localStorage: true,
    sessionStorage: true,
    indexedDB: false, // Simplified for this implementation
  };

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      quotaThresholdPercent: 85,
      enableFallbacks: true,
      enableConcurrencyProtection: true,
      enableDataValidation: true,
      enableMigration: true,
      ...config,
    };

    this.detectStorageAvailability();
  }

  /**
   * Detect which storage mechanisms are available
   */
  private detectStorageAvailability(): void {
    // Test localStorage
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.storageAvailable.localStorage = true;
    } catch {
      this.storageAvailable.localStorage = false;
      this.logError('localStorage not available', 'not_available');
    }

    // Test sessionStorage
    try {
      const testKey = '__storage_test__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      this.storageAvailable.sessionStorage = true;
    } catch {
      this.storageAvailable.sessionStorage = false;
      this.logError('sessionStorage not available', 'not_available');
    }
  }

  /**
   * Get available storage with fallback priority
   */
  private getAvailableStorage(): Storage | MemoryStorage {
    if (this.storageAvailable.localStorage) {
      return localStorage;
    }
    if (this.storageAvailable.sessionStorage) {
      return sessionStorage;
    }
    return this.memoryFallback;
  }

  /**
   * Calculate current storage usage percentage
   */
  private getStorageUsagePercent(): number {
    if (!this.storageAvailable.localStorage) return 0;

    try {
      const used = JSON.stringify(localStorage).length;
      const maxSize = 5 * 1024 * 1024; // Approximate 5MB limit
      return (used / maxSize) * 100;
    } catch {
      return 0;
    }
  }

  /**
   * Check if storage quota is near limit
   */
  private isQuotaNearLimit(): boolean {
    return this.getStorageUsagePercent() > this.config.quotaThresholdPercent;
  }

  /**
   * Validate and migrate data structure
   */
  private validateAndMigrateData(data: any, key: string): any {
    if (!this.config.enableDataValidation) return data;

    try {
      // Basic structure validation for visit summaries
      if (key.includes('visit_summaries')) {
        return this.validateVisitSummaryData(data);
      }
      return data;
    } catch (error) {
      this.logError(`Data validation failed for ${key}: ${error}`, 'corrupted_data');
      throw new Error('Data validation failed');
    }
  }

  /**
   * Validate visit summary data structure
   */
  private validateVisitSummaryData(data: any): VisitSummaryStorage {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data structure');
    }

    // Migration: Handle old data formats
    if (this.config.enableMigration) {
      data = this.migrateVisitSummaryData(data);
    }

    // Validate required fields
    const validatedData: VisitSummaryStorage = {
      summaries: Array.isArray(data.summaries) ? data.summaries : [],
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
      totalVisits: typeof data.totalVisits === 'number' ? data.totalVisits : 0,
    };

    // Validate each summary
    validatedData.summaries = validatedData.summaries
      .filter(this.isValidVisitSummary)
      .map(this.sanitizeVisitSummary);

    return validatedData;
  }

  /**
   * Migrate old data formats to current schema
   */
  private migrateVisitSummaryData(data: any): any {
    // Example migration: Add missing fields for older data
    if (data.summaries) {
      data.summaries = data.summaries.map((summary: any) => {
        // Add metadata if missing (migration from v1.0)
        if (!summary.metadata) {
          summary.metadata = {
            messageCount: summary.messageCount || 0,
            userInitiated: summary.userInitiated !== false,
            completedSuccessfully: true,
          };
        }

        // Ensure all required arrays exist
        if (!summary.emergencyFlags) summary.emergencyFlags = [];
        if (!summary.keyFindings) summary.keyFindings = [];
        if (!summary.recommendations) summary.recommendations = [];
        if (!summary.topics) summary.topics = [];
        if (!summary.lastThreeExchanges) summary.lastThreeExchanges = [];

        return summary;
      });
    }

    return data;
  }

  /**
   * Validate individual visit summary
   */
  private isValidVisitSummary(summary: any): boolean {
    return (
      summary &&
      typeof summary === 'object' &&
      typeof summary.id === 'string' &&
      summary.timestamp &&
      typeof summary.duration === 'number' &&
      Array.isArray(summary.topics) &&
      Array.isArray(summary.lastThreeExchanges) &&
      Array.isArray(summary.emergencyFlags) &&
      Array.isArray(summary.keyFindings) &&
      Array.isArray(summary.recommendations) &&
      typeof summary.followUpNeeded === 'boolean' &&
      summary.metadata &&
      typeof summary.metadata === 'object'
    );
  }

  /**
   * Sanitize visit summary data to prevent XSS and ensure data integrity
   */
  private sanitizeVisitSummary(summary: any): VisitSummary {
    const sanitizeString = (str: string): string => {
      if (typeof str !== 'string') return '';
      // Basic HTML encoding to prevent XSS
      return str
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .slice(0, 1000); // Limit length
    };

    const sanitizeArray = (arr: string[]): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr.slice(0, 10).map(sanitizeString); // Limit array size and sanitize strings
    };

    return {
      id: sanitizeString(summary.id),
      timestamp: new Date(summary.timestamp),
      sessionId: summary.sessionId ? sanitizeString(summary.sessionId) : undefined,
      duration: Math.max(0, Math.min(summary.duration || 0, 60 * 24)), // Max 24 hours
      topics: sanitizeArray(summary.topics),
      lastThreeExchanges: (summary.lastThreeExchanges || []).slice(0, 3).map((exchange: any) => ({
        user: sanitizeString(exchange.user || ''),
        assistant: sanitizeString(exchange.assistant || ''),
        timestamp: new Date(exchange.timestamp || new Date()),
      })),
      careLevel: summary.careLevel ? sanitizeString(summary.careLevel) : undefined,
      emergencyFlags: sanitizeArray(summary.emergencyFlags),
      keyFindings: sanitizeArray(summary.keyFindings),
      recommendations: sanitizeArray(summary.recommendations),
      followUpNeeded: Boolean(summary.followUpNeeded),
      metadata: {
        messageCount: Math.max(0, Math.min(summary.metadata?.messageCount || 0, 1000)),
        userInitiated: Boolean(summary.metadata?.userInitiated),
        completedSuccessfully: Boolean(summary.metadata?.completedSuccessfully),
      },
    };
  }

  /**
   * Clean up corrupted data entries
   */
  private async cleanupCorruptedData(key: string): Promise<void> {
    const storage = this.getAvailableStorage();
    
    try {
      storage.removeItem(key);
      this.logError(`Removed corrupted data for key: ${key}`, 'corrupted_data');
    } catch (error) {
      this.logError(`Failed to cleanup corrupted data for ${key}: ${error}`, 'unknown');
    }
  }

  /**
   * Free up storage space by removing old data
   */
  private async freeUpStorageSpace(): Promise<void> {
    if (!this.storageAvailable.localStorage) return;

    try {
      // Remove non-essential keys first
      const keysToCheck = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.includes('visit_summaries')) {
          keysToCheck.push(key);
        }
      }

      // Remove oldest non-essential items
      keysToCheck.slice(0, Math.max(1, keysToCheck.length / 2)).forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch {
          // Ignore individual removal failures
        }
      });

      this.logError('Freed up storage space by removing non-essential data', 'quota_exceeded');
    } catch (error) {
      this.logError(`Failed to free up storage space: ${error}`, 'quota_exceeded');
    }
  }

  /**
   * Exponential backoff delay calculation
   */
  private calculateDelay(retryCount: number): number {
    const delay = this.config.baseDelayMs * Math.pow(2, retryCount);
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log storage errors for debugging
   */
  private logError(message: string, type: string, context?: any): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      type,
      message,
      context,
      storageAvailability: this.storageAvailable,
      usagePercent: this.getStorageUsagePercent(),
    };

    // In production, this would send to monitoring service
    console.error('[StorageErrorHandler]', errorLog);
  }

  /**
   * Enhanced getItem with comprehensive error handling
   */
  async getItem(key: string): Promise<StorageResult<any>> {
    const operation = `getItem(${key})`;
    let retryCount = 0;
    let lastError: any;

    // Acquire lock for concurrent access protection
    const releaseLock = this.config.enableConcurrencyProtection 
      ? await this.lockManager.acquireLock(key)
      : () => {};

    try {
      while (retryCount <= this.config.maxRetries) {
        try {
          const storage = this.getAvailableStorage();
          const value = storage.getItem(key);
          
          if (value === null) {
            return {
              success: true,
              data: null,
              metadata: {
                operation,
                timestamp: new Date(),
                retryCount,
                storageMethod: this.getStorageMethodName(storage),
              },
            };
          }

          // Parse and validate data
          const parsedData = JSON.parse(value);
          const validatedData = this.validateAndMigrateData(parsedData, key);

          return {
            success: true,
            data: validatedData,
            metadata: {
              operation,
              timestamp: new Date(),
              retryCount,
              storageMethod: this.getStorageMethodName(storage),
            },
          };

        } catch (error) {
          lastError = error;
          retryCount++;

          // Handle specific error types
          if (error instanceof SyntaxError) {
            // Corrupted JSON data
            this.logError(`Corrupted JSON data for ${key}: ${error}`, 'corrupted_data');
            await this.cleanupCorruptedData(key);
            
            return {
              success: false,
              error: {
                type: 'corrupted_data',
                message: 'Data corrupted and removed',
                recoverable: true,
                fallbackUsed: false,
              },
              metadata: {
                operation,
                timestamp: new Date(),
                retryCount,
                storageMethod: 'localStorage',
              },
            };
          }

          // Retry with exponential backoff
          if (retryCount <= this.config.maxRetries) {
            const delay = this.calculateDelay(retryCount - 1);
            await this.sleep(delay);
          }
        }
      }

      // All retries failed
      return {
        success: false,
        error: {
          type: 'unknown',
          message: `Failed after ${this.config.maxRetries} retries: ${lastError?.message}`,
          recoverable: false,
          fallbackUsed: false,
        },
        metadata: {
          operation,
          timestamp: new Date(),
          retryCount,
          storageMethod: 'localStorage',
        },
      };

    } finally {
      releaseLock();
    }
  }

  /**
   * Enhanced setItem with comprehensive error handling
   */
  async setItem(key: string, value: any): Promise<StorageResult<void>> {
    const operation = `setItem(${key})`;
    let retryCount = 0;
    let lastError: any;

    // Acquire lock for concurrent access protection
    const releaseLock = this.config.enableConcurrencyProtection 
      ? await this.lockManager.acquireLock(key)
      : () => {};

    try {
      const serializedValue = JSON.stringify(value);

      while (retryCount <= this.config.maxRetries) {
        try {
          // Check storage quota before attempting to store
          if (this.isQuotaNearLimit()) {
            await this.freeUpStorageSpace();
          }

          const storage = this.getAvailableStorage();
          storage.setItem(key, serializedValue);

          return {
            success: true,
            metadata: {
              operation,
              timestamp: new Date(),
              retryCount,
              storageMethod: this.getStorageMethodName(storage),
            },
          };

        } catch (error) {
          lastError = error;
          retryCount++;

          // Handle quota exceeded error
          if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
            this.logError('Storage quota exceeded', 'quota_exceeded');
            
            // Try to free up space and retry
            await this.freeUpStorageSpace();
            
            if (retryCount <= this.config.maxRetries) {
              const delay = this.calculateDelay(retryCount - 1);
              await this.sleep(delay);
              continue;
            }

            // If all retries failed, try fallback storage
            if (this.config.enableFallbacks) {
              try {
                this.memoryFallback.setItem(key, serializedValue);
                this.logError('Using memory fallback for storage', 'quota_exceeded');
                
                return {
                  success: true,
                  error: {
                    type: 'quota_exceeded',
                    message: 'Used memory fallback due to quota exceeded',
                    recoverable: true,
                    fallbackUsed: true,
                  },
                  metadata: {
                    operation,
                    timestamp: new Date(),
                    retryCount,
                    storageMethod: 'memory',
                  },
                };
              } catch (fallbackError) {
                this.logError(`Memory fallback failed: ${fallbackError}`, 'unknown');
              }
            }
          }

          // Storage not available
          if (error instanceof DOMException && error.name === 'SecurityError') {
            this.storageAvailable.localStorage = false;
            this.logError('localStorage access denied', 'not_available');
            
            // Try sessionStorage fallback
            if (this.config.enableFallbacks && this.storageAvailable.sessionStorage) {
              try {
                sessionStorage.setItem(key, serializedValue);
                return {
                  success: true,
                  error: {
                    type: 'not_available',
                    message: 'Used sessionStorage fallback',
                    recoverable: true,
                    fallbackUsed: true,
                  },
                  metadata: {
                    operation,
                    timestamp: new Date(),
                    retryCount,
                    storageMethod: 'sessionStorage',
                  },
                };
              } catch (sessionError) {
                this.logError(`sessionStorage fallback failed: ${sessionError}`, 'not_available');
              }
            }
          }

          // Retry with exponential backoff for transient errors
          if (retryCount <= this.config.maxRetries) {
            const delay = this.calculateDelay(retryCount - 1);
            await this.sleep(delay);
          }
        }
      }

      // All retries and fallbacks failed
      return {
        success: false,
        error: {
          type: 'unknown',
          message: `Failed after ${this.config.maxRetries} retries: ${lastError?.message}`,
          recoverable: false,
          fallbackUsed: false,
        },
        metadata: {
          operation,
          timestamp: new Date(),
          retryCount,
          storageMethod: 'localStorage',
        },
      };

    } finally {
      releaseLock();
    }
  }

  /**
   * Enhanced removeItem with error handling
   */
  async removeItem(key: string): Promise<StorageResult<void>> {
    const operation = `removeItem(${key})`;
    
    // Acquire lock for concurrent access protection
    const releaseLock = this.config.enableConcurrencyProtection 
      ? await this.lockManager.acquireLock(key)
      : () => {};

    try {
      const storage = this.getAvailableStorage();
      storage.removeItem(key);

      return {
        success: true,
        metadata: {
          operation,
          timestamp: new Date(),
          retryCount: 0,
          storageMethod: this.getStorageMethodName(storage),
        },
      };

    } catch (error) {
      this.logError(`Failed to remove item ${key}: ${error}`, 'unknown');
      
      return {
        success: false,
        error: {
          type: 'unknown',
          message: `Failed to remove item: ${error}`,
          recoverable: false,
          fallbackUsed: false,
        },
        metadata: {
          operation,
          timestamp: new Date(),
          retryCount: 0,
          storageMethod: 'localStorage',
        },
      };
    } finally {
      releaseLock();
    }
  }

  /**
   * Get storage method name for metadata
   */
  private getStorageMethodName(storage: Storage | MemoryStorage): 'localStorage' | 'sessionStorage' | 'memory' | 'indexedDB' {
    if (storage === localStorage) return 'localStorage';
    if (storage === sessionStorage) return 'sessionStorage';
    if (storage instanceof MemoryStorage) return 'memory';
    return 'indexedDB';
  }

  /**
   * Get storage health status
   */
  getStorageHealthStatus(): {
    available: boolean;
    usagePercent: number;
    fallbackActive: boolean;
    errors: number;
    storageMethod: string;
  } {
    const storage = this.getAvailableStorage();
    
    return {
      available: this.storageAvailable.localStorage || this.storageAvailable.sessionStorage,
      usagePercent: this.getStorageUsagePercent(),
      fallbackActive: storage instanceof MemoryStorage,
      errors: 0, // Would track error count in production
      storageMethod: this.getStorageMethodName(storage),
    };
  }

  /**
   * Clear all storage with error handling
   */
  async clearAllStorage(): Promise<StorageResult<void>> {
    try {
      const storage = this.getAvailableStorage();
      if (storage instanceof MemoryStorage) {
        storage.clear();
      } else {
        storage.clear();
      }

      return {
        success: true,
        metadata: {
          operation: 'clearAllStorage',
          timestamp: new Date(),
          retryCount: 0,
          storageMethod: this.getStorageMethodName(storage),
        },
      };

    } catch (error) {
      this.logError(`Failed to clear storage: ${error}`, 'unknown');
      
      return {
        success: false,
        error: {
          type: 'unknown',
          message: `Failed to clear storage: ${error}`,
          recoverable: false,
          fallbackUsed: false,
        },
        metadata: {
          operation: 'clearAllStorage',
          timestamp: new Date(),
          retryCount: 0,
          storageMethod: 'localStorage',
        },
      };
    }
  }
}

/**
 * Global storage error handler instance
 */
export const storageErrorHandler = new StorageErrorHandler({
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
  quotaThresholdPercent: 80,
  enableFallbacks: true,
  enableConcurrencyProtection: true,
  enableDataValidation: true,
  enableMigration: true,
});

/**
 * Convenience wrapper for safe localStorage operations
 */
export const safeLocalStorage = {
  async getItem(key: string): Promise<any> {
    const result = await storageErrorHandler.getItem(key);
    if (result.success) {
      return result.data;
    }
    
    // Log error but don't throw - return null for graceful degradation
    console.warn(`Storage operation failed: ${result.error?.message}`);
    return null;
  },

  async setItem(key: string, value: any): Promise<boolean> {
    const result = await storageErrorHandler.setItem(key, value);
    if (!result.success) {
      console.warn(`Storage operation failed: ${result.error?.message}`);
    }
    return result.success;
  },

  async removeItem(key: string): Promise<boolean> {
    const result = await storageErrorHandler.removeItem(key);
    if (!result.success) {
      console.warn(`Storage operation failed: ${result.error?.message}`);
    }
    return result.success;
  },

  getHealthStatus() {
    return storageErrorHandler.getStorageHealthStatus();
  },
};