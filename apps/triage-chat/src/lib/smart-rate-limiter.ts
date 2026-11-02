/**
 * Smart Rate Limiter with Model Rotation for Gemini Free Tier
 * Handles rate limits by rotating between available models based on usage
 */

interface ModelLimits {
  rpm: number; // Requests per minute
  tpm: number; // Tokens per minute
  rpd: number; // Requests per day
  status: 'active' | 'deprecated';
  useCase: string;
}

interface ModelUsage {
  requestCount: number;
  tokenCount: number;
  dailyRequests: number;
  lastRequestTime: number;
  lastMinuteReset: number;
  lastDayReset: number;
}

const GEMINI_MODEL_LIMITS: Record<string, ModelLimits> = {
  'gemini-2.5-pro': {
    rpm: 5,
    tpm: 250000,
    rpd: 100,
    status: 'active',
    useCase: 'Complex medical reasoning',
  },
  'gemini-2.5-flash': {
    rpm: 10,
    tpm: 250000,
    rpd: 250,
    status: 'active',
    useCase: 'Balanced performance',
  },
  'gemini-2.5-flash-lite': {
    rpm: 15,
    tpm: 250000,
    rpd: 1000,
    status: 'active',
    useCase: 'High volume simple tasks',
  },
  'gemini-2.0-flash': {
    rpm: 15,
    tpm: 1000000,
    rpd: 200,
    status: 'active',
    useCase: 'Primary workhorse',
  },
  'gemini-2.0-flash-lite': {
    rpm: 30,
    tpm: 1000000,
    rpd: 200,
    status: 'active',
    useCase: 'Highest throughput',
  },
  'gemini-1.5-flash': {
    rpm: 15,
    tpm: 250000,
    rpd: 50,
    status: 'deprecated',
    useCase: 'Legacy fallback only',
  },
} as const;

export class SmartRateLimiter {
  private modelUsage: Record<string, ModelUsage> = {};
  private preferredModels: string[];
  private fallbackModels: string[];

  constructor() {
    // Initialize usage tracking for all models
    Object.keys(GEMINI_MODEL_LIMITS).forEach((model) => {
      this.modelUsage[model] = {
        requestCount: 0,
        tokenCount: 0,
        dailyRequests: 0,
        lastRequestTime: 0,
        lastMinuteReset: Date.now(),
        lastDayReset: Date.now(),
      };
    });

    // Define model preferences (active models first, ordered by capability)
    this.preferredModels = [
      'gemini-2.0-flash', // Best balance of performance and limits
      'gemini-2.0-flash-lite', // Highest throughput
      'gemini-2.5-flash', // Good for complex tasks
      'gemini-2.5-flash-lite', // High daily limit
      'gemini-2.5-pro', // Most capable but lowest limits
    ];

    this.fallbackModels = [
      'gemini-1.5-flash', // Deprecated fallback
    ];
  }

  /**
   * Get the best available model for a request
   */
  async getAvailableModel(
    complexity: 'simple' | 'medium' | 'complex' = 'medium'
  ): Promise<string> {
    this.resetCountersIfNeeded();

    // For complex tasks, prefer more capable models
    let modelsToTry =
      complexity === 'complex'
        ? ['gemini-2.5-pro', 'gemini-2.5-flash', ...this.preferredModels]
        : this.preferredModels;

    // Find first available model that hasn't hit limits
    for (const model of modelsToTry) {
      if (this.isModelAvailable(model)) {
        return model;
      }
    }

    // If all preferred models are rate limited, try fallbacks
    for (const model of this.fallbackModels) {
      if (this.isModelAvailable(model)) {
        console.warn(`Using deprecated fallback model: ${model}`);
        return model;
      }
    }

    // If everything is rate limited, wait for the next available slot
    const nextAvailable = this.getNextAvailableTime();
    const waitTime = Math.max(0, nextAvailable - Date.now());

    if (waitTime > 0) {
      console.log(
        `All models rate limited. Waiting ${waitTime}ms for next available slot...`
      );
      await this.sleep(waitTime);
      return this.getAvailableModel(complexity); // Recursive call after waiting
    }

    // Fallback to most permissive model
    return 'gemini-2.0-flash-lite';
  }

  /**
   * Check if a specific model is available (within rate limits)
   */
  private isModelAvailable(model: string): boolean {
    const limits = GEMINI_MODEL_LIMITS[model];
    const usage = this.modelUsage[model];

    if (!limits || !usage) return false;

    // Check RPM limit
    if (usage.requestCount >= limits.rpm) {
      return false;
    }

    // Check daily limit
    if (usage.dailyRequests >= limits.rpd) {
      return false;
    }

    return true;
  }

  /**
   * Record a request for rate limiting tracking
   */
  async recordRequest(
    model: string,
    estimatedTokens: number = 1000
  ): Promise<void> {
    const usage = this.modelUsage[model];
    if (!usage) return;

    const now = Date.now();

    // Record the request
    usage.requestCount++;
    usage.dailyRequests++;
    usage.tokenCount += estimatedTokens;
    usage.lastRequestTime = now;

    // Add minimum delay between requests to avoid burst limits
    const minDelay = this.getMinimumDelay(model);
    if (minDelay > 0) {
      await this.sleep(minDelay);
    }
  }

  /**
   * Get minimum delay between requests for a model
   */
  private getMinimumDelay(model: string): number {
    // DEVELOPMENT: Disable artificial delays for faster testing
    // In production, uncomment the rate limiting logic below
    return 0;
    
    // const limits = GEMINI_MODEL_LIMITS[model];
    // if (!limits) return 1000; // Default 1 second

    // // Calculate minimum delay to stay within RPM limits
    // // Add 10% buffer for safety
    // const minDelayMs = Math.ceil(((60 * 1000) / limits.rpm) * 1.1);
    // return minDelayMs;
  }

  /**
   * Reset counters when time windows expire
   */
  private resetCountersIfNeeded(): void {
    const now = Date.now();

    Object.keys(this.modelUsage).forEach((model) => {
      const usage = this.modelUsage[model];

      // Reset minute counters
      if (now - usage.lastMinuteReset > 60 * 1000) {
        usage.requestCount = 0;
        usage.tokenCount = 0;
        usage.lastMinuteReset = now;
      }

      // Reset daily counters
      if (now - usage.lastDayReset > 24 * 60 * 60 * 1000) {
        usage.dailyRequests = 0;
        usage.lastDayReset = now;
      }
    });
  }

  /**
   * Get the next time when any model will be available
   */
  private getNextAvailableTime(): number {
    let nextTime = Date.now() + 24 * 60 * 60 * 1000; // Default to 24 hours

    Object.entries(this.modelUsage).forEach(([model, usage]) => {
      const limits = GEMINI_MODEL_LIMITS[model];
      if (!limits) return;

      // Time when RPM limit resets
      const nextMinuteReset = usage.lastMinuteReset + 60 * 1000;
      if (nextMinuteReset < nextTime) {
        nextTime = nextMinuteReset;
      }
    });

    return nextTime;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current usage statistics for monitoring
   */
  getUsageStats(): Record<string, { usage: ModelUsage; limits: ModelLimits }> {
    this.resetCountersIfNeeded();

    const stats: Record<string, { usage: ModelUsage; limits: ModelLimits }> =
      {};

    Object.keys(GEMINI_MODEL_LIMITS).forEach((model) => {
      stats[model] = {
        usage: { ...this.modelUsage[model] },
        limits: GEMINI_MODEL_LIMITS[model],
      };
    });

    return stats;
  }

  /**
   * Force wait between test requests for testing scenarios
   */
  async waitForTestScenario(): Promise<void> {
    // DEVELOPMENT: Disable test delays for faster development
    // In production, uncomment the line below
    // await this.sleep(4000);
    return;
  }
}

// Export singleton instance
export const rateLimiter = new SmartRateLimiter();

/**
 * Usage patterns for different request types
 */
export const REQUEST_PATTERNS = {
  EMERGENCY_DETECTION: {
    complexity: 'complex' as const,
    estimatedTokens: 2000,
    priority: 'high',
  },
  SYMPTOM_EXTRACTION: {
    complexity: 'medium' as const,
    estimatedTokens: 1500,
    priority: 'medium',
  },
  CLARIFICATION: {
    complexity: 'simple' as const,
    estimatedTokens: 800,
    priority: 'low',
  },
  CITATION_RESEARCH: {
    complexity: 'complex' as const,
    estimatedTokens: 3000,
    priority: 'medium',
  },
} as const;
