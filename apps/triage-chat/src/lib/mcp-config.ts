/**
 * MCP Configuration and Health Monitoring System
 * 
 * Provides centralized configuration management, server discovery,
 * health monitoring, and error recovery mechanisms for MCP servers.
 * 
 * Features:
 * - Dynamic server configuration
 * - Health monitoring and alerting
 * - Automatic failover strategies
 * - Performance monitoring
 * - Configuration validation
 * - Circuit breaker patterns
 */

import { EventEmitter } from 'events';

// Configuration Types
export interface MCPServerConfig {
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
    requestsPerDay: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
  };
  fallbackConfig?: {
    enabled: boolean;
    fallbackServerId?: string;
    staticResponse?: any;
  };
  env?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface MCPSystemConfig {
  servers: Record<string, MCPServerConfig>;
  globalSettings: {
    defaultTimeout: number;
    maxConcurrentRequests: number;
    healthCheckInterval: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableMetrics: boolean;
    enableCircuitBreaker: boolean;
  };
  fallbackStrategies: {
    medicalTriage: {
      staticResponse: any;
      emergencyOnly: boolean;
    };
    providerSearch: {
      staticProviders: any[];
      useStaticWhenDown: boolean;
    };
  };
}

// Health and Performance Monitoring
export interface HealthMetrics {
  serverId: string;
  status: 'healthy' | 'degraded' | 'down' | 'circuit_open';
  lastHealthCheck: Date;
  responseTime: number;
  errorCount: number;
  successCount: number;
  consecutiveFailures: number;
  averageResponseTime: number;
  uptime: number;
  circuitState: 'closed' | 'open' | 'half_open';
  lastError?: string;
}

export interface PerformanceMetrics {
  serverId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  throughput: number;
}

// Default Configuration
export const DEFAULT_MCP_CONFIG: MCPSystemConfig = {
  servers: {
    medical_triage: {
      id: 'medical_triage',
      name: 'Medical Triage MCP',
      description: 'Core medical decision logic and emergency detection',
      command: 'node',
      args: ['src/mcp/medical-triage/server.ts'],
      capabilities: ['emergency_detection', 'symptom_analysis', 'care_level_assessment', 'medical_citations'],
      priority: 1,
      timeout: 30000,
      maxRetries: 3,
      healthCheckInterval: 30000,
      rateLimit: {
        requestsPerMinute: 20,
        requestsPerHour: 300,
        requestsPerDay: 2000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3,
      },
      fallbackConfig: {
        enabled: true,
        staticResponse: {
          careLevel: 'urgent',
          message: 'Medical triage system temporarily unavailable. Please consult healthcare provider.',
          emergencyDetected: false,
        },
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
      args: ['src/mcp/google-maps/google-maps-mcp-server.ts'],
      capabilities: ['provider_search', 'geocoding', 'facility_filtering', 'distance_calculation'],
      priority: 2,
      timeout: 15000,
      maxRetries: 2,
      healthCheckInterval: 60000,
      rateLimit: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
        requestsPerDay: 5000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeout: 30000,
        halfOpenMaxCalls: 2,
      },
      fallbackConfig: {
        enabled: true,
        staticResponse: {
          providers: [],
          message: 'Provider search temporarily unavailable.',
        },
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
      args: ['src/mcp/snowflake-cortex/mcp-server.ts'],
      capabilities: ['pricing_queries', 'data_analysis', 'geographic_pricing'],
      priority: 3,
      timeout: 45000,
      maxRetries: 2,
      healthCheckInterval: 120000,
      rateLimit: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 800,
      },
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeout: 120000,
        halfOpenMaxCalls: 1,
      },
      fallbackConfig: {
        enabled: true,
        staticResponse: {
          pricing: null,
          message: 'Pricing data temporarily unavailable.',
        },
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
      args: ['src/mcp/turquoise-health/turquoise-health-analytics-server.ts'],
      capabilities: ['market_analysis', 'pricing_trends', 'provider_networks'],
      priority: 4,
      timeout: 60000,
      maxRetries: 2,
      healthCheckInterval: 180000,
      rateLimit: {
        requestsPerMinute: 8,
        requestsPerHour: 80,
        requestsPerDay: 500,
      },
      circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeout: 180000,
        halfOpenMaxCalls: 1,
      },
      fallbackConfig: {
        enabled: false, // Optional service
      },
      env: {
        SNOWFLAKE_ACCOUNT_URL: process.env.SNOWFLAKE_ACCOUNT_URL || '',
        SNOWFLAKE_API_TOKEN: process.env.SNOWFLAKE_API_TOKEN || '',
      },
    },
  },
  globalSettings: {
    defaultTimeout: 30000,
    maxConcurrentRequests: 10,
    healthCheckInterval: 60000,
    logLevel: 'info',
    enableMetrics: true,
    enableCircuitBreaker: true,
  },
  fallbackStrategies: {
    medicalTriage: {
      staticResponse: {
        careLevel: 'urgent',
        message: 'Medical triage system temporarily unavailable. Please consult with a healthcare professional for your safety.',
        emergencyDetected: false,
        recommendations: [
          'Contact your primary care physician',
          'Consider urgent care if symptoms are concerning',
          'Call 911 if experiencing emergency symptoms',
        ],
      },
      emergencyOnly: true,
    },
    providerSearch: {
      staticProviders: [
        {
          name: 'Emergency Services',
          phone: '911',
          address: 'Emergency response',
          facilityType: 'emergency',
          available24h: true,
        },
        {
          name: 'Telehealth Services',
          phone: '1-800-TELEHEALTH',
          address: 'Remote consultation',
          facilityType: 'telehealth',
          available24h: true,
        },
      ],
      useStaticWhenDown: true,
    },
  },
};

/**
 * Circuit Breaker Implementation
 */
class CircuitBreaker extends EventEmitter {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  constructor(
    private config: MCPServerConfig['circuitBreaker'],
    private serverId: string
  ) {
    super();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half_open';
        this.emit('stateChange', this.serverId, 'half_open');
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.serverId}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    if (this.state === 'half_open') {
      this.state = 'closed';
      this.emit('stateChange', this.serverId, 'closed');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'half_open') {
      this.state = 'open';
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
      this.emit('stateChange', this.serverId, 'open');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
      this.emit('stateChange', this.serverId, 'open');
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime ? new Date() >= this.nextAttemptTime : false;
  }

  getState(): { state: string; failureCount: number; lastFailureTime?: Date } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Performance Metrics Collector
 */
class MetricsCollector {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private requestCounts: Map<string, { timestamp: number; count: number }[]> = new Map();

  recordRequest(serverId: string, responseTime: number, success: boolean): void {
    // Initialize if not exists
    if (!this.metrics.has(serverId)) {
      this.metrics.set(serverId, {
        serverId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerMinute: 0,
        errorRate: 0,
        throughput: 0,
      });
      this.responseTimes.set(serverId, []);
      this.requestCounts.set(serverId, []);
    }

    const metrics = this.metrics.get(serverId)!;
    const responseTimes = this.responseTimes.get(serverId)!;
    const requestCounts = this.requestCounts.get(serverId)!;

    // Update metrics
    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update response times
    responseTimes.push(responseTime);
    if (responseTimes.length > 1000) {
      responseTimes.splice(0, responseTimes.length - 1000); // Keep last 1000
    }

    // Update request counts for RPM calculation
    const now = Date.now();
    requestCounts.push({ timestamp: now, count: 1 });
    
    // Remove old entries (older than 1 minute)
    const oneMinuteAgo = now - 60000;
    while (requestCounts.length > 0 && requestCounts[0].timestamp < oneMinuteAgo) {
      requestCounts.shift();
    }

    // Calculate derived metrics
    this.calculateDerivedMetrics(serverId);
  }

  private calculateDerivedMetrics(serverId: string): void {
    const metrics = this.metrics.get(serverId)!;
    const responseTimes = this.responseTimes.get(serverId)!;
    const requestCounts = this.requestCounts.get(serverId)!;

    // Average response time
    if (responseTimes.length > 0) {
      metrics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      
      // Percentiles
      const sorted = [...responseTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);
      metrics.p95ResponseTime = sorted[p95Index] || 0;
      metrics.p99ResponseTime = sorted[p99Index] || 0;
    }

    // Error rate
    metrics.errorRate = metrics.totalRequests > 0 
      ? metrics.failedRequests / metrics.totalRequests 
      : 0;

    // Requests per minute
    metrics.requestsPerMinute = requestCounts.length;

    // Throughput (successful requests per minute)
    const successfulInLastMinute = requestCounts.filter(() => true).length; // Simplified
    metrics.throughput = successfulInLastMinute * (metrics.successfulRequests / metrics.totalRequests);
  }

  getMetrics(serverId: string): PerformanceMetrics | null {
    return this.metrics.get(serverId) || null;
  }

  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }
}

/**
 * Health Monitor
 */
class HealthMonitor extends EventEmitter {
  private healthMetrics: Map<string, HealthMetrics> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private config: MCPSystemConfig) {
    super();
  }

  initializeHealthChecks(): void {
    for (const [serverId, serverConfig] of Object.entries(this.config.servers)) {
      this.initializeServerHealth(serverId, serverConfig);
      this.startHealthCheck(serverId, serverConfig);
    }
  }

  private initializeServerHealth(serverId: string, config: MCPServerConfig): void {
    this.healthMetrics.set(serverId, {
      serverId,
      status: 'healthy',
      lastHealthCheck: new Date(),
      responseTime: 0,
      errorCount: 0,
      successCount: 0,
      consecutiveFailures: 0,
      averageResponseTime: 0,
      uptime: 0,
      circuitState: 'closed',
    });
  }

  private startHealthCheck(serverId: string, config: MCPServerConfig): void {
    const interval = setInterval(async () => {
      await this.performHealthCheck(serverId);
    }, config.healthCheckInterval);
    
    this.healthCheckIntervals.set(serverId, interval);
  }

  private async performHealthCheck(serverId: string): Promise<void> {
    const startTime = Date.now();
    const health = this.healthMetrics.get(serverId);
    if (!health) return;

    try {
      // Perform actual health check (would call server)
      // For now, simulate based on configuration
      await this.simulateHealthCheck(serverId);
      
      const responseTime = Date.now() - startTime;
      
      // Update health metrics
      health.status = responseTime > 5000 ? 'degraded' : 'healthy';
      health.lastHealthCheck = new Date();
      health.responseTime = responseTime;
      health.successCount++;
      health.consecutiveFailures = 0;
      health.averageResponseTime = (health.averageResponseTime + responseTime) / 2;

      this.emit('healthCheck', serverId, 'success', health);
    } catch (error) {
      health.status = 'down';
      health.lastHealthCheck = new Date();
      health.errorCount++;
      health.consecutiveFailures++;
      health.lastError = error instanceof Error ? error.message : String(error);

      this.emit('healthCheck', serverId, 'failure', health);
    }
  }

  private async simulateHealthCheck(serverId: string): Promise<void> {
    // Simulate health check - in real implementation, this would ping the server
    const config = this.config.servers[serverId];
    if (!config) throw new Error(`Server ${serverId} not configured`);
    
    // Simulate variable response times and occasional failures
    const delay = Math.random() * 1000 + 100;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 5% chance of failure for simulation
    if (Math.random() < 0.05) {
      throw new Error('Simulated health check failure');
    }
  }

  getHealth(serverId: string): HealthMetrics | null {
    return this.healthMetrics.get(serverId) || null;
  }

  getAllHealth(): Map<string, HealthMetrics> {
    return new Map(this.healthMetrics);
  }

  updateCircuitState(serverId: string, state: 'closed' | 'open' | 'half_open'): void {
    const health = this.healthMetrics.get(serverId);
    if (health) {
      health.circuitState = state;
      if (state === 'open') {
        health.status = 'circuit_open';
      }
    }
  }

  shutdown(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
  }
}

/**
 * Configuration Manager
 */
export class MCPConfigManager extends EventEmitter {
  private config: MCPSystemConfig;
  private healthMonitor: HealthMonitor;
  private metricsCollector: MetricsCollector;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor(config: MCPSystemConfig = DEFAULT_MCP_CONFIG) {
    super();
    this.config = config;
    this.healthMonitor = new HealthMonitor(config);
    this.metricsCollector = new MetricsCollector();
    
    this.initializeCircuitBreakers();
    this.setupEventHandlers();
  }

  private initializeCircuitBreakers(): void {
    for (const [serverId, serverConfig] of Object.entries(this.config.servers)) {
      if (this.config.globalSettings.enableCircuitBreaker) {
        const circuitBreaker = new CircuitBreaker(serverConfig.circuitBreaker, serverId);
        this.circuitBreakers.set(serverId, circuitBreaker);
        
        circuitBreaker.on('stateChange', (serverId: string, state: string) => {
          this.healthMonitor.updateCircuitState(serverId, state as any);
          this.emit('circuitBreakerStateChange', serverId, state);
        });
      }
    }
  }

  private setupEventHandlers(): void {
    this.healthMonitor.on('healthCheck', (serverId: string, result: string, health: HealthMetrics) => {
      this.emit('serverHealthChange', serverId, result, health);
    });
  }

  async initialize(): Promise<void> {
    this.validateConfiguration();
    this.healthMonitor.initializeHealthChecks();
    console.log('MCP Configuration Manager initialized');
  }

  private validateConfiguration(): void {
    for (const [serverId, config] of Object.entries(this.config.servers)) {
      if (!config.command) {
        throw new Error(`Server ${serverId} missing command`);
      }
      if (!config.capabilities.length) {
        throw new Error(`Server ${serverId} missing capabilities`);
      }
      if (config.timeout <= 0) {
        throw new Error(`Server ${serverId} invalid timeout`);
      }
    }
  }

  getServerConfig(serverId: string): MCPServerConfig | null {
    return this.config.servers[serverId] || null;
  }

  getAllServerConfigs(): Record<string, MCPServerConfig> {
    return { ...this.config.servers };
  }

  getGlobalSettings(): MCPSystemConfig['globalSettings'] {
    return { ...this.config.globalSettings };
  }

  getCircuitBreaker(serverId: string): CircuitBreaker | null {
    return this.circuitBreakers.get(serverId) || null;
  }

  recordMetrics(serverId: string, responseTime: number, success: boolean): void {
    this.metricsCollector.recordRequest(serverId, responseTime, success);
  }

  getServerMetrics(serverId: string): PerformanceMetrics | null {
    return this.metricsCollector.getMetrics(serverId);
  }

  getServerHealth(serverId: string): HealthMetrics | null {
    return this.healthMonitor.getHealth(serverId);
  }

  getAllHealth(): Map<string, HealthMetrics> {
    return this.healthMonitor.getAllHealth();
  }

  getAllMetrics(): Map<string, PerformanceMetrics> {
    return this.metricsCollector.getAllMetrics();
  }

  getFallbackResponse(serverId: string): any {
    const config = this.config.servers[serverId];
    if (config?.fallbackConfig?.enabled) {
      return config.fallbackConfig.staticResponse;
    }
    
    // Global fallbacks
    if (serverId === 'medical_triage') {
      return this.config.fallbackStrategies.medicalTriage.staticResponse;
    }
    if (serverId === 'google_maps_healthcare') {
      return {
        providers: this.config.fallbackStrategies.providerSearch.staticProviders,
        message: 'Using emergency contact information',
      };
    }
    
    return null;
  }

  shutdown(): Promise<void> {
    this.healthMonitor.shutdown();
    return Promise.resolve();
  }
}

export default MCPConfigManager;