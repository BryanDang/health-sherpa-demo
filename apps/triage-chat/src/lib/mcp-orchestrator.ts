/**
 * MCP Message Router and Orchestrator
 * 
 * Central orchestration system for routing messages between the medical triage chatbot
 * and multiple MCP servers with intelligent intent recognition, fallback mechanisms,
 * and response aggregation.
 * 
 * Architecture:
 * - Intent Classification: Automatic routing based on user intent
 * - Multi-Server Coordination: Handle scenarios requiring multiple MCP servers
 * - Response Aggregation: Combine responses into coherent recommendations
 * - Fallback Mechanisms: Graceful degradation when MCP servers are unavailable
 * - Rate Limiting: Manage MCP server load and respect constraints
 * - Session State: Maintain conversation context across interactions
 */

import { EventEmitter } from 'events';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  type CallToolResult
} from '@modelcontextprotocol/sdk/types.js';

// MCP Server Configurations
interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  capabilities: string[];
  priority: number;
  timeout: number;
  maxRetries: number;
  healthCheckInterval: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  env?: Record<string, string>;
}

// Intent Classification Types
interface UserIntent {
  primary: IntentType;
  secondary?: IntentType[];
  confidence: number;
  entities: Record<string, any>;
  context: string;
}

type IntentType = 
  | 'medical_triage'
  | 'provider_search'
  | 'pricing_analysis'
  | 'location_services'
  | 'emergency_detection'
  | 'follow_up_care'
  | 'multi_domain';

// MCP Server Registry
const MCP_SERVER_CONFIGS: Record<string, MCPServerConfig> = {
  medical_triage: {
    id: 'medical_triage',
    name: 'Medical Triage MCP',
    description: 'Core medical decision logic and emergency detection',
    command: 'node',
    args: ['/src/mcp/medical-triage/server.ts'],
    capabilities: ['emergency_detection', 'symptom_analysis', 'care_level_assessment', 'medical_citations'],
    priority: 1, // Highest priority for medical decisions
    timeout: 30000,
    maxRetries: 3,
    healthCheckInterval: 30000,
    rateLimit: {
      requestsPerMinute: 20,
      requestsPerHour: 300,
    },
    env: {
      GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY || '',
    },
  },
  google_maps_healthcare: {
    id: 'google_maps_healthcare',
    name: 'Google Maps Healthcare MCP',
    description: 'Provider search and location services',
    command: 'node',
    args: ['/src/mcp/google-maps/google-maps-mcp-server.ts'],
    capabilities: ['provider_search', 'geocoding', 'facility_filtering', 'distance_calculation'],
    priority: 2,
    timeout: 15000,
    maxRetries: 2,
    healthCheckInterval: 60000,
    rateLimit: {
      requestsPerMinute: 30,
      requestsPerHour: 500,
    },
    env: {
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
    },
  },
  snowflake_cortex: {
    id: 'snowflake_cortex',
    name: 'Snowflake Cortex MCP',
    description: 'Healthcare pricing data queries via Snowflake',
    command: 'node',
    args: ['/src/mcp/snowflake-cortex/mcp-server.ts'],
    capabilities: ['pricing_queries', 'data_analysis', 'geographic_pricing'],
    priority: 3,
    timeout: 45000,
    maxRetries: 2,
    healthCheckInterval: 120000,
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
    },
    env: {
      SNOWFLAKE_ACCOUNT_URL: process.env.SNOWFLAKE_ACCOUNT_URL || '',
      SNOWFLAKE_API_TOKEN: process.env.SNOWFLAKE_API_TOKEN || '',
    },
  },
  turquoise_health: {
    id: 'turquoise_health',
    name: 'Turquoise Health Analytics MCP',
    description: 'Market pricing analysis and competitive intelligence',
    command: 'node',
    args: ['/src/mcp/turquoise-health/turquoise-health-analytics-server.ts'],
    capabilities: ['market_analysis', 'pricing_trends', 'provider_networks'],
    priority: 4,
    timeout: 60000,
    maxRetries: 2,
    healthCheckInterval: 180000,
    rateLimit: {
      requestsPerMinute: 8,
      requestsPerHour: 80,
    },
    env: {
      SNOWFLAKE_ACCOUNT_URL: process.env.SNOWFLAKE_ACCOUNT_URL || '',
      SNOWFLAKE_API_TOKEN: process.env.SNOWFLAKE_API_TOKEN || '',
    },
  },
};

// Server Health Status
interface ServerHealth {
  serverId: string;
  status: 'healthy' | 'degraded' | 'down';
  lastHealthCheck: Date;
  responseTime: number;
  errorCount: number;
  consecutiveFailures: number;
}

// Rate Limiting
interface RateLimit {
  serverId: string;
  requestsThisMinute: number;
  requestsThisHour: number;
  lastMinuteReset: Date;
  lastHourReset: Date;
}

// Session Context
interface SessionContext {
  sessionId: string;
  userId?: string;
  currentSymptoms: string[];
  careLevel?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  priorInteractions: Array<{
    serverId: string;
    timestamp: Date;
    request: any;
    response: any;
  }>;
  medicalContext: Record<string, any>;
  preferences: Record<string, any>;
}

/**
 * Intent Classification Engine
 * Uses rule-based patterns and keyword analysis to determine user intent
 */
class IntentClassifier {
  private medicalKeywords = [
    'pain', 'hurt', 'ache', 'sick', 'fever', 'nausea', 'dizzy', 'bleeding',
    'shortness of breath', 'chest pain', 'headache', 'symptoms', 'emergency',
    'urgent', 'doctor', 'hospital', 'medical', 'health'
  ];

  private locationKeywords = [
    'near me', 'nearby', 'location', 'address', 'find', 'search',
    'closest', 'distance', 'directions', 'map'
  ];

  private pricingKeywords = [
    'cost', 'price', 'expensive', 'cheap', 'afford', 'insurance',
    'payment', 'bill', 'fee', 'money', 'budget'
  ];

  private emergencyKeywords = [
    'emergency', '911', 'urgent', 'severe', 'critical', 'can\'t breathe',
    'chest pain', 'stroke', 'heart attack', 'unconscious', 'bleeding heavily'
  ];

  classifyIntent(message: string, context?: SessionContext): UserIntent {
    const messageLower = message.toLowerCase();
    const scores = {
      medical_triage: 0,
      provider_search: 0,
      pricing_analysis: 0,
      location_services: 0,
      emergency_detection: 0,
      follow_up_care: 0,
    };

    // Score based on keyword presence
    this.medicalKeywords.forEach(keyword => {
      if (messageLower.includes(keyword)) scores.medical_triage += 1;
    });

    this.locationKeywords.forEach(keyword => {
      if (messageLower.includes(keyword)) {
        scores.provider_search += 1;
        scores.location_services += 1;
      }
    });

    this.pricingKeywords.forEach(keyword => {
      if (messageLower.includes(keyword)) scores.pricing_analysis += 1;
    });

    this.emergencyKeywords.forEach(keyword => {
      if (messageLower.includes(keyword)) scores.emergency_detection += 2;
    });

    // Context-based scoring
    if (context?.currentSymptoms?.length) {
      scores.medical_triage += 1;
      if (messageLower.includes('find') || messageLower.includes('where')) {
        scores.provider_search += 1;
      }
    }

    // Determine primary intent
    const maxScore = Math.max(...Object.values(scores));
    const primaryIntent = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as IntentType;
    
    // Determine secondary intents
    const secondaryIntents = Object.entries(scores)
      .filter(([intent, score]) => score > 0 && intent !== primaryIntent)
      .map(([intent]) => intent as IntentType);

    // Calculate confidence
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.1;

    return {
      primary: primaryIntent || 'medical_triage',
      secondary: secondaryIntents.length > 0 ? secondaryIntents : undefined,
      confidence,
      entities: this.extractEntities(message),
      context: message,
    };
  }

  private extractEntities(message: string): Record<string, any> {
    const entities: Record<string, any> = {};
    
    // Extract location entities
    const locationPatterns = [
      /(?:in|near|at)\s+([A-Za-z\s,]+)/gi,
      /(\d{5})/g, // ZIP codes
    ];
    
    locationPatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) {
        entities.locations = matches;
      }
    });

    // Extract symptom entities
    const symptomPatterns = [
      /(?:have|experiencing|feeling)\s+([a-z\s]+)/gi,
      /(?:pain|ache|hurt)\s+(?:in|on)\s+([a-z\s]+)/gi,
    ];

    symptomPatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) {
        entities.symptoms = (entities.symptoms || []).concat(matches);
      }
    });

    return entities;
  }
}

/**
 * MCP Client Manager
 * Manages connections to individual MCP servers with health monitoring
 */
class MCPClientManager extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private healthStatus: Map<string, ServerHealth> = new Map();
  private rateLimits: Map<string, RateLimit> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  async initialize(): Promise<void> {
    for (const [serverId, config] of Object.entries(MCP_SERVER_CONFIGS)) {
      try {
        await this.initializeServer(serverId, config);
      } catch (error) {
        console.error(`Failed to initialize MCP server ${serverId}:`, error);
        this.updateServerHealth(serverId, 'down');
      }
    }
  }

  private async initializeServer(serverId: string, config: MCPServerConfig): Promise<void> {
    // Create transport
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });

    // Create client
    const client = new Client({
      name: `mcp-orchestrator-${serverId}`,
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    // Connect
    await client.connect(transport);

    // Store references
    this.clients.set(serverId, client);
    this.transports.set(serverId, transport);

    // Initialize health status
    this.updateServerHealth(serverId, 'healthy');
    this.initializeRateLimit(serverId);

    // Start health checks
    this.startHealthCheck(serverId, config);

    console.log(`MCP server ${serverId} initialized successfully`);
  }

  private updateServerHealth(serverId: string, status: 'healthy' | 'degraded' | 'down'): void {
    const currentHealth = this.healthStatus.get(serverId);
    this.healthStatus.set(serverId, {
      serverId,
      status,
      lastHealthCheck: new Date(),
      responseTime: currentHealth?.responseTime || 0,
      errorCount: currentHealth?.errorCount || 0,
      consecutiveFailures: status === 'down' ? (currentHealth?.consecutiveFailures || 0) + 1 : 0,
    });

    this.emit('healthStatusChanged', serverId, status);
  }

  private initializeRateLimit(serverId: string): void {
    const now = new Date();
    this.rateLimits.set(serverId, {
      serverId,
      requestsThisMinute: 0,
      requestsThisHour: 0,
      lastMinuteReset: now,
      lastHourReset: now,
    });
  }

  private startHealthCheck(serverId: string, config: MCPServerConfig): void {
    const interval = setInterval(async () => {
      await this.performHealthCheck(serverId);
    }, config.healthCheckInterval);
    
    this.healthCheckIntervals.set(serverId, interval);
  }

  private async performHealthCheck(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) return;

    const startTime = Date.now();
    try {
      // Simple health check by listing tools
      await client.request({ method: 'tools/list' }, ListToolsRequestSchema);
      
      const responseTime = Date.now() - startTime;
      const currentHealth = this.healthStatus.get(serverId);
      
      this.healthStatus.set(serverId, {
        ...currentHealth!,
        status: responseTime > 5000 ? 'degraded' : 'healthy',
        lastHealthCheck: new Date(),
        responseTime,
        consecutiveFailures: 0,
      });
    } catch (error) {
      console.error(`Health check failed for ${serverId}:`, error);
      this.updateServerHealth(serverId, 'down');
    }
  }

  isServerAvailable(serverId: string): boolean {
    const health = this.healthStatus.get(serverId);
    return health?.status !== 'down';
  }

  canMakeRequest(serverId: string): boolean {
    const config = MCP_SERVER_CONFIGS[serverId];
    const rateLimit = this.rateLimits.get(serverId);
    
    if (!config || !rateLimit) return false;

    const now = new Date();
    
    // Reset counters if needed
    if (now.getTime() - rateLimit.lastMinuteReset.getTime() > 60000) {
      rateLimit.requestsThisMinute = 0;
      rateLimit.lastMinuteReset = now;
    }
    
    if (now.getTime() - rateLimit.lastHourReset.getTime() > 3600000) {
      rateLimit.requestsThisHour = 0;
      rateLimit.lastHourReset = now;
    }

    // Check limits
    return (
      rateLimit.requestsThisMinute < config.rateLimit.requestsPerMinute &&
      rateLimit.requestsThisHour < config.rateLimit.requestsPerHour
    );
  }

  async callTool(serverId: string, toolName: string, args: any): Promise<CallToolResult | null> {
    if (!this.isServerAvailable(serverId) || !this.canMakeRequest(serverId)) {
      return null;
    }

    const client = this.clients.get(serverId);
    if (!client) return null;

    try {
      // Update rate limits
      const rateLimit = this.rateLimits.get(serverId)!;
      rateLimit.requestsThisMinute++;
      rateLimit.requestsThisHour++;

      // Make the call
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }, CallToolRequestSchema);

      return result;
    } catch (error) {
      console.error(`Tool call failed for ${serverId}.${toolName}:`, error);
      
      // Update error count
      const health = this.healthStatus.get(serverId);
      if (health) {
        health.errorCount++;
        if (health.errorCount > 5) {
          this.updateServerHealth(serverId, 'degraded');
        }
      }
      
      throw error;
    }
  }

  getServerHealth(): Map<string, ServerHealth> {
    return new Map(this.healthStatus);
  }

  async shutdown(): Promise<void> {
    // Clear health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }

    // Close all transports
    for (const transport of this.transports.values()) {
      await transport.close();
    }

    this.clients.clear();
    this.transports.clear();
    this.healthStatus.clear();
    this.rateLimits.clear();
    this.healthCheckIntervals.clear();
  }
}

/**
 * Response Aggregator
 * Combines responses from multiple MCP servers into coherent recommendations
 */
class ResponseAggregator {
  aggregateResponses(responses: Array<{
    serverId: string;
    toolName: string;
    result: CallToolResult;
    priority: number;
  }>): any {
    if (responses.length === 0) return null;
    if (responses.length === 1) return responses[0].result;

    // Sort by priority
    const sortedResponses = responses.sort((a, b) => a.priority - b.priority);
    
    const aggregated = {
      summary: this.createSummary(sortedResponses),
      medicalAssessment: this.extractMedicalAssessment(sortedResponses),
      providerRecommendations: this.extractProviderRecommendations(sortedResponses),
      pricingInformation: this.extractPricingInformation(sortedResponses),
      sources: sortedResponses.map(r => ({
        server: r.serverId,
        tool: r.toolName,
        priority: r.priority,
      })),
      timestamp: new Date().toISOString(),
    };

    return aggregated;
  }

  private createSummary(responses: Array<any>): string {
    const summaries = responses
      .map(r => r.result.content?.[0]?.text)
      .filter(Boolean);
    
    if (summaries.length === 0) return 'No summary available';
    
    return `Based on analysis from ${responses.length} specialized systems: ${summaries.join(' ')}`;
  }

  private extractMedicalAssessment(responses: Array<any>): any {
    // Look for medical triage responses first
    const medicalResponse = responses.find(r => r.serverId === 'medical_triage');
    if (medicalResponse) {
      try {
        const parsed = JSON.parse(medicalResponse.result.content[0].text);
        return parsed.data || parsed;
      } catch {
        return { assessment: medicalResponse.result.content[0].text };
      }
    }
    return null;
  }

  private extractProviderRecommendations(responses: Array<any>): any[] {
    const providerResponse = responses.find(r => r.serverId === 'google_maps_healthcare');
    if (providerResponse) {
      try {
        const parsed = JSON.parse(providerResponse.result.content[0].text);
        return parsed.data || [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private extractPricingInformation(responses: Array<any>): any {
    const pricingResponses = responses.filter(r => 
      r.serverId === 'snowflake_cortex' || r.serverId === 'turquoise_health'
    );
    
    if (pricingResponses.length === 0) return null;

    const pricingData = pricingResponses.map(r => {
      try {
        return JSON.parse(r.result.content[0].text);
      } catch {
        return { raw: r.result.content[0].text };
      }
    });

    return {
      sources: pricingResponses.map(r => r.serverId),
      data: pricingData,
    };
  }
}

/**
 * Main MCP Orchestrator
 * Central orchestration system for routing messages between chatbot and MCP servers
 */
export class MCPOrchestrator extends EventEmitter {
  private intentClassifier: IntentClassifier;
  private clientManager: MCPClientManager;
  private responseAggregator: ResponseAggregator;
  private sessions: Map<string, SessionContext> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.intentClassifier = new IntentClassifier();
    this.clientManager = new MCPClientManager();
    this.responseAggregator = new ResponseAggregator();

    // Forward health events
    this.clientManager.on('healthStatusChanged', (serverId, status) => {
      this.emit('serverHealthChanged', serverId, status);
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.clientManager.initialize();
      this.isInitialized = true;
      console.log('MCP Orchestrator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MCP Orchestrator:', error);
      throw error;
    }
  }

  async processMessage(
    message: string,
    sessionId: string,
    context?: Partial<SessionContext>
  ): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('MCP Orchestrator not initialized');
    }

    // Get or create session
    const session = this.getOrCreateSession(sessionId, context);
    
    // Classify intent
    const intent = this.intentClassifier.classifyIntent(message, session);
    
    // Plan execution strategy
    const executionPlan = this.planExecution(intent, session);
    
    // Execute plan
    const responses = await this.executeParallel(executionPlan, message, session);
    
    // Aggregate responses
    const aggregatedResponse = this.responseAggregator.aggregateResponses(responses);
    
    // Update session context
    this.updateSessionContext(sessionId, intent, aggregatedResponse);
    
    return {
      intent,
      response: aggregatedResponse,
      sessionContext: session,
      executedServers: responses.map(r => r.serverId),
    };
  }

  private getOrCreateSession(sessionId: string, context?: Partial<SessionContext>): SessionContext {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        currentSymptoms: [],
        priorInteractions: [],
        medicalContext: {},
        preferences: {},
        ...context,
      };
      this.sessions.set(sessionId, session);
    } else if (context) {
      // Update existing session with new context
      Object.assign(session, context);
    }
    
    return session;
  }

  private planExecution(intent: UserIntent, session: SessionContext): Array<{
    serverId: string;
    toolName: string;
    args: any;
    priority: number;
  }> {
    const plan: Array<any> = [];

    // Always start with medical triage for medical intents
    if (intent.primary === 'medical_triage' || intent.primary === 'emergency_detection') {
      plan.push({
        serverId: 'medical_triage',
        toolName: 'process_medical_triage',
        args: {
          symptoms: intent.entities.symptoms || session.currentSymptoms,
          context: session.medicalContext,
          conversationHistory: session.priorInteractions.slice(-5),
        },
        priority: 1,
      });
    }

    // Add provider search if location-related
    if (intent.primary === 'provider_search' || intent.secondary?.includes('provider_search')) {
      plan.push({
        serverId: 'google_maps_healthcare',
        toolName: 'search_healthcare_providers',
        args: {
          location: session.location || { latitude: 0, longitude: 0 },
          facilityTypes: this.inferFacilityTypes(intent, session),
          emergencyLevel: this.inferEmergencyLevel(session),
        },
        priority: 2,
      });
    }

    // Add pricing analysis if cost-related
    if (intent.primary === 'pricing_analysis' || intent.secondary?.includes('pricing_analysis')) {
      plan.push({
        serverId: 'turquoise_health',
        toolName: 'comprehensive_market_analysis',
        args: {
          billing_code: this.inferBillingCode(intent, session),
          geographic_filter: session.location?.address,
        },
        priority: 3,
      });
    }

    return plan;
  }

  private async executeParallel(
    plan: Array<any>,
    message: string,
    session: SessionContext
  ): Promise<Array<any>> {
    const results = await Promise.allSettled(
      plan.map(async (step) => {
        try {
          const result = await this.clientManager.callTool(
            step.serverId,
            step.toolName,
            step.args
          );
          
          if (result) {
            return {
              serverId: step.serverId,
              toolName: step.toolName,
              result,
              priority: step.priority,
            };
          }
          return null;
        } catch (error) {
          console.error(`Failed to execute ${step.serverId}.${step.toolName}:`, error);
          return null;
        }
      })
    );

    return results
      .filter((result): result is PromiseFulfilledResult<any> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  private updateSessionContext(
    sessionId: string,
    intent: UserIntent,
    response: any
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Update symptoms from medical assessment
    if (response.medicalAssessment?.symptoms) {
      session.currentSymptoms = response.medicalAssessment.symptoms;
    }

    // Update care level
    if (response.medicalAssessment?.careLevel) {
      session.careLevel = response.medicalAssessment.careLevel;
    }

    // Add to interaction history
    session.priorInteractions.push({
      serverId: 'orchestrator',
      timestamp: new Date(),
      request: intent,
      response: response,
    });

    // Keep only last 10 interactions
    if (session.priorInteractions.length > 10) {
      session.priorInteractions = session.priorInteractions.slice(-10);
    }
  }

  private inferFacilityTypes(intent: UserIntent, session: SessionContext): string[] {
    if (session.careLevel === 'emergency') return ['hospital', 'emergency'];
    if (session.careLevel === 'urgent') return ['urgent_care', 'hospital'];
    return ['primary_care', 'clinic', 'doctor'];
  }

  private inferEmergencyLevel(session: SessionContext): string {
    switch (session.careLevel) {
      case 'emergency': return 'emergency';
      case 'urgent': return 'urgent';
      default: return 'routine';
    }
  }

  private inferBillingCode(intent: UserIntent, session: SessionContext): string {
    // This would be enhanced with medical knowledge base
    return '99213'; // Default to office visit
  }

  getServerHealth(): Map<string, ServerHealth> {
    return this.clientManager.getServerHealth();
  }

  getSessionContext(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  async shutdown(): Promise<void> {
    await this.clientManager.shutdown();
    this.sessions.clear();
    this.isInitialized = false;
  }
}

export default MCPOrchestrator;