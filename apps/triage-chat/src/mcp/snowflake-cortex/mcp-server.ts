/**
 * MCP Server for Snowflake Cortex Agents
 * Provides access to Turquoise Health pricing data stored in Snowflake
 */

interface SnowflakeCortexConfig {
  accountUrl: string;
  token: string;
}

interface HealthcarePricingQuery {
  location: {
    latitude: number;
    longitude: number;
    zipCode?: string;
  };
  serviceType: string;
  cptCode?: string;
  providerType?: 'urgent_care' | 'primary_care' | 'hospital' | 'specialist';
  paymentType?: 'cash' | 'insurance';
  radius?: number; // miles
}

interface PricingResult {
  providerId: string;
  providerName: string;
  address: string;
  distance: number;
  pricing: {
    cashPrice?: number;
    insuranceRates?: Array<{
      planName: string;
      rate: number;
    }>;
    lowestRate: number;
    highestRate: number;
  };
  serviceDetails: {
    code: string;
    description: string;
  };
  providerType: string;
  lastUpdated: string;
}

export class SnowflakeCortexMCP {
  private config: SnowflakeCortexConfig;

  constructor(config: SnowflakeCortexConfig) {
    this.config = config;
  }

  /**
   * Query healthcare pricing data using Snowflake Cortex Agents
   */
  async queryHealthcarePricing(
    query: HealthcarePricingQuery
  ): Promise<PricingResult[]> {
    const cortexQuery = this.buildCortexQuery(query);

    try {
      const response = await fetch(
        `${this.config.accountUrl}/api/v2/cortex/agent:run`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            'Content-Type': 'application/json',
            'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
          },
          body: JSON.stringify(cortexQuery),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Snowflake Cortex API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await this.parseStreamingResponse(response);
      return this.processPricingResults(data);
    } catch (error) {
      console.error('Snowflake Cortex query error:', error);
      throw error;
    }
  }

  /**
   * Build Cortex Agent query for healthcare pricing
   */
  private buildCortexQuery(query: HealthcarePricingQuery) {
    const naturalLanguageQuery = this.buildNaturalLanguageQuery(query);

    return {
      model: 'llama3.3-70b',
      response_instruction:
        'Provide healthcare pricing data in a structured format with provider details, pricing information, and location data.',
      tools: [
        {
          type: 'cortex_analyst_text_to_sql',
          cortex_analyst_text_to_sql: {
            semantic_model: 'TURQUOISE_HEALTH.CORE_RATES',
          },
        },
        {
          type: 'sql_exec',
        },
      ],
      tool_resources: {
        cortex_analyst_text_to_sql: {
          semantic_model: 'TURQUOISE_HEALTH.CORE_RATES',
        },
      },
      messages: [
        {
          role: 'user',
          content: naturalLanguageQuery,
        },
      ],
    };
  }

  /**
   * Convert structured query to natural language for Cortex
   */
  private buildNaturalLanguageQuery(query: HealthcarePricingQuery): string {
    const {
      location,
      serviceType,
      cptCode,
      providerType,
      paymentType,
      radius,
    } = query;

    // Updated to use correct Turquoise Health schema from data dictionary
    let nlQuery = `Query the hospital_rates and hospital_provider tables to find healthcare providers`;

    if (cptCode) {
      nlQuery += ` where billing_code = '${cptCode}' and billing_code_type = 'HCPCS'`;
    } else {
      nlQuery += ` offering services related to ${serviceType}`;
    }

    // Add geographic constraints using Snowflake spatial functions
    nlQuery += ` within ${radius || 10} miles of coordinates (${location.latitude}, ${location.longitude})`;
    nlQuery += ` using ST_DWITHIN(ST_MAKEPOINT(hp.longitude, hp.latitude), ST_MAKEPOINT(${location.longitude}, ${location.latitude}), ${(radius || 10) * 1609.34})`;

    if (providerType && providerType !== 'hospital') {
      if (providerType === 'urgent_care') {
        nlQuery += ` and (hr.setting = 'ER' or hp.hospital_type LIKE '%urgent%')`;
      } else if (providerType === 'primary_care') {
        nlQuery += ` and hr.setting = 'Outpatient'`;
      }
    }

    if (paymentType === 'cash') {
      nlQuery += ` and hr.discounted_cash_rate IS NOT NULL`;
    }

    nlQuery += `. SELECT hr.provider_name, 
                        hp.street_address, 
                        hp.city, 
                        hp.state, 
                        hp.zip_code,
                        hp.latitude, 
                        hp.longitude, 
                        hr.discounted_cash_rate as cash_price,
                        hr.negotiated_dollar as insurance_price,
                        hr.billing_code as service_code, 
                        hr.code_description as service_description, 
                        hp.hospital_type as provider_type,
                        hr.loaded_on as last_updated`;
    nlQuery += `, ROUND(ST_DISTANCE(ST_MAKEPOINT(hp.longitude, hp.latitude), ST_MAKEPOINT(${location.longitude}, ${location.latitude})) / 1609.34, 1) as distance_miles`;
    nlQuery += ` FROM hospital_rates hr`;
    nlQuery += ` JOIN hospital_provider hp ON hr.provider_id = hp.id`;
    nlQuery += ` WHERE hp.latitude IS NOT NULL AND hp.longitude IS NOT NULL`;
    nlQuery += ` ORDER BY `;

    if (paymentType === 'cash') {
      nlQuery += `hr.discounted_cash_rate ASC, distance_miles ASC`;
    } else {
      nlQuery += `distance_miles ASC, hr.discounted_cash_rate ASC`;
    }

    nlQuery += ` LIMIT 10`;

    return nlQuery;
  }

  /**
   * Parse streaming Server-Sent Events response
   */
  private async parseStreamingResponse(response: Response): Promise<any> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let result = '';

    if (!reader) {
      throw new Error('No response body available');
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'message.delta' && parsed.delta?.content) {
                result += parsed.delta.content;
              }
            } catch (e) {
              // Skip non-JSON lines
            }
          }
        }
      }

      return JSON.parse(result);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process and format pricing results
   */
  private processPricingResults(data: any): PricingResult[] {
    // This would need to be adapted based on the actual structure
    // of data returned from the Turquoise Health tables in Snowflake

    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((row: any) => ({
      providerId: row.provider_id || String(Math.random()),
      providerName: row.provider_name || 'Unknown Provider',
      address: this.formatAddress(row),
      distance: this.calculateDistance(
        row.latitude,
        row.longitude,
        row.query_lat,
        row.query_lng
      ),
      pricing: {
        cashPrice: row.cash_price,
        insuranceRates: this.parseInsuranceRates(row.insurance_rates),
        lowestRate: row.lowest_rate || row.cash_price,
        highestRate: row.highest_rate || row.cash_price,
      },
      serviceDetails: {
        code: row.service_code || row.cpt_code,
        description: row.service_description || 'Medical service',
      },
      providerType: row.provider_type || 'healthcare_facility',
      lastUpdated: row.last_updated || new Date().toISOString(),
    }));
  }

  private formatAddress(row: any): string {
    const parts = [];
    if (row.street_address) parts.push(row.street_address);
    if (row.city) parts.push(row.city);
    if (row.state) parts.push(row.state);
    if (row.zip_code) parts.push(row.zip_code);
    return parts.join(', ') || 'Address not available';
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  private parseInsuranceRates(
    rates: any
  ): Array<{ planName: string; rate: number }> {
    if (!rates) return [];

    try {
      if (typeof rates === 'string') {
        rates = JSON.parse(rates);
      }

      if (Array.isArray(rates)) {
        return rates.map((rate) => ({
          planName: rate.plan_name || rate.payer_name || 'Unknown Plan',
          rate: parseFloat(rate.rate || rate.amount || 0),
        }));
      }

      return [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Test connection to Snowflake Cortex
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.accountUrl}/api/v2/cortex/agent:run`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            'Content-Type': 'application/json',
            'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
          },
          body: JSON.stringify({
            model: 'llama3.3-70b',
            messages: [{ role: 'user', content: 'Test connection' }],
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Snowflake connection test failed:', error);
      return false;
    }
  }
}

export default SnowflakeCortexMCP;
