import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { zipCode, careLevel, procedure } = await req.json();

    if (!zipCode) {
      return new Response(JSON.stringify({ error: 'Zip code is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Snowflake API configuration
    const SNOWFLAKE_API_TOKEN = Deno.env.get('SNOWFLAKE_API_TOKEN');
    const SNOWFLAKE_ACCOUNT_URL = Deno.env.get('SNOWFLAKE_ACCOUNT_URL');

    if (!SNOWFLAKE_API_TOKEN || !SNOWFLAKE_ACCOUNT_URL) {
      return new Response(
        JSON.stringify({ error: 'Snowflake configuration not available' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Query Turquoise Health data via Snowflake
    const query = `
      SELECT 
        hr.billing_code,
        hr.description,
        hr.negotiated_dollar,
        hr.discounted_cash_rate,
        hr.gross_charge,
        hp.hospital_name as provider_name,
        hp.hospital_type,
        hp.city,
        hp.state,
        hr.payer_name,
        hr.setting
      FROM TURQUOISE_DATA_COMMUNITY_TIER.HOSPITAL_DATA.hospital_rates hr
      JOIN TURQUOISE_DATA_COMMUNITY_TIER.HOSPITAL_DATA.hospital_provider hp 
        ON hr.provider_id = hp.id
      WHERE hp.zip_code LIKE '${zipCode.substring(0, 3)}%'
        AND hr.negotiated_dollar > 0
        AND hr.description IS NOT NULL
      ORDER BY hr.discounted_cash_rate ASC
      LIMIT 20
    `;

    const response = await fetch(`${SNOWFLAKE_ACCOUNT_URL}/api/v2/statements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SNOWFLAKE_API_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        statement: query,
        database: 'TURQUOISE_DATA_COMMUNITY_TIER',
        schema: 'HOSPITAL_DATA',
        warehouse: 'COMPUTE_WH',
        role: 'API_ROLE',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Snowflake API error:', response.status, errorText);

      return new Response(
        JSON.stringify({
          error: 'Unable to fetch pricing data at this time',
          message:
            'Please try again later or contact support if the issue persists.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await response.json();

    if (!result.data || result.data.length === 0) {
      return new Response(
        JSON.stringify({
          message: `No pricing data found for zip code ${zipCode}`,
          providers: [],
          summary: {
            totalProviders: 0,
            averagePrice: null,
            priceRange: null,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Transform data
    const providers = result.data.map((row: any[]) => ({
      billingCode: row[0],
      description: row[1],
      negotiatedRate: parseFloat(row[2]) || 0,
      cashRate: parseFloat(row[3]) || 0,
      grossCharge: parseFloat(row[4]) || 0,
      providerName: row[5],
      hospitalType: row[6],
      city: row[7],
      state: row[8],
      payerName: row[9],
      setting: row[10],
    }));

    // Calculate summary statistics
    const rates = providers.map((p) => p.cashRate).filter((rate) => rate > 0);
    const summary = {
      totalProviders: providers.length,
      averagePrice:
        rates.length > 0
          ? rates.reduce((a, b) => a + b, 0) / rates.length
          : null,
      priceRange:
        rates.length > 0
          ? {
              min: Math.min(...rates),
              max: Math.max(...rates),
            }
          : null,
    };

    return new Response(
      JSON.stringify({
        message: `Found ${providers.length} pricing options near ${zipCode}`,
        providers: providers.slice(0, 10), // Limit to top 10
        summary,
        careLevel,
        searchCriteria: {
          zipCode,
          careLevel,
          procedure,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Pricing error:', error);
    return new Response(
      JSON.stringify({
        error: 'An error occurred while fetching pricing data',
        message: 'Please try again later.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
