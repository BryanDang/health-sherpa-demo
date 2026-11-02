/**
 * Enhanced MCP Configuration with Production Features
 * 
 * Extends the base MCP configuration with:
 * - HIPAA compliance integration
 * - Advanced security features
 * - Production monitoring
 * - Circuit breaker patterns
 * - Rate limiting
 * - Audit logging
 */

import { EventEmitter } from 'events';
import { MCPConfigManager, DEFAULT_MCP_CONFIG, type MCPSystemConfig, type MCPServerConfig } from './mcp-config';
import { HIPAAComplianceManager } from './hipaa-compliance';

// Enhanced configuration interfaces
interface SecurityConfig {
  enableHIPAA: boolean;
  encryptionKey: string;
  auditLogEnabled: boolean;
  riskAssessmentEnabled: boolean;
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  ipWhitelist?: string[];
  rateLimitingEnabled: boolean;
}

interface ProductionConfig {
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsEnabled: boolean;
  alertingEnabled: boolean;
  performanceMonitoring: boolean;
  errorTracking: boolean;
  healthCheckEndpoints: boolean;
}

interface EnhancedMCPServerConfig extends MCPServerConfig {
  security: {
    requireAuthentication: boolean;
    allowedOrigins: string[];
    enableEncryption: boolean;
    logAllRequests: boolean;
  };
  monitoring: {
    enableMetrics: boolean;
    healthCheckPath: string;
    metricsPath: string;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      memoryUsage: number;
    };
  };
  compliance: {
    hipaaRequired: boolean;
    dataRetentionDays: number;
    auditLevel: 'minimal' | 'standard' | 'comprehensive';
  };
}

interface EnhancedMCPSystemConfig extends Omit<MCPSystemConfig, 'servers'> {
  servers: Record<string, EnhancedMCPServerConfig>;
  security: SecurityConfig;
  production: ProductionConfig;
  monitoring: {
    alertWebhooks: string[];
    slackWebhook?: string;
    emailAlerts?: string[];
    pushMetricsInterval: number;
  };
}

// Enhanced MCP server configurations with HIPAA compliance
export const ENHANCED_MCP_CONFIG: EnhancedMCPSystemConfig = {
  ...DEFAULT_MCP_CONFIG,
  servers: {
    medical_triage: {
      ...DEFAULT_MCP_CONFIG.servers.medical_triage,
      security: {
        requireAuthentication: true,
        allowedOrigins: ['https://healthsherpa.com', 'https://app.healthsherpa.com'],
        enableEncryption: true,
        logAllRequests: true,
      },
      monitoring: {
        enableMetrics: true,
        healthCheckPath: '/health',
        metricsPath: '/metrics',
        alertThresholds: {
          errorRate: 0.05, // 5% error rate
          responseTime: 5000, // 5 seconds
          memoryUsage: 1024, // 1GB
        },
      },
      compliance: {
        hipaaRequired: true,
        dataRetentionDays: 2555, // 7 years
        auditLevel: 'comprehensive',
      },
    },
    google_maps_healthcare: {
      ...DEFAULT_MCP_CONFIG.servers.google_maps_healthcare,
      security: {
        requireAuthentication: true,
        allowedOrigins: ['https://healthsherpa.com', 'https://app.healthsherpa.com'],
        enableEncryption: false, // Location data is not PHI
        logAllRequests: true,
      },
      monitoring: {
        enableMetrics: true,
        healthCheckPath: '/health',
        metricsPath: '/metrics',
        alertThresholds: {
          errorRate: 0.1, // 10% error rate (external API dependency)
          responseTime: 3000, // 3 seconds
          memoryUsage: 512, // 512MB
        },
      },
      compliance: {
        hipaaRequired: false,
        dataRetentionDays: 90,
        auditLevel: 'standard',
      },
    },
    snowflake_cortex: {
      ...DEFAULT_MCP_CONFIG.servers.snowflake_cortex,
      security: {
        requireAuthentication: true,
        allowedOrigins: ['https://healthsherpa.com', 'https://app.healthsherpa.com'],
        enableEncryption: false, // Pricing data is not PHI
        logAllRequests: true,
      },
      monitoring: {
        enableMetrics: true,
        healthCheckPath: '/health',
        metricsPath: '/metrics',
        alertThresholds: {
          errorRate: 0.05, // 5% error rate
          responseTime: 10000, // 10 seconds (data warehouse queries)
          memoryUsage: 1024, // 1GB
        },
      },
      compliance: {
        hipaaRequired: false,
        dataRetentionDays: 365,
        auditLevel: 'standard',
      },
    },
    turquoise_health: {
      ...DEFAULT_MCP_CONFIG.servers.turquoise_health,
      security: {
        requireAuthentication: true,
        allowedOrigins: ['https://healthsherpa.com', 'https://app.healthsherpa.com'],
        enableEncryption: false,
        logAllRequests: true,
      },
      monitoring: {
        enableMetrics: true,
        healthCheckPath: '/health',
        metricsPath: '/metrics',
        alertThresholds: {
          errorRate: 0.05, // 5% error rate
          responseTime: 15000, // 15 seconds (analytics queries)
          memoryUsage: 1024, // 1GB
        },
      },
      compliance: {
        hipaaRequired: false,
        dataRetentionDays: 365,
        auditLevel: 'minimal',
      },
    },
  },
  security: {
    enableHIPAA: true,
    encryptionKey: process.env.HIPAA_ENCRYPTION_KEY || '',
    auditLogEnabled: true,
    riskAssessmentEnabled: true,
    maxConcurrentSessions: 1000,
    sessionTimeoutMinutes: 30,
    ipWhitelist: process.env.IP_WHITELIST?.split(','),
    rateLimitingEnabled: true,
  },
  production: {
    environment: (process.env.NODE_ENV as any) || 'development',
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    metricsEnabled: true,
    alertingEnabled: true,
    performanceMonitoring: true,
    errorTracking: true,
    healthCheckEndpoints: true,
  },
  monitoring: {
    alertWebhooks: process.env.ALERT_WEBHOOKS?.split(',') || [],
    slackWebhook: process.env.SLACK_WEBHOOK,
    emailAlerts: process.env.EMAIL_ALERTS?.split(','),
    pushMetricsInterval: 30000, // 30 seconds
  },
};

/**
 * Enhanced MCP Configuration Manager with HIPAA compliance
 */
export class EnhancedMCPConfigManager extends MCPConfigManager {
  private hipaaManager?: HIPAAComplianceManager;
  private securityConfig: SecurityConfig;
  private productionConfig: ProductionConfig;
  private sessionManager: Map<string, { userId: string; startTime: Date; lastActivity: Date }> = new Map();
  private requestCounts: Map<string, { count: number; resetTime: Date }> = new Map();

  constructor(config: EnhancedMCPSystemConfig = ENHANCED_MCP_CONFIG) {
    // Convert enhanced config to base config format
    const baseConfig: MCPSystemConfig = {
      servers: Object.fromEntries(
        Object.entries(config.servers).map(([id, serverConfig]) => [
          id,
          {
            id: serverConfig.id,
            name: serverConfig.name,
            description: serverConfig.description,
            command: serverConfig.command,
            args: serverConfig.args,
            capabilities: serverConfig.capabilities,
            priority: serverConfig.priority,
            timeout: serverConfig.timeout,
            maxRetries: serverConfig.maxRetries,
            healthCheckInterval: serverConfig.healthCheckInterval,
            rateLimit: serverConfig.rateLimit,
            circuitBreaker: serverConfig.circuitBreaker,
            fallbackConfig: serverConfig.fallbackConfig,
            env: serverConfig.env,
            metadata: serverConfig.metadata,
          } as MCPServerConfig
        ])
      ),
      globalSettings: config.globalSettings,
      fallbackStrategies: config.fallbackStrategies,
    };

    super(baseConfig);

    this.securityConfig = config.security;
    this.productionConfig = config.production;

    // Initialize HIPAA compliance if enabled
    if (this.securityConfig.enableHIPAA && this.securityConfig.encryptionKey) {
      this.hipaaManager = new HIPAAComplianceManager(
        this.securityConfig.encryptionKey,
        true
      );
    }

    this.setupSessionManagement();
    this.setupSecurityMonitoring();
  }

  /**
   * Initialize enhanced configuration with security features
   */
  async initialize(): Promise<void> {
    await super.initialize();

    // Validate security configuration
    this.validateSecurityConfig();

    // Initialize HIPAA compliance checks
    if (this.hipaaManager) {
      const complianceCheck = this.hipaaManager.validateCompliance();
      if (!complianceCheck.isCompliant) {
        console.error('HIPAA compliance validation failed:', complianceCheck.issues);
        if (this.productionConfig.environment === 'production') {
          throw new Error('HIPAA compliance validation failed in production environment');
        }
      }
    }

    console.log('Enhanced MCP Configuration Manager initialized with security features');
  }

  /**
   * Validate security configuration
   */
  private validateSecurityConfig(): void {
    if (this.securityConfig.enableHIPAA) {
      if (!this.securityConfig.encryptionKey) {
        throw new Error('HIPAA encryption key is required when HIPAA compliance is enabled');
      }
      
      if (this.securityConfig.encryptionKey.length < 64) {
        throw new Error('HIPAA encryption key must be at least 64 characters (32 bytes hex)');
      }
    }

    if (this.productionConfig.environment === 'production') {
      if (!this.securityConfig.auditLogEnabled) {
        throw new Error('Audit logging must be enabled in production environment');
      }
      
      if (!this.securityConfig.rateLimitingEnabled) {
        console.warn('Rate limiting is disabled in production environment');
      }
    }
  }

  /**
   * Setup session management with timeouts
   */
  private setupSessionManagement(): void {
    // Clean up expired sessions every minute
    setInterval(() => {
      const now = new Date();
      const timeoutMs = this.securityConfig.sessionTimeoutMinutes * 60 * 1000;

      for (const [sessionId, session] of this.sessionManager.entries()) {
        if (now.getTime() - session.lastActivity.getTime() > timeoutMs) {
          this.sessionManager.delete(sessionId);
          
          if (this.hipaaManager) {
            this.hipaaManager.logPHIAccess({
              userId: session.userId,
              sessionId,
              action: 'read',
              resource: 'session',
              resourceId: sessionId,
              ipAddress: 'unknown',
              userAgent: 'system',
              authorized: true,
              riskLevel: 'low',
              dataElements: ['session_timeout'],
              purpose: 'session_management',
              outcome: 'success',
            });
          }
        }
      }
    }, 60000);
  }

  /**
   * Setup security monitoring
   */
  private setupSecurityMonitoring(): void {
    // Monitor for security events
    this.on('serverHealthChange', (serverId: string, result: string, health: any) => {
      if (result === 'failure' && this.hipaaManager) {
        this.hipaaManager.logViolation({
          violationType: 'audit_failure',
          severity: 'medium',
          description: `MCP server ${serverId} health check failed`,
          affectedRecords: 0,
          automaticallyDetected: true,
          mitigationActions: ['Restart server', 'Check logs', 'Review configuration'],
          reportingRequired: false,
        });
      }
    });

    this.on('circuitBreakerStateChange', (serverId: string, state: string) => {
      if (state === 'open' && this.hipaaManager) {
        this.hipaaManager.logViolation({
          violationType: 'audit_failure',
          severity: 'high',
          description: `Circuit breaker opened for MCP server ${serverId}`,
          affectedRecords: 0,
          automaticallyDetected: true,
          mitigationActions: ['Investigate server issues', 'Review error logs', 'Scale resources'],
          reportingRequired: true,
        });
      }
    });
  }

  /**
   * Authenticate and authorize request
   */
  async authenticateRequest(
    serverId: string,
    userId: string,
    sessionId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ authorized: boolean; riskLevel: 'low' | 'medium' | 'high' | 'critical' }> {
    const serverConfig = ENHANCED_MCP_CONFIG.servers[serverId];
    if (!serverConfig) {
      return { authorized: false, riskLevel: 'critical' };
    }

    // Check IP whitelist if configured
    if (this.securityConfig.ipWhitelist && this.securityConfig.ipWhitelist.length > 0) {
      if (!this.securityConfig.ipWhitelist.includes(ipAddress)) {
        if (this.hipaaManager) {
          await this.hipaaManager.logPHIAccess({
            userId,
            sessionId,
            action: 'read',
            resource: serverId,
            resourceId: 'authentication',
            ipAddress,
            userAgent,
            authorized: false,
            riskLevel: 'critical',
            dataElements: ['ip_whitelist_violation'],
            purpose: 'authentication',
            outcome: 'failure',
            errorMessage: 'IP address not in whitelist',
          });
        }
        return { authorized: false, riskLevel: 'critical' };
      }
    }

    // Check rate limits
    if (this.securityConfig.rateLimitingEnabled) {
      const rateLimitCheck = this.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        if (this.hipaaManager) {
          await this.hipaaManager.logPHIAccess({
            userId,
            sessionId,
            action: 'read',
            resource: serverId,
            resourceId: 'rate_limit',
            ipAddress,
            userAgent,
            authorized: false,
            riskLevel: 'high',
            dataElements: ['rate_limit_exceeded'],
            purpose: 'rate_limiting',
            outcome: 'failure',
            errorMessage: 'Rate limit exceeded',
          });
        }
        return { authorized: false, riskLevel: 'high' };
      }
    }

    // Check concurrent session limits
    const activeSessions = Array.from(this.sessionManager.values()).filter(s => s.userId === userId).length;
    if (activeSessions >= this.securityConfig.maxConcurrentSessions) {
      return { authorized: false, riskLevel: 'high' };
    }

    // Update session activity
    this.sessionManager.set(sessionId, {
      userId,
      startTime: this.sessionManager.get(sessionId)?.startTime || new Date(),
      lastActivity: new Date(),
    });

    // Determine risk level based on various factors
    const riskLevel = this.assessRiskLevel(userId, ipAddress, userAgent, serverConfig);

    // Log successful authentication
    if (this.hipaaManager && serverConfig.compliance.hipaaRequired) {
      await this.hipaaManager.logPHIAccess({
        userId,
        sessionId,
        action: 'read',
        resource: serverId,
        resourceId: 'authentication',
        ipAddress,
        userAgent,
        authorized: true,
        riskLevel,
        dataElements: ['authentication_success'],
        purpose: 'access_control',
        outcome: 'success',
      });
    }

    return { authorized: true, riskLevel };
  }

  /**
   * Check rate limits for user
   */
  private checkRateLimit(userId: string): { allowed: boolean; resetTime: Date } {
    const now = new Date();
    const key = `rate_limit_${userId}`;
    const limit = this.requestCounts.get(key);

    if (!limit || now >= limit.resetTime) {
      // Reset or initialize limit
      this.requestCounts.set(key, {
        count: 1,
        resetTime: new Date(now.getTime() + 60000), // 1 minute window
      });
      return { allowed: true, resetTime: new Date(now.getTime() + 60000) };
    }

    if (limit.count >= 100) { // 100 requests per minute limit
      return { allowed: false, resetTime: limit.resetTime };
    }

    limit.count++;
    return { allowed: true, resetTime: limit.resetTime };
  }

  /**
   * Assess risk level for request
   */
  private assessRiskLevel(
    userId: string,
    ipAddress: string,
    userAgent: string,
    serverConfig: EnhancedMCPServerConfig
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Check if accessing PHI-related server
    if (serverConfig.compliance.hipaaRequired) {
      riskScore += 2;
    }

    // Check time of access (higher risk outside business hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 1;
    }

    // Check for suspicious user agent patterns
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      riskScore += 3;
    }

    // Determine risk level
    if (riskScore >= 5) return 'critical';
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  /**
   * Log PHI access (wrapper for HIPAA manager)
   */
  async logPHIAccess(
    serverId: string,
    userId: string,
    sessionId: string,
    action: 'read' | 'write' | 'update' | 'delete' | 'export',
    resourceId: string,
    ipAddress: string,
    userAgent: string,
    dataElements: string[],
    purpose: string,
    outcome: 'success' | 'failure' | 'partial',
    errorMessage?: string
  ): Promise<void> {
    if (!this.hipaaManager) return;

    const serverConfig = ENHANCED_MCP_CONFIG.servers[serverId];
    if (!serverConfig?.compliance.hipaaRequired) return;

    const riskLevel = this.assessRiskLevel(userId, ipAddress, userAgent, serverConfig);

    await this.hipaaManager.logPHIAccess({
      userId,
      sessionId,
      action,
      resource: serverId,
      resourceId,
      ipAddress,
      userAgent,
      authorized: outcome === 'success',
      riskLevel,
      dataElements,
      purpose,
      outcome,
      errorMessage,
    });
  }

  /**
   * Generate enhanced compliance report
   */
  generateEnhancedComplianceReport(startDate: Date, endDate: Date): any {
    if (!this.hipaaManager) {
      return { error: 'HIPAA compliance not enabled' };
    }

    const baseReport = this.hipaaManager.generateComplianceReport(startDate, endDate);
    
    // Add MCP-specific metrics
    const mcpMetrics = {
      serverHealth: this.getAllHealth(),
      serverMetrics: this.getAllMetrics(),
      activeSessions: this.sessionManager.size,
      rateLimitViolations: Array.from(this.requestCounts.values()).filter(limit => limit.count >= 100).length,
    };

    return {
      ...baseReport,
      mcpMetrics,
      securityConfig: {
        hipaaEnabled: this.securityConfig.enableHIPAA,
        auditLogEnabled: this.securityConfig.auditLogEnabled,
        rateLimitingEnabled: this.securityConfig.rateLimitingEnabled,
        environment: this.productionConfig.environment,
      },
    };
  }

  /**
   * Get HIPAA manager instance
   */
  getHIPAAManager(): HIPAAComplianceManager | undefined {
    return this.hipaaManager;
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): SecurityConfig {
    return { ...this.securityConfig };
  }

  /**
   * Get production configuration
   */
  getProductionConfig(): ProductionConfig {
    return { ...this.productionConfig };
  }
}

export default EnhancedMCPConfigManager;