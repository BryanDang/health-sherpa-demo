import { createMockBackend } from '@/lib/backend/mock';

describe('mock backend', () => {
  const backend = createMockBackend();

  test('flags an emergency phrase', async () => {
    const r = await backend.triage.processMessage('I have chest pain', [], null);
    expect(r.updated_memory.emergencyFlags).toContain('chest pain');
    expect(r.assistant_message).toContain('Sample data. Not medical advice.');
  });

  test('asks a follow-up question first, then gives a recommendation', async () => {
    const first = await backend.triage.processMessage('a mild cough', [], null);
    expect(first.assistant_message).toContain('?');
    const second = await backend.triage.processMessage('two days, mild', [{} as any], first.updated_memory);
    expect(second.updated_reasoning.plan.toLowerCase()).toContain('recommend');
  });

  test('geocodes five digit zip codes only', async () => {
    expect(await backend.geocode.geocode('12345')).not.toBeNull();
    expect(await backend.geocode.geocode('abc')).toBeNull();
  });

  test('returns sorted sample prices', async () => {
    const r = await backend.prices.lookup({
      latitude: 40, longitude: -100, serviceCode: '99213',
      serviceType: 'urgent_care_visit', radiusMeters: 25000, paymentType: 'cash',
    });
    expect(r.dataSource).toBe('sample_data');
    const prices = r.providers.map((p) => p.pricing.cashPrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});
