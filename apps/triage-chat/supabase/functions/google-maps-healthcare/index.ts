/**
 * Supabase Edge Function: Google Maps Healthcare Provider Search
 *
 * Deploys the Google Maps MCP server as a Supabase Edge Function
 * Provides healthcare provider search API for Health Sherpa
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Healthcare Provider Interface
interface HealthcareProvider {
  id: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
  rating?: number;
  userRatingCount?: number;
  priceLevel?:
    | 'PRICE_LEVEL_FREE'
    | 'PRICE_LEVEL_INEXPENSIVE'
    | 'PRICE_LEVEL_MODERATE'
    | 'PRICE_LEVEL_EXPENSIVE'
    | 'PRICE_LEVEL_VERY_EXPENSIVE';
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  phone?: string;
  website?: string;
  openNow?: boolean;
  hours?: string[];
  facilityTypes: string[];
  reviews?: Array<{
    rating: number;
    text: string;
    relativeTime: string;
  }>;
}

// Google Maps Healthcare Search Client
class GoogleMapsHealthcareClient {
  private apiKey: string;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000;

  // Healthcare facility type mappings
  private readonly healthcareTypes = {
    hospital: 'hospital',
    urgent_care: 'hospital',
    primary_care: 'doctor',
    doctor: 'doctor',
    clinic: 'doctor',
    pharmacy: 'pharmacy',
    dentist: 'dentist',
    physical_therapy: 'physiotherapist',
    mental_health: 'doctor',
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchHealthcareProviders(params: {
    location: { latitude: number; longitude: number };
    facilityTypes?: string[];
    radius?: number;
    affordabilityFilter?: 'free' | 'low_cost' | 'moderate' | 'any';
    emergencyLevel?: 'emergency' | 'urgent' | 'routine';
    maxResults?: number;
    openNow?: boolean;
  }): Promise<HealthcareProvider[]> {
    const {
      location,
      facilityTypes = ['hospital', 'doctor', 'pharmacy'],
      radius = 5000,
      affordabilityFilter = 'any',
      emergencyLevel,
      maxResults = 20,
      openNow = false,
    } = params;

    try {
      // Convert facility types to Google Places API types
      const googleTypes = facilityTypes.map(
        (type) => this.healthcareTypes[type] || 'doctor'
      );

      // Remove duplicates
      const uniqueTypes = [...new Set(googleTypes)];

      let allProviders: HealthcareProvider[] = [];

      // Search for each facility type
      for (const placeType of uniqueTypes) {
        const providers = await this.searchNearbyPlaces(
          location,
          placeType,
          radius,
          maxResults
        );

        // Filter and enhance results
        const filteredProviders = this.filterProviders(
          providers,
          facilityTypes,
          emergencyLevel,
          affordabilityFilter,
          openNow
        );

        allProviders = [...allProviders, ...filteredProviders];
      }

      // Remove duplicates and sort by distance
      const uniqueProviders = this.deduplicateProviders(allProviders);
      const sortedProviders = this.sortProvidersByDistance(
        uniqueProviders,
        location
      );

      return sortedProviders.slice(0, maxResults);
    } catch (error) {
      console.error('Healthcare search error:', error);
      throw new Error(
        `Failed to search healthcare providers: ${error.message}`
      );
    }
  }

  async getProviderDetails(placeId: string): Promise<HealthcareProvider> {
    try {
      const response = await this.retryWithBackoff(async () => {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,rating,user_ratings_total,price_level,business_status,opening_hours,formatted_phone_number,website,reviews,types&key=${this.apiKey}`;
        return await fetch(url);
      });

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Places API error: ${data.status}`);
      }

      const place = data.result;

      return {
        id: placeId,
        name: place.name,
        address: place.formatted_address,
        location: {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        },
        rating: place.rating,
        userRatingCount: place.user_ratings_total,
        priceLevel: place.price_level
          ? this.mapPriceLevel(place.price_level)
          : undefined,
        businessStatus: place.business_status,
        phone: place.formatted_phone_number,
        website: place.website,
        openNow: place.opening_hours?.open_now,
        hours: place.opening_hours?.weekday_text,
        facilityTypes: place.types.filter((type) =>
          Object.values(this.healthcareTypes).includes(type)
        ),
        reviews: place.reviews?.slice(0, 3).map((review) => ({
          rating: review.rating,
          text: review.text,
          relativeTime: review.relative_time_description,
        })),
      };
    } catch (error) {
      console.error('Provider details error:', error);
      throw new Error(`Failed to get provider details: ${error.message}`);
    }
  }

  async geocodeAddress(address: string): Promise<{
    address: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
    addressComponents: any[];
    placeId?: string;
  }> {
    try {
      const response = await this.retryWithBackoff(async () => {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
        return await fetch(url);
      });

      if (!response.ok) {
        throw new Error(`Google Geocoding API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new Error(`Unable to geocode address: ${address}`);
      }

      const result = data.results[0];
      const location = result.geometry.location;

      return {
        address,
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: result.formatted_address,
        addressComponents: result.address_components,
        placeId: result.place_id,
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error(`Failed to geocode address: ${error.message}`);
    }
  }

  // Private helper methods (shortened for Edge Function deployment)

  private async searchNearbyPlaces(
    location: { latitude: number; longitude: number },
    placeType: string,
    radius: number,
    maxResults: number
  ): Promise<HealthcareProvider[]> {
    const response = await this.retryWithBackoff(async () => {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=${radius}&type=${placeType}&key=${this.apiKey}`;
      return await fetch(url);
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Places API error: ${data.status}`);
    }

    return data.results.map((place) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      location: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
      },
      distance: this.calculateDistance(location, place.geometry.location),
      rating: place.rating,
      userRatingCount: place.user_ratings_total,
      priceLevel: place.price_level
        ? this.mapPriceLevel(place.price_level)
        : undefined,
      businessStatus: place.business_status,
      openNow: place.opening_hours?.open_now,
      facilityTypes: place.types.filter((type) =>
        Object.values(this.healthcareTypes).includes(type)
      ),
    }));
  }

  private filterProviders(
    providers: HealthcareProvider[],
    facilityTypes: string[],
    emergencyLevel?: string,
    affordabilityFilter?: string,
    openNow?: boolean
  ): HealthcareProvider[] {
    let filtered = providers;

    // Filter by facility type
    if (facilityTypes.includes('urgent_care')) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes('urgent') ||
          p.name.toLowerCase().includes('walk-in') ||
          p.name.toLowerCase().includes('immediate')
      );
    }

    // Filter by emergency level
    if (emergencyLevel === 'emergency') {
      filtered = filtered.filter(
        (p) =>
          p.facilityTypes.includes('hospital') ||
          p.name.toLowerCase().includes('emergency') ||
          p.name.toLowerCase().includes('er')
      );
    }

    // Filter by affordability
    if (affordabilityFilter && affordabilityFilter !== 'any') {
      const affordableLevels = {
        free: ['PRICE_LEVEL_FREE'],
        low_cost: ['PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE'],
        moderate: [
          'PRICE_LEVEL_FREE',
          'PRICE_LEVEL_INEXPENSIVE',
          'PRICE_LEVEL_MODERATE',
        ],
      };

      const allowedLevels = affordableLevels[affordabilityFilter] || [];
      filtered = filtered.filter(
        (p) => !p.priceLevel || allowedLevels.includes(p.priceLevel)
      );
    }

    // Filter by open now
    if (openNow) {
      filtered = filtered.filter((p) => p.openNow === true);
    }

    return filtered;
  }

  private deduplicateProviders(
    providers: HealthcareProvider[]
  ): HealthcareProvider[] {
    const seen = new Set();
    return providers.filter((provider) => {
      const key = `${provider.name}-${provider.address}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private sortProvidersByDistance(
    providers: HealthcareProvider[],
    location: { latitude: number; longitude: number }
  ): HealthcareProvider[] {
    return providers.sort((a, b) => {
      const distanceA =
        a.distance || this.calculateDistance(location, a.location);
      const distanceB =
        b.distance || this.calculateDistance(location, b.location);
      return distanceA - distanceB;
    });
  }

  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.latitude * Math.PI) / 180) *
        Math.cos((point2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private mapPriceLevel(level: number): string {
    const mapping = {
      0: 'PRICE_LEVEL_FREE',
      1: 'PRICE_LEVEL_INEXPENSIVE',
      2: 'PRICE_LEVEL_MODERATE',
      3: 'PRICE_LEVEL_EXPENSIVE',
      4: 'PRICE_LEVEL_VERY_EXPENSIVE',
    };
    return mapping[level] || 'PRICE_LEVEL_MODERATE';
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt >= this.maxRetries || error.status !== 429) {
        throw error;
      }

      const delay = this.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, attempt + 1);
    }
  }
}

// Main Edge Function Handler
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'search';

    // Get API key from environment
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const client = new GoogleMapsHealthcareClient(GOOGLE_MAPS_API_KEY);

    switch (action) {
      case 'search': {
        const body = await req.json();
        const {
          location,
          facilityTypes,
          radius,
          affordabilityFilter,
          emergencyLevel,
          maxResults,
          openNow,
        } = body;

        if (!location || !location.latitude || !location.longitude) {
          return new Response(
            JSON.stringify({ error: 'Location coordinates are required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const providers = await client.searchHealthcareProviders({
          location,
          facilityTypes,
          radius,
          affordabilityFilter,
          emergencyLevel,
          maxResults,
          openNow,
        });

        return new Response(
          JSON.stringify({
            success: true,
            providers,
            metadata: {
              resultCount: providers.length,
              searchParams: body,
              searchArea: `${radius || 5000}m radius`,
              affordabilityFilter: affordabilityFilter || 'any',
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'details': {
        const body = await req.json();
        const { placeId } = body;

        if (!placeId) {
          return new Response(
            JSON.stringify({ error: 'Place ID is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const details = await client.getProviderDetails(placeId);

        return new Response(
          JSON.stringify({
            success: true,
            provider: details,
            metadata: {
              placeId,
              hasReviews: (details.reviews?.length || 0) > 0,
              businessStatus: details.businessStatus,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'geocode': {
        const body = await req.json();
        const { address } = body;

        if (!address) {
          return new Response(
            JSON.stringify({ error: 'Address is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const geocodeResult = await client.geocodeAddress(address);

        return new Response(
          JSON.stringify({
            success: true,
            location: geocodeResult,
            metadata: {
              inputAddress: address,
              confidence: 'high',
              placeId: geocodeResult.placeId,
            },
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid action. Use: search, details, or geocode',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }
  } catch (error) {
    console.error('Google Maps Healthcare API error:', error);

    return new Response(
      JSON.stringify({
        error: 'An error occurred while processing your request',
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
