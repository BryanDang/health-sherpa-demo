/**
 * Mock backend. Runs with no network and no credentials.
 * Sample data. Not medical advice.
 */

import type {
  Backend,
  GeocodeBackend,
  PriceBackend,
  PriceQuery,
  PriceResult,
  TriageBackend,
} from './types';
import type { StatefulLLMResponse } from '../stateful-llm-interface';
import { SAMPLE_REGION } from './fixtures/zips';
import {
  SAMPLE_BASE_PRICE,
  SAMPLE_FACILITIES,
  SAMPLE_KIND_FACTOR,
} from './fixtures/prices';
import { distanceMiles, serviceDescription } from './price-helpers';

const EMERGENCY_TERMS = [
  'chest pain',
  "can't breathe",
  'cannot breathe',
  'trouble breathing',
  'shortness of breath',
  'stroke',
  'seizure',
  'unconscious',
  'severe bleeding',
  'overdose',
];

const URGENT_TERMS = ['fever', 'infection', 'sprain', 'fracture', 'broken', 'vomiting', 'burning'];

const SPANISH_HINTS = /[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00bf\u00a1]|\b(tengo|dolor|desde|ayer|me duele|fiebre|cabeza|estoy|garganta|pecho|ayuda)\b/i;
const NOTICE_ES = 'Datos de muestra. No es consejo médico.';

const NOTICE = 'Sample data. Not medical advice.';

function memoryFrom(current: unknown) {
  const base =
    current && typeof current === 'object'
      ? (current as Record<string, unknown>)
      : {};
  return {
    symptoms: Array.isArray(base.symptoms) ? (base.symptoms as any[]) : [],
    medicalHistory: Array.isArray(base.medicalHistory) ? (base.medicalHistory as string[]) : [],
    medications: Array.isArray(base.medications) ? (base.medications as string[]) : [],
    allergies: Array.isArray(base.allergies) ? (base.allergies as string[]) : [],
    emergencyFlags: Array.isArray(base.emergencyFlags) ? (base.emergencyFlags as string[]) : [],
    lastUpdate: new Date().toISOString(),
  };
}

export class MockTriage implements TriageBackend {
  async processMessage(
    message: string,
    recentExchanges: unknown[] = [],
    currentMemory: unknown = null
  ): Promise<StatefulLLMResponse> {
    const text = message.toLowerCase();
    const memory = memoryFrom(currentMemory);
    const now = new Date().toISOString();
    memory.symptoms = [
      ...memory.symptoms,
      { description: message.slice(0, 200), severity: 5, onset: 'unspecified', timestamp: now },
    ];

    if (SPANISH_HINTS.test(message) && !EMERGENCY_TERMS.some((t) => text.includes(t))) {
      memory.symptoms = memory.symptoms.slice(0, -1).concat({
        description: message.slice(0, 200),
        severity: 5,
        onset: 'unspecified',
        timestamp: now,
      });
      return {
        updated_reasoning: {
          plan: 'Reply in Spanish.',
          steps: ['Detected Spanish text'],
          observations: ['Language: es'],
          confidence: 0.5,
        },
        assistant_message: `Gracias por contarme. Parece manejable con descanso y líquidos. Si dura más de unos días, consulte a un médico. En una emergencia, llame al 911. ${NOTICE_ES}`,
        updated_memory: memory,
      };
    }

    const emergency = EMERGENCY_TERMS.find((t) => text.includes(t));
    if (emergency) {
      memory.emergencyFlags = [...memory.emergencyFlags, emergency];
      return {
        updated_reasoning: {
          plan: 'Recommend emergency care now.',
          steps: ['Matched an emergency phrase', 'Advise calling emergency services'],
          observations: [`Reported: ${emergency}`],
          confidence: 0.9,
        },
        assistant_message: `This could be serious. I recommend emergency care now: call 911 or go to the nearest emergency department. ${NOTICE}`,
        updated_memory: memory,
      };
    }

    const answered = recentExchanges.length >= 1;
    if (!answered) {
      return {
        updated_reasoning: {
          plan: 'Gather more information about onset and severity.',
          steps: ['Ask when it started', 'Ask how bad it is'],
          observations: ['Initial description received'],
          confidence: 0.4,
          unanswered_questions: ['Is a clinician exam needed to rule out a serious cause?'],
        } as StatefulLLMResponse['updated_reasoning'],
        assistant_message: `Thanks for sharing that. When did it start, and how severe is it on a scale of 1 to 10? ${NOTICE}`,
        updated_memory: memory,
      };
    }

    const urgent = URGENT_TERMS.some((t) => text.includes(t));
    return {
      updated_reasoning: {
        plan: urgent
          ? 'Recommend urgent care within 24 hours.'
          : 'Recommend self-care and a primary care follow-up if it persists.',
        steps: ['Review the description', 'Pick a care level from sample rules'],
        observations: [urgent ? 'Urgent care keyword matched: infection' : 'No urgent keyword matched'],
        confidence: 0.6,
      },
      assistant_message: urgent
        ? `Based on what you described, I recommend urgent care within the next day. ${NOTICE}`
        : `This sounds manageable with rest and fluids. Consider self-care, and see a primary care clinician if it lasts more than a few days. ${NOTICE}`,
      updated_memory: memory,
    };
  }
}

export class MockGeocode implements GeocodeBackend {
  async geocode(zipCode: string) {
    if (!/^\d{5}$/.test(zipCode)) return null;
    return { ...SAMPLE_REGION };
  }
}

export class MockPrices implements PriceBackend {
  async lookup(query: PriceQuery): Promise<PriceResult> {
    const base = SAMPLE_BASE_PRICE[query.serviceCode] ?? 150;
    const radiusMiles = query.radiusMeters / 1609.34;
    const providers = SAMPLE_FACILITIES.map((f) => {
      const distance = distanceMiles(query.latitude, query.longitude, f.latitude, f.longitude);
      const cash = Math.round(base * SAMPLE_KIND_FACTOR[f.kind]);
      return {
        providerId: f.id,
        providerName: f.name,
        address: `${f.city}, ${f.state}`,
        distance,
        pricing: {
          cashPrice: cash,
          lowestRate: Math.round(cash * 0.8),
          highestRate: Math.round(cash * 2.4),
        },
        serviceDetails: {
          code: query.serviceCode,
          description: serviceDescription(query.serviceType),
        },
        providerType: f.kind,
        healthSystem: f.system,
        payer: 'Sample Payer',
      };
    })
      .filter((p) => p.distance <= Math.max(radiusMiles, 50))
      .sort((a, b) => a.pricing.cashPrice - b.pricing.cashPrice);
    return { providers, dataSource: 'sample_data' };
  }
}

export function createMockBackend(): Backend {
  return {
    mode: 'mock',
    triage: new MockTriage(),
    geocode: new MockGeocode(),
    prices: new MockPrices(),
  };
}
