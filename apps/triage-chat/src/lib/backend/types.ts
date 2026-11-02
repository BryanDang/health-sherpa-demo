/**
 * Backend interfaces. Every call that leaves the process (LLM, geocoding,
 * price data) goes through one of these. The mock implementation is the
 * default; the live implementation is selected with BACKEND_MODE=live.
 */

import type {
  ExchangeObject,
  MedicalMemory,
  StatefulLLMResponse,
} from '../stateful-llm-interface';

export interface TriageBackend {
  processMessage(
    message: string,
    recentExchanges: ExchangeObject[],
    currentMemory: MedicalMemory | string | null
  ): Promise<StatefulLLMResponse>;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export interface GeocodeBackend {
  /** Returns null when the zip code is unknown. */
  geocode(zipCode: string): Promise<GeocodeResult | null>;
}

export interface PriceQuery {
  latitude: number;
  longitude: number;
  serviceCode: string;
  serviceType: string;
  radiusMeters: number;
  paymentType: 'cash' | 'insurance';
}

export interface PriceProvider {
  providerId: string;
  providerName: string;
  address: string;
  distance: number;
  pricing: { cashPrice: number; lowestRate: number; highestRate: number };
  serviceDetails: { code: string; description: string };
  providerType: string;
  healthSystem: string;
  payer: string;
}

export interface PriceResult {
  providers: PriceProvider[];
  dataSource: string;
}

export interface PriceBackend {
  lookup(query: PriceQuery): Promise<PriceResult>;
}

export interface Backend {
  mode: 'mock' | 'live';
  triage: TriageBackend;
  geocode: GeocodeBackend;
  prices: PriceBackend;
}
