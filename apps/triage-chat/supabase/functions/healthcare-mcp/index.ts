// Healthcare MCP System - Supabase Edge Function Integration
// Combines the production-ready Python MCP server with Supabase Edge Functions

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Healthcare MCP Tools Interface
interface HealthcareMCPRequest {
  tool: string;
  arguments: any;
}

interface SnowflakeConfig {
  account_url: string;
  pat_token: string;
  database: string;
  warehouse: string;
  role: string;
  schema: string;
}

class HealthcareMCPServer {
  private snowflakeConfig: SnowflakeConfig;

  constructor() {
    this.snowflakeConfig = {
      account_url: Deno.env.get('SNOWFLAKE_ACCOUNT_URL') || '',
      pat_token: Deno.env.get('SNOWFLAKE_PAT') || '',
      database: 'TURQUOISE_DATA_COMMUNITY_TIER',
      warehouse: 'COMPUTE_WH',
      role: 'API_ROLE',
      schema: 'PUBLIC_LATEST',
    };

    // Validate required environment variables
    if (!this.snowflakeConfig.account_url || !this.snowflakeConfig.pat_token) {
      console.error(
        'Missing required environment variables: SNOWFLAKE_ACCOUNT_URL, SNOWFLAKE_PAT'
      );
    }
  }

  async handleToolCall(tool: string, args: any): Promise<any> {
    console.log(`Healthcare MCP Tool Call: ${tool}`, args);

    switch (tool) {
      case 'cortex_query':
        return await this.executeCortexQuery(
          args.question,
          args.model || 'gemma-7b'
        );

      case 'provider_search':
        return await this.searchProviders(
          args.location,
          args.specialty,
          args.service_type
        );

      case 'emergency_detection':
        return await this.detectEmergency(args.symptoms || [], args.context);

      case 'health_check':
        return await this.healthCheck();

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }

  async executeCortexQuery(
    question: string,
    model: string = 'gemma-7b'
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Emergency detection bypass
      if (this.isEmergencyQuery(question)) {
        return {
          status: 'emergency_detected',
          message: 'Emergency query detected - bypassing normal validation',
          emergency: true,
          response:
            'Please call 911 or go to the nearest emergency room immediately.',
          model_used: 'emergency_bypass',
          execution_time_ms: Date.now() - startTime,
        };
      }

      // Cost optimization - block vague queries
      if (this.isVagueQuery(question)) {
        return {
          status: 'clarification_needed',
          message:
            'Please provide more specific location information (city, zip code, or specific area)',
          suggestions: [
            'Specify a city name (e.g., "San Francisco")',
            'Provide a zip code (e.g., "94105")',
            'Name a specific neighborhood or area',
          ],
          execution_time_ms: Date.now() - startTime,
        };
      }

      // Execute Snowflake Cortex query
      const result = await this.querySnowflake(question, model);
      return {
        status: 'success',
        ...result,
        execution_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Snowflake query failed:', error);
      return {
        status: 'error',
        error_message: 'Unable to process query at this time',
        fallback_message: 'Please try a more specific query or contact support',
        execution_time_ms: Date.now() - startTime,
      };
    }
  }

  async searchProviders(
    location: string,
    specialty?: string,
    serviceType?: string
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Validate location is not vague
      if (this.isVagueLocation(location)) {
        return {
          status: 'clarification_needed',
          message: `Location "${location}" is too vague. Please specify a city, zip code, or specific area.`,
          execution_time_ms: Date.now() - startTime,
        };
      }

      const query = this.buildProviderSearchQuery(
        location,
        specialty,
        serviceType
      );
      const result = await this.querySnowflake(query, 'gemma-7b');

      return {
        status: 'success',
        ...result,
        search_criteria: { location, specialty, serviceType },
        execution_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Provider search failed:', error);
      return {
        status: 'error',
        error_message: 'Provider search failed',
        execution_time_ms: Date.now() - startTime,
      };
    }
  }

  async detectEmergency(symptoms: string[], context?: string): Promise<any> {
    const emergencyKeywords = [
      'chest pain',
      'difficulty breathing',
      'unconscious',
      'severe bleeding',
      'stroke',
      'heart attack',
      'severe head injury',
      'cannot breathe',
      'loss of consciousness',
      'severe allergic reaction',
      'poisoning',
    ];

    const isEmergency = symptoms.some((symptom) =>
      emergencyKeywords.some((keyword) =>
        symptom.toLowerCase().includes(keyword)
      )
    );

    const urgentKeywords = [
      'high fever',
      'severe pain',
      'persistent vomiting',
      'severe headache',
      'vision changes',
      'severe abdominal pain',
    ];

    const isUrgent =
      !isEmergency &&
      symptoms.some((symptom) =>
        urgentKeywords.some((keyword) =>
          symptom.toLowerCase().includes(keyword)
        )
      );

    let urgencyLevel = 'routine';
    let recommendations: string[] = [];

    if (isEmergency) {
      urgencyLevel = 'emergency';
      recommendations = [
        'Call 911 immediately',
        'Go to nearest emergency room',
        'Do not drive yourself',
        'Stay calm and follow emergency operator instructions',
      ];
    } else if (isUrgent) {
      urgencyLevel = 'urgent';
      recommendations = [
        'Contact your healthcare provider today',
        'Consider urgent care if primary care unavailable',
        'Monitor symptoms closely',
        'Seek immediate care if symptoms worsen',
      ];
    } else {
      recommendations = [
        'Consider contacting your healthcare provider',
        'Monitor symptoms',
        'Seek medical attention if symptoms worsen or persist',
        'Maintain healthy lifestyle practices',
      ];
    }

    return {
      emergency_detected: isEmergency,
      urgency_level: urgencyLevel,
      confidence: isEmergency ? 0.95 : isUrgent ? 0.85 : 0.75,
      recommendations,
      red_flags: symptoms.filter((symptom) =>
        emergencyKeywords.some((keyword) =>
          symptom.toLowerCase().includes(keyword)
        )
      ),
      disclaimer:
        'This assessment is for informational purposes only and does not constitute medical advice. Please consult with a healthcare professional for proper medical evaluation.',
    };
  }

  async healthCheck(): Promise<any> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'healthcare-mcp',
      version: '1.0.0',
      snowflake_configured: !!(
        this.snowflakeConfig.account_url && this.snowflakeConfig.pat_token
      ),
      environment: Deno.env.get('NODE_ENV') || 'development',
    };
  }

  private isEmergencyQuery(query: string): boolean {
    const emergencyTerms = [
      'emergency',
      'urgent',
      'chest pain',
      'heart attack',
      'stroke',
      'difficulty breathing',
      'cannot breathe',
      'unconscious',
      'severe bleeding',
      'severe head injury',
      'call 911',
      'ambulance',
      'life threatening',
    ];

    return emergencyTerms.some((term) => query.toLowerCase().includes(term));
  }

  private isVagueQuery(query: string): boolean {
    const vagueTerms = [
      'bay area',
      'california',
      'northern california',
      'southern california',
      'around here',
      'nearby',
      'in the area',
      'region',
      'state of california',
    ];

    return vagueTerms.some((term) => query.toLowerCase().includes(term));
  }

  private isVagueLocation(location: string): boolean {
    const vague = [
      'bay area',
      'california',
      'ca',
      'northern california',
      'southern california',
    ];
    return vague.some((term) => location.toLowerCase().includes(term));
  }

  private buildProviderSearchQuery(
    location: string,
    specialty?: string,
    serviceType?: string
  ): string {
    let query = `SELECT DISTINCT 
                   PROVIDER_NPI, 
                   EIN_NAME as NAME, 
                   ADDRESS, 
                   CITY, 
                   STATE, 
                   ZIP_CODE, 
                   TAXONOMY_CLASSIFICATION,
                   TAXONOMY_SPECIALIZATION
                 FROM TURQUOISE_DATA_COMMUNITY_TIER.PUBLIC_LATEST.CORE_RATES 
                 WHERE UPPER(CITY) LIKE UPPER('%${location}%')`;

    if (specialty) {
      query += ` AND UPPER(TAXONOMY_CLASSIFICATION) LIKE UPPER('%${specialty}%')`;
    }

    if (serviceType) {
      query += ` AND UPPER(TAXONOMY_SPECIALIZATION) LIKE UPPER('%${serviceType}%')`;
    }

    query += ` ORDER BY CITY, EIN_NAME LIMIT 20`;

    return query;
  }

  private async querySnowflake(
    sqlOrQuestion: string,
    model: string
  ): Promise<any> {
    if (!this.snowflakeConfig.account_url || !this.snowflakeConfig.pat_token) {
      throw new Error('Snowflake configuration missing');
    }

    const headers = {
      Authorization: `Bearer ${this.snowflakeConfig.pat_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'HealthcareMCPEdgeFunction/1.0',
    };

    let sql = sqlOrQuestion;

    // If it's a natural language question, use Cortex AI to convert to SQL
    if (!sqlOrQuestion.trim().toUpperCase().startsWith('SELECT')) {
      const cortexPayload = {
        statement: `SELECT SNOWFLAKE.CORTEX.COMPLETE('${model}', 
          'Convert this natural language question into a SQL query for healthcare provider data: ${sqlOrQuestion}. 
           Use table TURQUOISE_DATA_COMMUNITY_TIER.PUBLIC_LATEST.CORE_RATES with columns: 
           PROVIDER_NPI, EIN_NAME, ADDRESS, CITY, STATE, ZIP_CODE, TAXONOMY_CLASSIFICATION, TAXONOMY_SPECIALIZATION.
           Only return the SQL query, no explanations.')`,
        database: this.snowflakeConfig.database,
        warehouse: this.snowflakeConfig.warehouse,
        role: this.snowflakeConfig.role,
        schema: this.snowflakeConfig.schema,
        timeout: 60,
      };

      try {
        const cortexResponse = await fetch(
          `${this.snowflakeConfig.account_url}/api/v2/statements`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(cortexPayload),
          }
        );

        if (!cortexResponse.ok) {
          throw new Error(
            `Cortex AI query failed: ${cortexResponse.statusText}`
          );
        }

        const cortexResult = await cortexResponse.json();
        if (
          cortexResult.data &&
          cortexResult.data[0] &&
          cortexResult.data[0][0]
        ) {
          sql = cortexResult.data[0][0];
          // Clean up the SQL (remove quotes and explanations)
          sql = sql.replace(/^["']|["']$/g, '').trim();
        } else {
          throw new Error('Failed to generate SQL from natural language');
        }
      } catch (error) {
        console.error('Cortex AI conversion failed:', error);
        // Fall back to direct SQL if natural language conversion fails
        sql = this.buildProviderSearchQuery(sqlOrQuestion);
      }
    }

    // Execute the SQL query
    const queryPayload = {
      statement: sql,
      database: this.snowflakeConfig.database,
      warehouse: this.snowflakeConfig.warehouse,
      role: this.snowflakeConfig.role,
      schema: this.snowflakeConfig.schema,
      timeout: 180,
    };

    const response = await fetch(
      `${this.snowflakeConfig.account_url}/api/v2/statements`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(queryPayload),
      }
    );

    if (!response.ok) {
      throw new Error(`Snowflake query failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Format results
    const formattedResults = this.formatQueryResults(result);

    return {
      results: formattedResults,
      result_count: formattedResults.length,
      generated_sql: sql,
      model_used: model,
      query_stats: result.stats || {},
    };
  }

  private formatQueryResults(result: any): any[] {
    if (!result.data || !Array.isArray(result.data)) {
      return [];
    }

    const columns = result.resultSetMetaData?.columnNames || [];

    return result.data.map((row: any[]) => {
      const formattedRow: any = {};
      columns.forEach((col: string, index: number) => {
        formattedRow[col] = row[index];
      });
      return formattedRow;
    });
  }
}

console.log('Healthcare MCP Edge Function initialized');

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { tool, arguments: args }: HealthcareMCPRequest = requestBody;

    if (!tool) {
      throw new Error('Tool parameter is required');
    }

    console.log(`Healthcare MCP Request: ${tool}`, { args });

    const mcpServer = new HealthcareMCPServer();
    const result = await mcpServer.handleToolCall(tool, args || {});

    console.log(`Healthcare MCP Response: ${tool}`, { status: result.status });

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Healthcare MCP Error:', error);

    const errorResponse = {
      status: 'error',
      error_message: error.message,
      timestamp: new Date().toISOString(),
      service: 'healthcare-mcp',
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});

/* Healthcare MCP Edge Function - Usage Examples:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make HTTP requests:

  // Emergency Detection
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/healthcare-mcp' \
    --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data '{"tool":"emergency_detection","arguments":{"symptoms":["chest pain","difficulty breathing"]}}'

  // Provider Search
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/healthcare-mcp' \
    --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data '{"tool":"provider_search","arguments":{"location":"San Francisco","specialty":"dermatology"}}'

  // Health Check
  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/healthcare-mcp' \
    --header "Authorization: Bearer $SUPABASE_ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data '{"tool":"health_check","arguments":{}}'

*/
