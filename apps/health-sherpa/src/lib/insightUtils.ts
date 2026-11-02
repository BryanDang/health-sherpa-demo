// Insight text helpers. Pure functions, no network.

export type InsightCategory = 'needs-attention' | 'actionable' | 'good-to-know';

export interface CategorizedInsight {
  text: string;
  category: InsightCategory;
  isChecked: boolean;
  isMarkedToDo: boolean;
}

export interface SherpaQuestion {
  text: string;
  priority: 'high' | 'medium' | 'low';
  isChecked: boolean;
  needsProviderInput: boolean;
}

const ATTENTION_WORDS = [
  'urgent',
  'immediate',
  'critical',
  'abnormal',
  'high',
  'elevated',
  'concerning',
  'requires attention',
];

const ACTION_WORDS = [
  'should',
  'recommend',
  'consider',
  'follow up',
  'schedule',
  'monitor',
  'discuss',
];

// One insight per non-empty line. Attention words win over action words.
export function parseAndCategorizeInsights(
  insightsText?: string
): CategorizedInsight[] {
  if (!insightsText) return [];

  return insightsText
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const lower = line.toLowerCase();
      let category: InsightCategory = 'good-to-know';
      if (ATTENTION_WORDS.some((w) => lower.includes(w))) {
        category = 'needs-attention';
      } else if (ACTION_WORDS.some((w) => lower.includes(w))) {
        category = 'actionable';
      }
      return {
        text: line.trim(),
        category,
        isChecked: false,
        isMarkedToDo: false,
      };
    });
}

// Split a block of provider actions into single items.
// Fragments of 10 characters or fewer are dropped.
export function parseProviderActions(actionsText: string): string[] {
  if (!actionsText) return [];
  return actionsText
    .split(/[.;]|\n[\s]*[-•*]|\d+\.\s/)
    .map((a) => a.trim())
    .filter((a) => a.length > 10);
}

export function sortInsightsByPriority(
  insights: CategorizedInsight[]
): CategorizedInsight[] {
  const order = { 'needs-attention': 0, actionable: 1, 'good-to-know': 2 };
  return [...insights].sort((a, b) => order[a.category] - order[b.category]);
}

export function sortQuestionsByPriority(
  questions: SherpaQuestion[]
): SherpaQuestion[] {
  const order = { high: 0, medium: 1, low: 2 };
  return [...questions].sort((a, b) => order[a.priority] - order[b.priority]);
}

export type ConfidenceBand = 'green' | 'yellow' | 'orange' | 'red';

// Bands from the product blueprint: 90 and up, 70 to 89, 50 to 69, below 50.
export function confidenceBand(percent: number): ConfidenceBand {
  if (percent >= 90) return 'green';
  if (percent >= 70) return 'yellow';
  if (percent >= 50) return 'orange';
  return 'red';
}
