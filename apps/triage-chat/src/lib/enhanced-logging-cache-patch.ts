/**
 * Cache Logging Extension for Enhanced Logger
 * This patch adds response caching event logging capabilities
 */

// Add this method to the EnhancedLogger class
export const cacheLoggingMethod = `
  /**
   * Log response caching events
   */
  logCacheEvent(
    userId: string,
    sessionId: string,
    cacheEvent: {
      operation: 'hit' | 'miss' | 'store';
      inputHash: string;
      urgencyLevel: 'emergency' | 'urgent' | 'routine' | 'self-care';
      modelUsed: string;
      responseTime?: number;
      hitCount?: number;
    },
    metadata?: Record<string, any>
  ): void {
    this.log('info', 'response_caching', \`Cache \${cacheEvent.operation}\`, {
      ...cacheEvent,
      ...metadata
    }, userId, sessionId);
    
    // Track cache performance for analytics
    if (cacheEvent.operation === 'hit' && cacheEvent.responseTime) {
      // Cache hit should be much faster than normal response
      if (cacheEvent.responseTime > 1000) { // 1 second
        this.log('warn', 'response_caching', 'Slow cache response detected', {
          responseTime: cacheEvent.responseTime,
          inputHash: cacheEvent.inputHash
        }, userId, sessionId);
      }
    }
  }
`;

// Add this convenience function at the end of the file
export const cacheLoggingConvenienceFunction = `
export function logCache(userId: string, sessionId: string, cacheEvent: {
  operation: 'hit' | 'miss' | 'store';
  inputHash: string;
  urgencyLevel: 'emergency' | 'urgent' | 'routine' | 'self-care';
  modelUsed: string;
  responseTime?: number;
  hitCount?: number;
}, metadata?: Record<string, any>): void {
  getLogger().logCacheEvent(userId, sessionId, cacheEvent, metadata);
}
`;

// Manual integration:
// 1. Add 'response_caching' to LogCategory type union
// 2. Add cacheHit and estimatedCostUSD to PerformanceMetrics interface
// 3. Add 'response_caching' to enableAllCategories() array
// 4. Add the logCacheEvent method to EnhancedLogger class
// 5. Add the logCache convenience function at the end
