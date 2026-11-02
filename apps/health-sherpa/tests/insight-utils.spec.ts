// Pure helper tests. No browser and no server needed.
import { test, expect } from '@playwright/test';
import {
  confidenceBand,
  parseAndCategorizeInsights,
  parseProviderActions,
  sortInsightsByPriority,
  sortQuestionsByPriority,
} from '../src/lib/insightUtils';

test.describe('parseAndCategorizeInsights', () => {
  test('returns an empty list for missing text', () => {
    expect(parseAndCategorizeInsights(undefined)).toEqual([]);
    expect(parseAndCategorizeInsights('')).toEqual([]);
  });

  test('skips blank lines and trims', () => {
    const out = parseAndCategorizeInsights('  one note  \n\n   \ntwo note');
    expect(out.map((i) => i.text)).toEqual(['one note', 'two note']);
  });

  test('sorts lines into categories', () => {
    const out = parseAndCategorizeInsights(
      [
        'Glucose is elevated',
        'Consider a follow up visit',
        'Sample taken in the morning',
      ].join('\n')
    );
    expect(out.map((i) => i.category)).toEqual([
      'needs-attention',
      'actionable',
      'good-to-know',
    ]);
  });

  test('attention words win over action words', () => {
    const [item] = parseAndCategorizeInsights('You should act, this is urgent');
    expect(item.category).toBe('needs-attention');
  });
});

test.describe('parseProviderActions', () => {
  test('splits on periods and semicolons', () => {
    expect(
      parseProviderActions('Order a repeat panel; Review medication list.')
    ).toEqual(['Order a repeat panel', 'Review medication list']);
  });

  test('drops short fragments and empty input', () => {
    expect(parseProviderActions('')).toEqual([]);
    expect(parseProviderActions('Ok. Repeat the panel in two weeks')).toEqual([
      'Repeat the panel in two weeks',
    ]);
  });
});

test.describe('sorting', () => {
  test('insights go attention, action, then info', () => {
    const items = parseAndCategorizeInsights('fine note\nurgent note\nplan to monitor');
    expect(sortInsightsByPriority(items).map((i) => i.category)).toEqual([
      'needs-attention',
      'actionable',
      'good-to-know',
    ]);
  });

  test('questions go high, medium, low and input is not changed', () => {
    const qs = (['low', 'high', 'medium'] as const).map((priority) => ({
      text: priority,
      priority,
      isChecked: false,
      needsProviderInput: false,
    }));
    expect(sortQuestionsByPriority(qs).map((q) => q.priority)).toEqual([
      'high',
      'medium',
      'low',
    ]);
    expect(qs.map((q) => q.priority)).toEqual(['low', 'high', 'medium']);
  });
});

test.describe('confidenceBand', () => {
  test('uses the blueprint thresholds', () => {
    expect(confidenceBand(100)).toBe('green');
    expect(confidenceBand(90)).toBe('green');
    expect(confidenceBand(89)).toBe('yellow');
    expect(confidenceBand(70)).toBe('yellow');
    expect(confidenceBand(69)).toBe('orange');
    expect(confidenceBand(50)).toBe('orange');
    expect(confidenceBand(49)).toBe('red');
    expect(confidenceBand(0)).toBe('red');
  });
});
