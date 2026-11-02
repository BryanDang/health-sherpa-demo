/**
 * Multi-Model Rate Limiter for High Throughput Testing
 *
 * Alternates between high throughput models to maximize test coverage
 * while avoiding rate limits on any single model
 */

interface ModelLimits {
  rpm: number;
  tpm: number;
  rpd: number;
  status: 'active' | 'preview' | 'deprecated';
  useCase: string;
}

export const ALL_GEMINI_MODELS = {
  // Active models (highest priority)
  'gemini-2.0-flash-lite': {
    rpm: 30,
    tpm: 1000000,
    rpd: 200,
    status: 'active',
    useCase: 'Highest throughput',
  },
  'gemma-3': {
    rpm: 30,
    tpm: 15000,
    rpd: 14400,
    status: 'active',
    useCase: 'Ultra-high daily volume',
  },
  'gemma-3n': {
    rpm: 30,
    tpm: 15000,
    rpd: 14400,
    status: 'active',
    useCase: 'Alternative ultra volume',
  },
  'gemini-2.5-flash-lite': {
    rpm: 15,
    tpm: 250000,
    rpd: 1000,
    status: 'preview',
    useCase: 'High-volume simple tasks',
  },
  'gemini-2.0-flash': {
    rpm: 15,
    tpm: 1000000,
    rpd: 200,
    status: 'active',
    useCase: 'Primary workhorse (4x TPM)',
  },
  'gemini-1.5-flash': {
    rpm: 15,
    tpm: 250000,
    rpd: 50,
    status: 'deprecated',
    useCase: 'Last resort fallback',
    deprecationDate: '2025-09-01',
  },
  'gemini-1.5-flash-8b': {
    rpm: 15,
    tpm: 250000,
    rpd: 50,
    status: 'deprecated',
    useCase: 'Last resort fallback',
    deprecationDate: '2025-09-01',
  },
  'gemini-2.5-flash': {
    rpm: 10,
    tpm: 250000,
    rpd: 250,
    status: 'active',
    useCase: 'Balanced performance',
  },
  'gemini-2.0-flash-image-gen': {
    rpm: 10,
    tpm: 200000,
    rpd: 100,
    status: 'preview',
    useCase: 'Future multimodal features',
  },
  'gemini-2.5-pro': {
    rpm: 5,
    tpm: 250000,
    rpd: 100,
    status: 'active',
    useCase: 'Complex reasoning, medical analysis',
  },
} as const;

// Legacy alias for backward compatibility
export const HIGH_THROUGHPUT_MODELS = ALL_GEMINI_MODELS;

export class MultiModelRateLimiter {
  private modelQueue: string[];
  private currentModelIndex = 0;
  private lastCallTimes: Map<string, number> = new Map();
  private dailyCallCounts: Map<string, number> = new Map();
  private lastResetTime = Date.now();

  constructor(models: string[] = ['gemini-2.0-flash-lite', 'gemma-3']) {
    this.modelQueue = models;
    console.log(
      `Multi-model rate limiter initialized with models: ${models.join(', ')}`
    );
  }

  /**
   * Get next available model with optimal rate limiting
   * Alternates between models to achieve ~1 call per second
   */
  async getNextAvailableModel(): Promise<string> {
    // Reset daily counters if new day
    this.resetDailyCountersIfNeeded();

    let attempts = 0;
    const maxAttempts = this.modelQueue.length;

    while (attempts < maxAttempts) {
      const model = this.modelQueue[this.currentModelIndex];
      const limits = HIGH_THROUGHPUT_MODELS[model];

      if (!limits) {
        console.warn(`Unknown model: ${model}, skipping`);
        this.rotateToNextModel();
        attempts++;
        continue;
      }

      // Check daily limit
      const dailyCount = this.dailyCallCounts.get(model) || 0;
      if (dailyCount >= limits.rpd) {
        console.log(
          `Daily limit reached for ${model} (${dailyCount}/${limits.rpd})`
        );
        this.rotateToNextModel();
        attempts++;
        continue;
      }

      // Check rate limit
      const lastCallTime = this.lastCallTimes.get(model) || 0;
      const timeSinceLastCall = Date.now() - lastCallTime;
      const requiredInterval = (60 * 1000) / limits.rpm; // Convert RPM to ms interval

      if (timeSinceLastCall >= requiredInterval) {
        // Model is available
        this.lastCallTimes.set(model, Date.now());
        this.dailyCallCounts.set(model, dailyCount + 1);

        console.log(
          `Using ${model} (${dailyCount + 1}/${limits.rpd} daily, ${limits.rpm} RPM)`
        );

        // Rotate to next model for load balancing
        this.rotateToNextModel();
        return model;
      } else {
        // Model rate limited, try next
        const waitTime = requiredInterval - timeSinceLastCall;
        console.log(`⏳ ${model} rate limited, need to wait ${waitTime}ms`);
        this.rotateToNextModel();
        attempts++;
      }
    }

    // If all models are rate limited, wait for the shortest interval
    const nextAvailableModel = await this.waitForNextAvailableModel();
    return nextAvailableModel;
  }

  /**
   * Strategy for maximum throughput testing
   * Alternates every call to achieve ~60 calls/min total
   */
  async getModelForHighThroughputTest(): Promise<string> {
    // Use the two highest RPM models in alternation
    const highThroughputModels = ['gemini-2.0-flash-lite', 'gemma-3'];
    const model = highThroughputModels[this.currentModelIndex % 2];

    const limits = HIGH_THROUGHPUT_MODELS[model];
    const lastCallTime = this.lastCallTimes.get(model) || 0;
    const timeSinceLastCall = Date.now() - lastCallTime;
    const requiredInterval = (60 * 1000) / limits.rpm;

    if (timeSinceLastCall < requiredInterval) {
      const waitTime = requiredInterval - timeSinceLastCall;
      console.log(`⏳ High throughput: waiting ${waitTime}ms for ${model}`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastCallTimes.set(model, Date.now());
    this.currentModelIndex = (this.currentModelIndex + 1) % 2;

    const dailyCount = this.dailyCallCounts.get(model) || 0;
    this.dailyCallCounts.set(model, dailyCount + 1);

    console.log(
      `High throughput: ${model} (${dailyCount + 1}/${limits.rpd} daily)`
    );
    return model;
  }

  /**
   * Get model optimized for specific test scenario
   */
  getModelForScenario(scenario: 'precision' | 'volume' | 'speed'): string {
    switch (scenario) {
      case 'precision':
        return 'gemini-2.5-flash'; // Higher quality for medical precision
      case 'volume':
        return 'gemma-3'; // Ultra-high daily volume
      case 'speed':
        return 'gemini-2.0-flash-lite'; // Highest RPM
      default:
        return 'gemini-2.0-flash';
    }
  }

  private rotateToNextModel(): void {
    this.currentModelIndex =
      (this.currentModelIndex + 1) % this.modelQueue.length;
  }

  private resetDailyCountersIfNeeded(): void {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (timeSinceReset >= oneDayMs) {
      console.log('Resetting daily counters');
      this.dailyCallCounts.clear();
      this.lastResetTime = now;
    }
  }

  private async waitForNextAvailableModel(): Promise<string> {
    const waitTimes = this.modelQueue.map((model) => {
      const limits = HIGH_THROUGHPUT_MODELS[model];
      const lastCallTime = this.lastCallTimes.get(model) || 0;
      const requiredInterval = (60 * 1000) / limits.rpm;
      const timeSinceLastCall = Date.now() - lastCallTime;
      return Math.max(0, requiredInterval - timeSinceLastCall);
    });

    const shortestWait = Math.min(...waitTimes);
    const modelIndex = waitTimes.indexOf(shortestWait);

    if (shortestWait > 0) {
      console.log(`⏳ All models rate limited, waiting ${shortestWait}ms`);
      await new Promise((resolve) => setTimeout(resolve, shortestWait));
    }

    return this.modelQueue[modelIndex];
  }

  /**
   * Get current status of all models
   */
  getStatus(): Record<string, any> {
    const status = {};

    this.modelQueue.forEach((model) => {
      const limits = HIGH_THROUGHPUT_MODELS[model];
      const lastCallTime = this.lastCallTimes.get(model) || 0;
      const dailyCount = this.dailyCallCounts.get(model) || 0;
      const timeSinceLastCall = Date.now() - lastCallTime;
      const requiredInterval = (60 * 1000) / limits.rpm;

      status[model] = {
        available:
          timeSinceLastCall >= requiredInterval && dailyCount < limits.rpd,
        dailyUsage: `${dailyCount}/${limits.rpd}`,
        lastCallAgo: `${Math.round(timeSinceLastCall / 1000)}s`,
        nextAvailableIn: Math.max(0, requiredInterval - timeSinceLastCall),
      };
    });

    return status;
  }
}

// Singleton instance for test coordination
export const testRateLimiter = new MultiModelRateLimiter([
  'gemini-2.0-flash-lite', // 30 RPM - Highest
  'gemma-3', // 30 RPM - Ultra volume
  'gemini-2.5-flash-lite', // 15 RPM - High volume
  'gemini-2.0-flash', // 15 RPM - Primary
]);

/**
 * Test helper for rate-limited API calls
 */
export async function rateLimitedApiCall<T>(
  apiCall: (model: string) => Promise<T>,
  scenario: 'precision' | 'volume' | 'speed' = 'speed'
): Promise<T & { modelUsed: string }> {
  const model =
    scenario === 'speed'
      ? await testRateLimiter.getModelForHighThroughputTest()
      : await testRateLimiter.getNextAvailableModel();

  const result = await apiCall(model);

  return {
    ...result,
    modelUsed: model,
  };
}

/**
 * Parallel test execution with model distribution
 */
export async function executeParallelTests<T>(
  testCalls: Array<(model: string) => Promise<T>>,
  maxConcurrency: number = 4
): Promise<Array<T & { modelUsed: string }>> {
  const results: Array<T & { modelUsed: string }> = [];

  for (let i = 0; i < testCalls.length; i += maxConcurrency) {
    const batch = testCalls.slice(i, i + maxConcurrency);

    const batchPromises = batch.map(async (testCall) => {
      const model = await testRateLimiter.getNextAvailableModel();
      const result = await testCall(model);
      return { ...result, modelUsed: model };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches to respect rate limits
    if (i + maxConcurrency < testCalls.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
