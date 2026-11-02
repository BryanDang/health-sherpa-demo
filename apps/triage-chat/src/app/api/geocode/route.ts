import { NextRequest, NextResponse } from 'next/server';
import { getBackend } from '@/lib/backend';
import { overLimit } from '@/lib/backend/rate-limit';

export async function POST(request: NextRequest) {
  try {
    if (overLimit(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { zipCode } = await request.json();

    if (typeof zipCode !== 'string' || !/^\d{5}$/.test(zipCode)) {
      return NextResponse.json(
        { error: 'A five digit zip code is required' },
        { status: 400 }
      );
    }

    const result = await getBackend().geocode.geocode(zipCode);
    if (!result) {
      return NextResponse.json(
        { error: `Unable to find location for zip code: ${zipCode}` },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode zip code' },
      { status: 500 }
    );
  }
}
