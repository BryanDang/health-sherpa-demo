import { NextRequest, NextResponse } from 'next/server';
import { getBackend } from '@/lib/backend';
import { overLimit } from '@/lib/backend/rate-limit';
import { estimateProcedures, serviceDescription } from '@/lib/backend/price-helpers';

const SERVICE_CODE_MAP: Record<string, string> = {
  urgent_care_visit: '99213',
  new_patient_visit: '99203',
  emergency_visit: '99282',
  basic_blood_work: '80053',
  chest_xray: '71020',
  strep_test: '87880',
  flu_test: '87804',
  urine_test: '81003',
  covid_test: '87635',
};

export async function POST(request: NextRequest) {
  try {
    if (overLimit(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const serviceType: string =
      typeof body.serviceType === 'string' && body.serviceType in SERVICE_CODE_MAP
        ? body.serviceType
        : 'urgent_care_visit';
    const radius = Math.min(Math.max(Number(body.radius) || 25000, 1000), 100000);
    const paymentType = body.paymentType === 'insurance' ? 'insurance' : 'cash';
    const symptoms = typeof body.symptoms === 'string' ? body.symptoms.slice(0, 2000) : '';
    const careLevel = typeof body.careLevel === 'string' ? body.careLevel.slice(0, 32) : '';

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return NextResponse.json(
        { error: 'Valid latitude and longitude are required' },
        { status: 400 }
      );
    }

    // A caller-supplied code must look like a billing code; otherwise use the map.
    const serviceCode =
      typeof body.serviceCode === 'string' && /^[0-9A-Z]{5}$/.test(body.serviceCode)
        ? body.serviceCode
        : SERVICE_CODE_MAP[serviceType];

    try {
      const result = await getBackend().prices.lookup({
        latitude,
        longitude,
        serviceCode,
        serviceType,
        radiusMeters: radius,
        paymentType,
      });

      return NextResponse.json({
        providers: result.providers.slice(0, 10),
        serviceCode,
        serviceDescription: serviceDescription(serviceType),
        searchRadius: radius,
        totalFound: result.providers.length,
        dataSource: result.dataSource,
        potentialProcedures: estimateProcedures(symptoms, careLevel, serviceType),
      });
    } catch (apiError) {
      console.error('Price lookup error:', apiError);
      return NextResponse.json(
        { error: 'Unable to reach the price data source', dataSource: 'none' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Pricing API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing information' },
      { status: 500 }
    );
  }
}
