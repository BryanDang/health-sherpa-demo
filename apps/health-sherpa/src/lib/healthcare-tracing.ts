/**
 * Healthcare-specific tracing module for clinical AI transparency
 * Tracks MCP servers, function calls, and clinical decision paths
 */

import { withWorkflow, withTask } from "@traceloop/node-server-sdk";
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('health-sherpa-clinical', '1.0.0');

// MCP Server tracking
export interface MCPServerCall {
  serverName: string;
  serverType: 'firebase' | 'github' | 'playwright' | 'filesystem' | 'context7' | 'custom';
  functionName: string;
  parameters: Record<string, any>;
  timestamp: Date;
  responseTime?: number;
  success: boolean;
  error?: string;
}

// Clinical decision tracking
export interface ClinicalDecision {
  decisionId: string;
  phase: 0 | 1 | 2 | 3 | 4;
  decisionType: 'triage' | 'assessment' | 'recommendation' | 'referral' | 'safety';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  dataPoints: string[];
  redFlags: string[];
  timestamp: Date;
}

// Model selection tracking
export interface ModelSelection {
  selectedModel: string;
  strategy: string;
  complexity: 'simple' | 'medium' | 'complex';
  dailyLimit: number;
  fallbackModels: string[];
  selectionReason: string;
  timestamp: Date;
}

/**
 * Track MCP server interactions for transparency
 */
export async function traceMCPServerCall<T>(
  call: Omit<MCPServerCall, 'timestamp' | 'responseTime' | 'success' | 'error'>,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return await withTask(
    { 
      name: `mcp_${call.serverType}_${call.functionName}`,
      version: 1
    },
    async () => {
      const span = tracer.startSpan(`MCP.${call.serverName}.${call.functionName}`);
      
      // Add MCP-specific attributes
      span.setAttributes({
        'mcp.server.name': call.serverName,
        'mcp.server.type': call.serverType,
        'mcp.function.name': call.functionName,
        'mcp.parameters': JSON.stringify(call.parameters),
        'healthcare.mcp.tracked': true,
      });
      
      try {
        const result = await fn();
        
        span.setAttributes({
          'mcp.response.time': Date.now() - startTime,
          'mcp.success': true,
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        // Store for clinician dashboard
        await storeMCPCallForDashboard({
          ...call,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          success: true,
        });
        
        return result;
      } catch (error) {
        span.setAttributes({
          'mcp.error': true,
          'mcp.error.message': error instanceof Error ? error.message : 'Unknown error',
        });
        
        span.setStatus({ 
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Store error for clinician review
        await storeMCPCallForDashboard({
          ...call,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Track clinical decision paths for transparency
 */
export async function traceClinicalDecision<T>(
  decision: Omit<ClinicalDecision, 'timestamp'>,
  fn: () => Promise<T>
): Promise<T> {
  return await withWorkflow(
    { 
      name: `clinical_decision_${decision.decisionType}`,
      version: 1
    },
    async () => {
      const span = tracer.startSpan(`Clinical.Decision.${decision.decisionType}`);
      
      span.setAttributes({
        'clinical.decision.id': decision.decisionId,
        'clinical.decision.phase': decision.phase,
        'clinical.decision.type': decision.decisionType,
        'clinical.decision.confidence': decision.confidence,
        'clinical.decision.reasoning': decision.reasoning,
        'clinical.decision.data_points': JSON.stringify(decision.dataPoints),
        'clinical.decision.red_flags': JSON.stringify(decision.redFlags),
        'healthcare.tracked': true,
      });
      
      try {
        const result = await fn();
        
        span.setStatus({ code: SpanStatusCode.OK });
        
        // Store for clinician review
        await storeClinicalDecisionForDashboard({
          ...decision,
          timestamp: new Date(),
        });
        
        return result;
      } catch (error) {
        span.setStatus({ 
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Track model selection for cost and performance transparency
 */
export async function traceModelSelection<T>(
  selection: Omit<ModelSelection, 'timestamp'>,
  fn: () => Promise<T>
): Promise<T> {
  return await withTask(
    { 
      name: `model_selection_${selection.strategy}`,
      version: 1
    },
    async () => {
      const span = tracer.startSpan(`Model.Selection.${selection.selectedModel}`);
      
      span.setAttributes({
        'model.selected': selection.selectedModel,
        'model.strategy': selection.strategy,
        'model.complexity': selection.complexity,
        'model.daily_limit': selection.dailyLimit,
        'model.fallbacks': JSON.stringify(selection.fallbackModels),
        'model.selection_reason': selection.selectionReason,
        'healthcare.model.tracked': true,
      });
      
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        
        // Store for cost analysis
        await storeModelSelectionForDashboard({
          ...selection,
          timestamp: new Date(),
        });
        
        return result;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Track complete healthcare workflow with all phases
 */
export async function traceHealthcareWorkflow<T>(
  workflowName: string,
  patientSessionId: string,
  fn: () => Promise<T>
): Promise<T> {
  return await withWorkflow(
    { 
      name: `healthcare_workflow_${workflowName}`,
      version: 1
    },
    async () => {
      const span = tracer.startSpan(`Healthcare.Workflow.${workflowName}`);
      
      span.setAttributes({
        'healthcare.workflow.name': workflowName,
        'healthcare.session.id': patientSessionId,
        'healthcare.workflow.start': new Date().toISOString(),
        'healthcare.compliance': 'HIPAA',
      });
      
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ 
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

// Storage functions for clinician dashboard. Open: pick a database.
async function storeMCPCallForDashboard(call: MCPServerCall): Promise<void> {
  // TODO: Implement storage to database/cache for dashboard
  // This could be Firestore, PostgreSQL, Redis, etc.
  console.log('[Trace] MCP Call stored:', call);
}

async function storeClinicalDecisionForDashboard(decision: ClinicalDecision): Promise<void> {
  // TODO: Implement storage for clinical decisions
  console.log('[Trace] Clinical Decision stored:', decision);
}

async function storeModelSelectionForDashboard(selection: ModelSelection): Promise<void> {
  // TODO: Implement storage for model selections
  console.log('[Trace] Model Selection stored:', selection);
}

/**
 * Create a traceable version of any async function
 */
export function makeTraceable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string,
  attributes?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    return await withTask(
      { name },
      async () => {
        const span = tracer.startSpan(name);
        if (attributes) {
          span.setAttributes(attributes);
        }
        try {
          const result = await fn(...args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({ 
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }) as T;
}