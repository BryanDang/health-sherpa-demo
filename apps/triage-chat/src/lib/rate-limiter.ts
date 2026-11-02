/**
 * Centralized Rate Limiter for Google AI API Calls
 * Prevents 429 errors by throttling requests according to model limits
 */

interface ModelLimits {
  rpm: number; // Requests per minute
  delay: number; // Minimum delay between requests (ms)
}

const MODEL_LIMITS: Record<string, ModelLimits> = {
  'gemini-2.0-flash-lite': { rpm: 30, delay: 2000 }, // 30 RPM = 2s delay
  'gemini-2.0-flash': { rpm: 15, delay: 4000 }, // 15 RPM = 4s delay
  'gemini-2.5-flash': { rpm: 10, delay: 6000 }, // 10 RPM = 6s delay
  'gemini-2.5-pro': { rpm: 5, delay: 12000 }, // 5 RPM = 12s delay
  'gemini-1.5-flash': { rpm: 15, delay: 4000 }, // 15 RPM = 4s delay
  'gemini-1.5-flash-8b': { rpm: 15, delay: 4000 }, // 15 RPM = 4s delay
  default: { rpm: 10, delay: 6000 }, // Conservative default
};

class RateLimiter {
  private lastCallTime: number = 0;
  private callQueue: Array<() => Promise<any>> = [];
  private isProcessing: boolean = false;

  /**
   * Make a rate-limited API call
   */
  async throttledCall<T>(
    apiCall: () => Promise<T>,
    modelName?: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queueItem = async () => {
        try {
          const result = await this.executeWithDelay(apiCall, modelName);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      // Add to queue based on priority
      if (priority === 'high') {
        this.callQueue.unshift(queueItem);
      } else {
        this.callQueue.push(queueItem);
      }

      this.processQueue();
    });
  }

  private async executeWithDelay<T>(
    apiCall: () => Promise<T>,
    modelName?: string
  ): Promise<T> {
    const limits = MODEL_LIMITS[modelName || 'default'];
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    // Calculate required delay
    const requiredDelay = Math.max(0, limits.delay - timeSinceLastCall);

    if (requiredDelay > 0) {
      console.log(
        `Rate limiting: waiting ${requiredDelay}ms for ${modelName || 'API'} call`
      );
      await this.wait(requiredDelay);
    }

    this.lastCallTime = Date.now();

    try {
      const result = await this.callWithRetry(apiCall);
      return result;
    } catch (error) {
      console.error('API call failed after retries:', error);
      throw error;
    }
  }

  private async callWithRetry<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        if (error?.status === 429 || error?.message?.includes('429')) {
          if (attempt === maxRetries) {
            throw new Error(`Rate limit exceeded after ${maxRetries} attempts`);
          }

          // Exponential backoff for 429 errors
          const backoffDelay = baseDelay * Math.pow(2, attempt - 1);
          console.log(
            `429 error on attempt ${attempt}, retrying in ${backoffDelay}ms`
          );
          await this.wait(backoffDelay);
          continue;
        }

        // Non-rate-limit errors, don't retry
        throw error;
      }
    }

    throw new Error('Unexpected retry loop completion');
  }

  private async processQueue() {
    if (this.isProcessing || this.callQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.callQueue.length > 0) {
      const queueItem = this.callQueue.shift();
      if (queueItem) {
        await queueItem();
      }
    }

    this.isProcessing = false;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue status for debugging
   */
  getStatus() {
    return {
      queueLength: this.callQueue.length,
      isProcessing: this.isProcessing,
      lastCallTime: this.lastCallTime,
      timeSinceLastCall: Date.now() - this.lastCallTime,
    };
  }

  /**
   * Clear the queue (for testing or emergency reset)
   */
  clearQueue() {
    this.callQueue = [];
    this.isProcessing = false;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Wrapper for Supabase edge function calls with rate limiting
 */
export async function throttledEdgeFunctionCall<T>(
  functionName: string,
  payload: any,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<T> {
  // Extract model name from payload if available for better rate limiting
  const modelName = payload?.model || 'default';

  return rateLimiter.throttledCall(
    async () => {
      const { callEdgeFunctionEnhanced } = await import('./supabase-enhanced');
      return callEdgeFunctionEnhanced(
        functionName,
        payload,
        false
      ) as Promise<T>;
    },
    modelName,
    priority
  );
}

/**
 * Batch process multiple API calls with proper spacing
 */
export async function batchThrottledCalls<T>(
  calls: Array<() => Promise<T>>,
  modelName?: string,
  concurrency: number = 1
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < calls.length; i += concurrency) {
    const batch = calls.slice(i, i + concurrency);

    const batchPromises = batch.map((call) =>
      rateLimiter.throttledCall(call, modelName)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Test helper: check whether a call fits within rate limits
 */
export function canMakeCallNow(modelName?: string): boolean {
  const limits = MODEL_LIMITS[modelName || 'default'];
  const timeSinceLastCall = Date.now() - rateLimiter['lastCallTime'];
  return timeSinceLastCall >= limits.delay;
}

export default rateLimiter;
