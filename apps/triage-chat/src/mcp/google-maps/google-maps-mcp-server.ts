#!/usr/bin/env node

/**
 * Google Maps MCP Server for Healthcare Provider Search
 *
 * Comprehensive healthcare navigation via Google Maps Places API
 * Merges geocoding functionality with advanced provider search
 *
 * Features:
 * - Healthcare facility search with type filtering
 * - Affordability and emergency-level filtering
 * - Geocoding for address-to-coordinate conversion
 * - Provider details with ratings, hours, contact info
 * - Distance calculation and result sorting
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Environment configuration
const GOOGLE_MAPS_CONFIG = {
  apiKey: process.env.GOOGLE_MAPS_API_KEY,
  baseUrl: 'https://maps.googleapis.com/maps/api',
  placesBaseUrl: 'https://places.googleapis.com/v1',
};

/**
 * Healthcare Provider Interface
 */
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

/**
 * Geocoding Result Interface
 */
interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  addressComponents: any[];
  placeId?: string;
}

/**
 * Google Maps Healthcare Search Client
 */
class GoogleMapsHealthcareClient {
  private apiKey: string;
  private readonly maxRetries = 3;
  private readonly baseDelay = 1000;

  // Healthcare facility type mappings for Google Places API
  private readonly healthcareTypes = {
    hospital: 'hospital',
    urgent_care: 'hospital', // Will filter by name/keywords
    primary_care: 'doctor',
    doctor: 'doctor',
    clinic: 'doctor',
    pharmacy: 'pharmacy',
    dentist: 'dentist',
    physical_therapy: 'physiotherapist',
    mental_health: 'doctor', // Will filter by keywords
  };

  constructor() {
    if (!GOOGLE_MAPS_CONFIG.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
    }

    this.apiKey = GOOGLE_MAPS_CONFIG.apiKey;
  }

  /**
   * Search for healthcare providers near a location
   */
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

  /**
   * Get detailed information about a specific provider
   */
  async getProviderDetails(placeId: string): Promise<HealthcareProvider> {
    try {
      const response = await this.retryWithBackoff(async () => {
        const url = `${GOOGLE_MAPS_CONFIG.baseUrl}/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,rating,user_ratings_total,price_level,business_status,opening_hours,formatted_phone_number,website,reviews,types&key=${this.apiKey}`;
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

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    try {
      const response = await this.retryWithBackoff(async () => {
        const url = `${GOOGLE_MAPS_CONFIG.baseUrl}/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
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

  /**
   * Search nearby places using Google Places API
   */
  private async searchNearbyPlaces(
    location: { latitude: number; longitude: number },
    placeType: string,
    radius: number,
    maxResults: number
  ): Promise<HealthcareProvider[]> {
    const response = await this.retryWithBackoff(async () => {
      const url = `${GOOGLE_MAPS_CONFIG.baseUrl}/place/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=${radius}&type=${placeType}&key=${this.apiKey}`;
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

  /**
   * Filter providers based on criteria
   */
  private filterProviders(
    providers: HealthcareProvider[],
    facilityTypes: string[],
    emergencyLevel?: string,
    affordabilityFilter?: string,
    openNow?: boolean
  ): HealthcareProvider[] {
    let filtered = providers;

    // Filter by facility type based on name/keywords
    if (facilityTypes.includes('urgent_care')) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes('urgent') ||
          p.name.toLowerCase().includes('walk-in') ||
          p.name.toLowerCase().includes('immediate')
      );
    }

    if (facilityTypes.includes('emergency')) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes('emergency') ||
          p.name.toLowerCase().includes('er ') ||
          p.name.toLowerCase().includes('trauma')
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
    } else if (emergencyLevel === 'urgent') {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes('urgent') ||
          p.name.toLowerCase().includes('walk-in')
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

  /**
   * Remove duplicate providers
   */
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

  /**
   * Sort providers by distance
   */
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

  /**
   * Calculate distance between two points in kilometers
   */
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

  /**
   * Map Google price level to the enum
   */
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

  /**
   * Retry mechanism with exponential backoff
   */
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

/**
 * Healthcare-focused Google Maps MCP Tools
 */
const healthcareMapsTools = [
  {
    name: 'search_healthcare_providers',
    description:
      'Find healthcare providers near a location with comprehensive filtering for affordable care',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'object',
          properties: {
            latitude: { type: 'number', description: 'Latitude coordinate' },
            longitude: { type: 'number', description: 'Longitude coordinate' },
          },
          required: ['latitude', 'longitude'],
        },
        facilityTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'hospital',
              'urgent_care',
              'primary_care',
              'doctor',
              'clinic',
              'pharmacy',
              'dentist',
              'physical_therapy',
              'mental_health',
            ],
          },
          description: 'Types of healthcare facilities to search for',
        },
        radius: {
          type: 'number',
          maximum: 50000,
          description: 'Search radius in meters (max 50km)',
          default: 5000,
        },
        affordabilityFilter: {
          type: 'string',
          enum: ['free', 'low_cost', 'moderate', 'any'],
          description: 'Filter by price level for affordable care',
          default: 'any',
        },
        emergencyLevel: {
          type: 'string',
          enum: ['emergency', 'urgent', 'routine'],
          description: 'Filter by urgency of care needed',
        },
        maxResults: {
          type: 'number',
          maximum: 50,
          description: 'Maximum number of results to return',
          default: 20,
        },
        openNow: {
          type: 'boolean',
          description: 'Only return providers currently open',
          default: false,
        },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_provider_details',
    description:
      'Get comprehensive details about a specific healthcare provider including reviews and hours',
    inputSchema: {
      type: 'object',
      properties: {
        placeId: {
          type: 'string',
          description: 'Google Places ID of the healthcare provider',
        },
      },
      required: ['placeId'],
    },
  },
  {
    name: 'geocode_user_location',
    description:
      'Convert user address or zip code to coordinates for healthcare provider search',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Full address, zip code, or partial address to geocode',
        },
      },
      required: ['address'],
    },
  },
];

/**
 * Tool execution handlers
 */
async function executeHealthcareTool(
  name: string,
  args: any,
  client: GoogleMapsHealthcareClient
) {
  try {
    switch (name) {
      case 'search_healthcare_providers':
        const providers = await client.searchHealthcareProviders(args);
        return {
          success: true,
          tool: 'search_healthcare_providers',
          data: providers,
          metadata: {
            resultCount: providers.length,
            searchParams: args,
            searchArea: `${args.radius / 1000}km radius`,
            affordabilityFilter: args.affordabilityFilter || 'any',
          },
          summary: `Found ${providers.length} healthcare providers within ${args.radius / 1000}km`,
        };

      case 'get_provider_details':
        const details = await client.getProviderDetails(args.placeId);
        return {
          success: true,
          tool: 'get_provider_details',
          data: details,
          metadata: {
            placeId: args.placeId,
            hasReviews: (details.reviews?.length || 0) > 0,
            businessStatus: details.businessStatus,
          },
          summary: `Retrieved details for ${details.name}`,
        };

      case 'geocode_user_location':
        const geocodeResult = await client.geocodeAddress(args.address);
        return {
          success: true,
          tool: 'geocode_user_location',
          data: geocodeResult,
          metadata: {
            inputAddress: args.address,
            confidence: 'high', // Google Geocoding API is generally high confidence
            placeId: geocodeResult.placeId,
          },
          summary: `Geocoded "${args.address}" to coordinates`,
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Tool execution error for ${name}:`, error);
    return {
      success: false,
      tool: name,
      error: error.message,
      metadata: { args },
      summary: `Failed to execute ${name}: ${error.message}`,
    };
  }
}

/**
 * Main MCP Server Implementation
 */
class HealthcareGoogleMapsMCPServer {
  private server: Server;
  private mapsClient: GoogleMapsHealthcareClient;

  constructor() {
    this.server = new Server(
      {
        name: 'healthcare-google-maps-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.mapsClient = new GoogleMapsHealthcareClient();
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: healthcareMapsTools,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const result = await executeHealthcareTool(name, args, this.mapsClient);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.success,
      };
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Healthcare Google Maps MCP Server started');
  }
}

// Start the server
if (require.main === module) {
  const server = new HealthcareGoogleMapsMCPServer();
  server.start().catch(console.error);
}

export { HealthcareGoogleMapsMCPServer, GoogleMapsHealthcareClient };
