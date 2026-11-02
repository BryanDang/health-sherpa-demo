/**
 * Triage MCP API Route
 * 
 * Integrates the existing stateful triage endpoint with the MCP orchestrator
 * to provide enhanced medical triage with multi-server capabilities.
 * 
 * Features:
 * - Maintains backward compatibility with existing TriageChat component
 * - Adds MCP orchestration for enhanced capabilities
 * - Provides fallback to existing stateful system when MCP unavailable
 * - Seamless user experience with enhanced functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { MCPOrchestrator } from '@/lib/mcp-orchestrator';
import {
  statefulMedicalLLM,
  type ExchangeObject,
  type MedicalMemory,
} from '@/lib/stateful-llm-interface';

// Request/Response Types (compatible with existing TriageChat)
interface TriageMCPRequest {
  message: string;
  recentExchanges?: ExchangeObject[];
  currentMemory?: MedicalMemory | null;
  sessionId?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  enableMCP?: boolean; // Feature flag for MCP integration
  mcpPreferences?: {
    includeProviderSearch?: boolean;
    includePricingAnalysis?: boolean;
    preferredRadius?: number;
    affordabilityFilter?: 'free' | 'low_cost' | 'moderate' | 'any';
  };
}

interface TriageMCPResponse {
  // Existing fields for backward compatibility
  updated_reasoning: {
    plan: string;
    steps: string[];
    observations: string[];
    confidence: number;
  };
  assistant_message: string;
  updated_memory: MedicalMemory;
  emergency_detected: boolean;
  care_level: 'emergency' | 'urgent' | 'primary' | 'self_care';
  timestamp: string;

  // Enhanced MCP fields
  mcp_enabled: boolean;
  mcp_insights?: {
    intent_detected: any;
    servers_consulted: string[];
    provider_recommendations?: any[];
    pricing_information?: any;
    enhanced_assessment?: any;
  };
  fallback_reason?: string;
}

// Global orchestrator instance (in production, consider using connection pooling)
let orchestrator: MCPOrchestrator | null = null;

async function getOrchestrator(): Promise<MCPOrchestrator> {
  if (!orchestrator) {
    orchestrator = new MCPOrchestrator();
    await orchestrator.initialize();
  }
  return orchestrator;
}

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      recentExchanges = [],
      currentMemory = null,
      sessionId = `session_${Date.now()}`,
      location,
      enableMCP = true,
      mcpPreferences = {},
    }: TriageMCPRequest = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Always process through the existing stateful system first
    const baseResponse = await statefulMedicalLLM.processMessage(
      message,
      recentExchanges,
      currentMemory
    );

    // Analyze the response for emergency conditions
    const emergencyDetected = baseResponse.updated_memory.emergencyFlags.length > 0;
    const careLevel = determineCareLevel(
      baseResponse.updated_memory.emergencyFlags,
      baseResponse.updated_reasoning.observations
    );

    // Base response structure
    let triageResponse: TriageMCPResponse = {
      updated_reasoning: baseResponse.updated_reasoning,
      assistant_message: baseResponse.assistant_message,
      updated_memory: baseResponse.updated_memory,
      emergency_detected: emergencyDetected,
      care_level: careLevel,
      timestamp: new Date().toISOString(),
      mcp_enabled: false,
    };

    // Enhanced MCP processing if enabled and not an emergency
    if (enableMCP && !emergencyDetected) {
      try {
        const mcpOrchestrator = await getOrchestrator();
        
        // Prepare session context from existing memory
        const sessionContext = {
          sessionId,
          currentSymptoms: baseResponse.updated_memory.symptoms,
          careLevel,
          location,
          medicalContext: {
            medicalHistory: baseResponse.updated_memory.medicalHistory,
            medications: baseResponse.updated_memory.medications,
            allergies: baseResponse.updated_memory.allergies,
          },
          preferences: mcpPreferences,
        };

        // Process through MCP orchestrator
        const mcpResult = await mcpOrchestrator.processMessage(
          message,
          sessionId,
          sessionContext
        );

        // Enhance the response with MCP insights
        triageResponse.mcp_enabled = true;
        triageResponse.mcp_insights = {
          intent_detected: mcpResult.intent,
          servers_consulted: mcpResult.executedServers,
          provider_recommendations: mcpResult.response?.providerRecommendations,
          pricing_information: mcpResult.response?.pricingInformation,
          enhanced_assessment: mcpResult.response?.medicalAssessment,
        };

        // Enhance the assistant message with MCP insights
        triageResponse.assistant_message = enhanceAssistantMessage(
          baseResponse.assistant_message,
          mcpResult.response
        );

        // Update reasoning with MCP insights
        if (mcpResult.response?.summary) {
          triageResponse.updated_reasoning.observations.push(
            `Enhanced analysis: ${mcpResult.response.summary}`
          );
        }

      } catch (mcpError) {
        console.error('MCP processing error:', mcpError);
        triageResponse.mcp_enabled = false;
        triageResponse.fallback_reason = 'MCP services temporarily unavailable';
      }
    } else if (emergencyDetected) {
      triageResponse.fallback_reason = 'Emergency detected - using direct medical triage';
    }

    return NextResponse.json(triageResponse);

  } catch (error) {
    console.error('Triage MCP API error:', error);

    // Return safe fallback response
    return NextResponse.json(
      {
        updated_reasoning: {
          plan: 'System error - providing safety guidance',
          steps: ['Error detected', 'Providing emergency guidance'],
          observations: ['System processing error'],
          confidence: 0.1,
        },
        assistant_message:
          'I apologize, but I encountered an error while processing your medical query. For your safety, please consult with a healthcare professional directly. If you are experiencing emergency symptoms, please call 911.',
        updated_memory: {
          symptoms: [],
          medicalHistory: [],
          medications: [],
          allergies: [],
          emergencyFlags: ['SYSTEM_ERROR'],
          lastUpdate: new Date().toISOString(),
        },
        emergency_detected: true,
        care_level: 'emergency' as const,
        timestamp: new Date().toISOString(),
        mcp_enabled: false,
        fallback_reason: 'System error - safety fallback activated',
      },
      { status: 500 }
    );
  }
}

/**
 * Enhance assistant message with MCP insights
 */
function enhanceAssistantMessage(baseMessage: string, mcpResponse: any): string {
  if (!mcpResponse) return baseMessage;

  let enhancedMessage = baseMessage;

  // Add provider recommendations
  if (mcpResponse.providerRecommendations?.length > 0) {
    const topProviders = mcpResponse.providerRecommendations.slice(0, 3);
    enhancedMessage += `\n\n**Nearby Healthcare Providers:**\n`;
    
    topProviders.forEach((provider: any, index: number) => {
      enhancedMessage += `${index + 1}. **${provider.name}** - ${provider.address} (${provider.distance?.toFixed(1)} km away)`;
      if (provider.rating) {
        enhancedMessage += ` - Rating: ${provider.rating}/5`;
      }
      enhancedMessage += '\n';
    });
  }

  // Add pricing insights
  if (mcpResponse.pricingInformation?.data) {
    enhancedMessage += `\n\n**Cost Information:**\n`;
    enhancedMessage += `Pricing data available from multiple sources to help you make informed decisions about your care.`;
  }

  // Add enhanced medical assessment insights
  if (mcpResponse.medicalAssessment) {
    enhancedMessage += `\n\n**Enhanced Assessment:**\n`;
    enhancedMessage += `Additional medical insights have been considered in this assessment.`;
  }

  return enhancedMessage;
}

/**
 * Determine care level based on emergency flags and observations
 * (Kept from existing implementation for consistency)
 */
function determineCareLevel(
  emergencyFlags: string[],
  observations: string[]
): 'emergency' | 'urgent' | 'primary' | 'self_care' {
  // Check emergency flags first
  const emergencyKeywords = [
    'respiratory',
    'breathing',
    'cardiac',
    'chest pain',
    'heart attack',
    'stroke',
    'seizure',
    'unconscious',
    'bleeding',
    'trauma',
    'anaphylaxis',
    'allergic reaction',
    'infant fever',
  ];

  const urgentKeywords = [
    'severe pain',
    'high fever',
    'infection',
    'urgent care',
    'moderate bleeding',
    'injury',
    'fracture',
  ];

  // Emergency if any emergency flags exist
  if (emergencyFlags.length > 0) {
    const flagText = emergencyFlags.join(' ').toLowerCase();
    if (emergencyKeywords.some((keyword) => flagText.includes(keyword))) {
      return 'emergency';
    }
  }

  // Check observations for severity indicators
  const observationText = observations.join(' ').toLowerCase();

  if (emergencyKeywords.some((keyword) => observationText.includes(keyword))) {
    return 'emergency';
  }

  if (urgentKeywords.some((keyword) => observationText.includes(keyword))) {
    return 'urgent';
  }

  if (
    observationText.includes('primary care') ||
    observationText.includes('doctor')
  ) {
    return 'primary';
  }

  return 'self_care';
}

/**
 * Health check endpoint for MCP services
 */
export async function GET() {
  try {
    const mcpOrchestrator = await getOrchestrator();
    const healthStatus = mcpOrchestrator.getServerHealth();
    
    const status = {
      mcp_enabled: true,
      servers: Array.from(healthStatus.entries()).map(([serverId, health]) => ({
        id: serverId,
        status: health.status,
        lastCheck: health.lastHealthCheck,
        responseTime: health.responseTime,
        errorCount: health.errorCount,
      })),
      overall_status: Array.from(healthStatus.values()).every(h => h.status !== 'down') ? 'healthy' : 'degraded',
    };

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({
      mcp_enabled: false,
      error: 'MCP orchestrator unavailable',
      overall_status: 'down',
    }, { status: 503 });
  }
}