/**
 * Turquoise Health Analytics Client (Browser-Safe)
 *
 * Simplified client for browser/API routes without MCP server dependencies
 */

// Environment configuration
const SNOWFLAKE_CONFIG = {
  accountUrl: process.env.SNOWFLAKE_ACCOUNT_URL,
  database: 'TURQUOISE_DATA_COMMUNITY_TIER',
  schema: 'HOSPITAL_DATA',
  apiToken: process.env.SNOWFLAKE_API_TOKEN,
  warehouse: 'COMPUTE_WH',
  role: 'API_ROLE',
};

/**
 * Browser-safe Snowflake Analytics Client
 */
export class TurquoiseHealthAnalyticsClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    if (!SNOWFLAKE_CONFIG.apiToken || !SNOWFLAKE_CONFIG.accountUrl) {
      throw new Error(
        'SNOWFLAKE_API_TOKEN and SNOWFLAKE_ACCOUNT_URL are required'
      );
    }

    this.baseUrl = SNOWFLAKE_CONFIG.accountUrl;
    this.token = SNOWFLAKE_CONFIG.apiToken;
  }

  /**
   * Execute SQL query via Snowflake API
   */
  async executeQuery(sql: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/statements`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'TurquoiseHealthAnalyticsMCP/1.0',
        },
        body: JSON.stringify({
          statement: sql,
          database: SNOWFLAKE_CONFIG.database,
          schema: SNOWFLAKE_CONFIG.schema,
          warehouse: SNOWFLAKE_CONFIG.warehouse,
          role: SNOWFLAKE_CONFIG.role,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Snowflake API error: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Snowflake query error:', error);
      throw error;
    }
  }
}
