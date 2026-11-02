/**
 * Cost Calculator for Google Gemini API Usage
 * Accurate pricing based on official Google AI pricing (as of 2025)
 */

// Official Google AI pricing per 1M tokens (USD)
// Updated based on latest pricing tiers and models
export const GEMINI_PRICING = {
  // Gemini 2.0 Flash models (current generation)
  'gemini-2.0-flash': {
    inputPerMillion: 0.075, // $0.075 per 1M input tokens
    outputPerMillion: 0.3, // $0.30 per 1M output tokens
    name: 'Gemini 2.0 Flash',
  },
  'gemini-2.0-flash-lite': {
    inputPerMillion: 0.0375, // $0.0375 per 1M input tokens (half price)
    outputPerMillion: 0.15, // $0.15 per 1M output tokens (half price)
    name: 'Gemini 2.0 Flash Lite',
  },

  // Gemini 2.5 models (premium tier)
  'gemini-2.5-pro': {
    inputPerMillion: 1.25, // $1.25 per 1M input tokens (premium)
    outputPerMillion: 5.0, // $5.00 per 1M output tokens (premium)
    name: 'Gemini 2.5 Pro',
  },
  'gemini-2.5-flash': {
    inputPerMillion: 0.075, // $0.075 per 1M input tokens
    outputPerMillion: 0.3, // $0.30 per 1M output tokens
    name: 'Gemini 2.5 Flash',
  },
  'gemini-2.5-flash-lite': {
    inputPerMillion: 0.0375, // $0.0375 per 1M input tokens
    outputPerMillion: 0.15, // $0.15 per 1M output tokens
    name: 'Gemini 2.5 Flash Lite',
  },

  // Gemma models (open source, lower cost)
  'gemma-3': {
    inputPerMillion: 0.05, // $0.05 per 1M input tokens (cost-effective)
    outputPerMillion: 0.1, // $0.10 per 1M output tokens (cost-effective)
    name: 'Gemma 3',
  },
  'gemma-3n': {
    inputPerMillion: 0.05, // $0.05 per 1M input tokens
    outputPerMillion: 0.1, // $0.10 per 1M output tokens
    name: 'Gemma 3n',
  },

  // Deprecated models (higher cost for legacy usage)
  'gemini-1.5-flash': {
    inputPerMillion: 0.075, // $0.075 per 1M input tokens
    outputPerMillion: 0.3, // $0.30 per 1M output tokens
    name: 'Gemini 1.5 Flash (Deprecated)',
  },
  'gemini-1.5-flash-8b': {
    inputPerMillion: 0.0375, // $0.0375 per 1M input tokens
    outputPerMillion: 0.15, // $0.15 per 1M output tokens
    name: 'Gemini 1.5 Flash 8B (Deprecated)',
  },

  // Multimodal models (preview pricing)
  'gemini-2.0-flash-image-gen': {
    inputPerMillion: 0.075, // $0.075 per 1M input tokens
    outputPerMillion: 0.3, // $0.30 per 1M output tokens
    name: 'Gemini 2.0 Flash Image Gen (Preview)',
  },
} as const;

export interface CostCalculation {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUSD: number;
  outputCostUSD: number;
  totalCostUSD: number;
  modelUsed: string;
  modelName: string;
  priceBreakdown: {
    inputRate: number;
    outputRate: number;
    calculation: string;
  };
}

export interface UsageMetrics {
  tokensUsed: number;
  estimatedCostUSD: number;
  requestType?:
    | 'symptom_extraction'
    | 'quick_triage'
    | 'complex_analysis'
    | 'final_response';
  cacheHit?: boolean;
}

/**
 * Calculate cost for Gemini API usage
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): CostCalculation {
  // Get pricing for the model (default to gemini-2.0-flash if unknown)
  const pricing =
    GEMINI_PRICING[modelId as keyof typeof GEMINI_PRICING] ||
    GEMINI_PRICING['gemini-2.0-flash'];

  // Calculate costs
  const inputCostUSD = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCostUSD = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputCostUSD: Math.round(inputCostUSD * 100000) / 100000, // Round to 5 decimals
    outputCostUSD: Math.round(outputCostUSD * 100000) / 100000,
    totalCostUSD: Math.round(totalCostUSD * 100000) / 100000,
    modelUsed: modelId,
    modelName: pricing.name,
    priceBreakdown: {
      inputRate: pricing.inputPerMillion,
      outputRate: pricing.outputPerMillion,
      calculation: `$${inputCostUSD.toFixed(5)} (input) + $${outputCostUSD.toFixed(5)} (output)`,
    },
  };
}

/**
 * Estimate cost before API call (for budgeting)
 */
export function estimateCost(
  modelId: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): {
  estimatedCostUSD: number;
  budgetWarning?: string;
} {
  const calculation = calculateCost(
    modelId,
    estimatedInputTokens,
    estimatedOutputTokens
  );

  let budgetWarning: string | undefined;

  // Budget warnings
  if (calculation.totalCostUSD > 0.1) {
    budgetWarning =
      'High cost request (>$0.10) - consider using a more cost-effective model';
  } else if (calculation.totalCostUSD > 0.05) {
    budgetWarning = 'Medium cost request (>$0.05) - monitor usage';
  }

  return {
    estimatedCostUSD: calculation.totalCostUSD,
    budgetWarning,
  };
}

/**
 * Get most cost-effective model for a given task type
 */
export function getMostCostEffectiveModel(
  taskType:
    | 'symptom_extraction'
    | 'quick_triage'
    | 'complex_analysis'
    | 'final_response'
): {
  modelId: string;
  modelName: string;
  reasoning: string;
} {
  switch (taskType) {
    case 'symptom_extraction':
      return {
        modelId: 'gemma-3',
        modelName: GEMINI_PRICING['gemma-3'].name,
        reasoning: 'Simple extraction task - use most cost-effective model',
      };

    case 'quick_triage':
      return {
        modelId: 'gemini-2.0-flash-lite',
        modelName: GEMINI_PRICING['gemini-2.0-flash-lite'].name,
        reasoning: 'Balanced performance and cost for routine triage',
      };

    case 'complex_analysis':
      return {
        modelId: 'gemini-2.0-flash',
        modelName: GEMINI_PRICING['gemini-2.0-flash'].name,
        reasoning: 'Full capability model for complex medical analysis',
      };

    case 'final_response':
      return {
        modelId: 'gemini-2.0-flash',
        modelName: GEMINI_PRICING['gemini-2.0-flash'].name,
        reasoning: 'High quality response generation with balanced cost',
      };

    default:
      return {
        modelId: 'gemini-2.0-flash',
        modelName: GEMINI_PRICING['gemini-2.0-flash'].name,
        reasoning: 'Default balanced model for unknown task types',
      };
  }
}

/**
 * Track cumulative costs across multiple requests
 */
export class CostTracker {
  private dailyCosts: Map<string, number> = new Map();
  private monthlyCosts: Map<string, number> = new Map();
  private lastDailyReset = new Date().getDate();
  private lastMonthlyReset = new Date().getMonth();

  addCost(modelId: string, costUSD: number): void {
    const currentDay = new Date().getDate();
    const currentMonth = new Date().getMonth();

    // Reset daily costs if new day
    if (currentDay !== this.lastDailyReset) {
      this.dailyCosts.clear();
      this.lastDailyReset = currentDay;
    }

    // Reset monthly costs if new month
    if (currentMonth !== this.lastMonthlyReset) {
      this.monthlyCosts.clear();
      this.lastMonthlyReset = currentMonth;
    }

    // Add to tracking
    const currentDaily = this.dailyCosts.get(modelId) || 0;
    const currentMonthly = this.monthlyCosts.get(modelId) || 0;

    this.dailyCosts.set(modelId, currentDaily + costUSD);
    this.monthlyCosts.set(modelId, currentMonthly + costUSD);
  }

  getDailyCosts(): Record<string, number> {
    return Object.fromEntries(this.dailyCosts);
  }

  getMonthlyCosts(): Record<string, number> {
    return Object.fromEntries(this.monthlyCosts);
  }

  getTotalDailyCost(): number {
    return Array.from(this.dailyCosts.values()).reduce(
      (sum, cost) => sum + cost,
      0
    );
  }

  getTotalMonthlyCost(): number {
    return Array.from(this.monthlyCosts.values()).reduce(
      (sum, cost) => sum + cost,
      0
    );
  }

  checkBudgetLimits(
    dailyLimit: number = 5.0,
    monthlyLimit: number = 100.0
  ): {
    dailyExceeded: boolean;
    monthlyExceeded: boolean;
    warnings: string[];
  } {
    const dailyTotal = this.getTotalDailyCost();
    const monthlyTotal = this.getTotalMonthlyCost();
    const warnings: string[] = [];

    if (dailyTotal > dailyLimit * 0.8) {
      warnings.push(
        `Approaching daily budget limit: $${dailyTotal.toFixed(4)} / $${dailyLimit}`
      );
    }

    if (monthlyTotal > monthlyLimit * 0.8) {
      warnings.push(
        `Approaching monthly budget limit: $${monthlyTotal.toFixed(2)} / $${monthlyLimit}`
      );
    }

    return {
      dailyExceeded: dailyTotal > dailyLimit,
      monthlyExceeded: monthlyTotal > monthlyLimit,
      warnings,
    };
  }
}

// Global cost tracker instance
const globalCostTracker = new CostTracker();

export function getGlobalCostTracker(): CostTracker {
  return globalCostTracker;
}

/**
 * Convert token usage from API response to cost metrics
 */
export function createUsageMetrics(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  requestType?:
    | 'symptom_extraction'
    | 'quick_triage'
    | 'complex_analysis'
    | 'final_response',
  cacheHit?: boolean
): UsageMetrics {
  const calculation = calculateCost(modelId, inputTokens, outputTokens);

  // Add to global tracker
  globalCostTracker.addCost(modelId, calculation.totalCostUSD);

  return {
    tokensUsed: calculation.totalTokens,
    estimatedCostUSD: calculation.totalCostUSD,
    requestType,
    cacheHit,
  };
}

/**
 * Format cost for display
 */
export function formatCost(costUSD: number): string {
  if (costUSD < 0.0001) {
    return '<$0.0001';
  } else if (costUSD < 0.01) {
    return `$${costUSD.toFixed(4)}`;
  } else {
    return `$${costUSD.toFixed(2)}`;
  }
}

/**
 * Get cost efficiency metrics
 */
export function getCostEfficiencyMetrics(
  costs: CostCalculation[],
  timeWindowHours: number = 24
): {
  averageCostPerRequest: number;
  mostExpensiveModel: string;
  mostEfficientModel: string;
  totalCostUSD: number;
  costTrends: {
    model: string;
    cost: number;
    requestCount: number;
  }[];
} {
  if (costs.length === 0) {
    return {
      averageCostPerRequest: 0,
      mostExpensiveModel: 'none',
      mostEfficientModel: 'none',
      totalCostUSD: 0,
      costTrends: [],
    };
  }

  const totalCost = costs.reduce((sum, calc) => sum + calc.totalCostUSD, 0);
  const averageCost = totalCost / costs.length;

  // Group by model
  const byModel = costs.reduce(
    (acc, calc) => {
      if (!acc[calc.modelUsed]) {
        acc[calc.modelUsed] = { cost: 0, count: 0 };
      }
      acc[calc.modelUsed].cost += calc.totalCostUSD;
      acc[calc.modelUsed].count += 1;
      return acc;
    },
    {} as Record<string, { cost: number; count: number }>
  );

  // Find most expensive and most efficient
  const modelEfficiency = Object.entries(byModel).map(([model, data]) => ({
    model,
    averageCost: data.cost / data.count,
    totalCost: data.cost,
    requestCount: data.count,
  }));

  const mostExpensive = modelEfficiency.reduce((prev, curr) =>
    curr.averageCost > prev.averageCost ? curr : prev
  );

  const mostEfficient = modelEfficiency.reduce((prev, curr) =>
    curr.averageCost < prev.averageCost ? curr : prev
  );

  return {
    averageCostPerRequest: averageCost,
    mostExpensiveModel: mostExpensive.model,
    mostEfficientModel: mostEfficient.model,
    totalCostUSD: totalCost,
    costTrends: modelEfficiency.map((m) => ({
      model: m.model,
      cost: m.totalCost,
      requestCount: m.requestCount,
    })),
  };
}
