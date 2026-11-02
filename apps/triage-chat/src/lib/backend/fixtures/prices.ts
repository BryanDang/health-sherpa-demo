/**
 * Synthetic price fixtures. Sample data. Not real facilities, not real prices.
 * Names are invented; coordinates are placed near the fixture zip centers.
 */

export interface SampleFacility {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  kind: 'hospital' | 'urgent_care' | 'clinic';
  system: string;
}

export const SAMPLE_FACILITIES: SampleFacility[] = [
  { id: 'sample_1', name: 'Sample Riverside Hospital', city: 'Exampleton', state: 'ZZ', latitude: 40.0, longitude: -100.0, kind: 'hospital', system: 'Sample Health System A' },
  { id: 'sample_2', name: 'Sample Northgate Urgent Care', city: 'Exampleton', state: 'ZZ', latitude: 40.03, longitude: -100.04, kind: 'urgent_care', system: 'Sample Health System B' },
  { id: 'sample_3', name: 'Sample Maple Family Clinic', city: 'Exampleton', state: 'ZZ', latitude: 39.96, longitude: -99.97, kind: 'clinic', system: 'Sample Health System A' },
  { id: 'sample_4', name: 'Sample Lakeview Medical Center', city: 'Exampleton', state: 'ZZ', latitude: 40.1, longitude: -100.12, kind: 'hospital', system: 'Sample Health System C' },
  { id: 'sample_5', name: 'Sample Eastside Express Care', city: 'Exampleton', state: 'ZZ', latitude: 40.0, longitude: -99.9, kind: 'urgent_care', system: 'Sample Health System B' },
  { id: 'sample_6', name: 'Sample Hillcrest Community Clinic', city: 'Exampleton', state: 'ZZ', latitude: 39.9, longitude: -100.05, kind: 'clinic', system: 'Sample Health System C' },
];

/** Base cash price in dollars by service code. Invented numbers. */
export const SAMPLE_BASE_PRICE: Record<string, number> = {
  '99213': 140,
  '99203': 190,
  '99282': 650,
  '80053': 55,
  '71020': 120,
  '87880': 35,
  '87804': 45,
  '81003': 20,
  '87635': 70,
};

/** Multiplier by facility kind. */
export const SAMPLE_KIND_FACTOR: Record<SampleFacility['kind'], number> = {
  hospital: 1.6,
  urgent_care: 0.9,
  clinic: 0.75,
};
