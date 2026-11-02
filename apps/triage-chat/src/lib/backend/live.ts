/**
 * Live backend. Not tested here.
 * Selected with BACKEND_MODE=live. Needs GOOGLE_GENAI_API_KEY,
 * GOOGLE_MAPS_API_KEY, SNOWFLAKE_API_TOKEN and SNOWFLAKE_ACCOUNT_URL.
 * The price data source this was written against is retired.
 */

import type {
  Backend,
  GeocodeBackend,
  PriceBackend,
  PriceQuery,
  TriageBackend,
} from './types';
import { categorizeProviderType, serviceDescription } from './price-helpers';

class LiveTriage implements TriageBackend {
  async processMessage(
    message: string,
    recentExchanges: any[],
    currentMemory: any
  ) {
    const { StatefulMedicalLLM } = await import('../stateful-llm-interface');
    const key = process.env.GOOGLE_GENAI_API_KEY;
    if (!key) throw new Error('GOOGLE_GENAI_API_KEY is not set');
    return new StatefulMedicalLLM(key).processMessage(
      message,
      recentExchanges,
      currentMemory
    );
  }
}

class LiveGeocode implements GeocodeBackend {
  async geocode(zipCode: string) {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error('GOOGLE_MAPS_API_KEY is not set');
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zipCode)}&key=${key}`
    );
    if (!response.ok) throw new Error(`Geocoding error: ${response.status}`);
    const data = await response.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: data.results[0].formatted_address,
    };
  }
}

class LivePrices implements PriceBackend {
  async lookup(q: PriceQuery) {
    const { TurquoiseHealthAnalyticsClient } = await import(
      '../turquoise-health-client'
    );
    const client = new TurquoiseHealthAnalyticsClient();
    const radiusMiles = Math.round(q.radiusMeters / 1609.34);
    // Inputs are validated by the route: numeric coordinates, code pattern,
    // paymentType enum. They are still coerced here before interpolation.
    const lat = Number(q.latitude);
    const lon = Number(q.longitude);
    const code = q.serviceCode.replace(/[^0-9A-Za-z]/g, '');
    const cashFirst = q.paymentType === 'cash';
    const sql = `
      WITH location_filtered AS (
        SELECT hr.provider_name, hr.billing_code, hr.negotiated_dollar,
               hr.discounted_cash_rate, hr.gross_charge, hr.payer_name,
               hr.setting, hp.city, hp.state, hp.health_system_name,
               (3959 * ACOS(
                 COS(RADIANS(${lat})) * COS(RADIANS(hp.latitude)) *
                 COS(RADIANS(hp.longitude) - RADIANS(${lon})) +
                 SIN(RADIANS(${lat})) * SIN(RADIANS(hp.latitude))
               )) AS distance_miles
        FROM TURQUOISE_DATA_COMMUNITY_TIER.HOSPITAL_DATA.hospital_rates hr
        JOIN TURQUOISE_DATA_COMMUNITY_TIER.HOSPITAL_DATA.hospital_provider hp
          ON hr.provider_id = hp.id
        WHERE hr.billing_code = '${code}'
          AND hp.latitude IS NOT NULL AND hp.longitude IS NOT NULL
          AND hr.negotiated_dollar > 0
      )
      SELECT provider_name, billing_code, negotiated_dollar,
             discounted_cash_rate, gross_charge, payer_name, setting, city,
             state, health_system_name, distance_miles
      FROM location_filtered
      WHERE distance_miles <= ${radiusMiles}
      ORDER BY ${cashFirst ? 'discounted_cash_rate' : 'negotiated_dollar'} ASC,
               distance_miles ASC
      LIMIT 25`;
    const result = await client.executeQuery(sql);
    const providers = (result.data || []).map((row: any) => ({
      providerId: `live_${String(row.PROVIDER_NAME).replace(/\s+/g, '_').toLowerCase()}`,
      providerName: row.PROVIDER_NAME,
      address: `${row.CITY}, ${row.STATE}`,
      distance: parseFloat(row.DISTANCE_MILES || 0),
      pricing: {
        cashPrice: parseFloat(row.DISCOUNTED_CASH_RATE || row.NEGOTIATED_DOLLAR || 0),
        lowestRate: parseFloat(row.NEGOTIATED_DOLLAR || 0),
        highestRate: parseFloat(row.GROSS_CHARGE || row.NEGOTIATED_DOLLAR || 0),
      },
      serviceDetails: { code: row.BILLING_CODE, description: serviceDescription(q.serviceType) },
      providerType: categorizeProviderType(row.SETTING || 'hospital'),
      healthSystem: row.HEALTH_SYSTEM_NAME,
      payer: row.PAYER_NAME,
    }));
    return { providers, dataSource: 'live_snowflake' };
  }
}

export function createLiveBackend(): Backend {
  return {
    mode: 'live',
    triage: new LiveTriage(),
    geocode: new LiveGeocode(),
    prices: new LivePrices(),
  };
}
