import * as traceloop from "@traceloop/node-server-sdk";
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Custom healthcare-specific attributes
const healthcareAttributes = {
  'healthcare.environment': process.env.NODE_ENV || 'development',
  'healthcare.compliance': 'HIPAA',
  'healthcare.version': '1.0.0',
  'healthcare.model_strategy': 'dynamic', // tracks model selection strategy
};

// Initialize OpenLLMetry with healthcare-specific configuration
traceloop.initialize({
  appName: "health-sherpa",
  apiKey: process.env.TRACELOOP_API_KEY,
  baseUrl: process.env.TRACELOOP_BASE_URL,
  
  // Development mode for immediate traces
  disableBatch: process.env.NODE_ENV === "development",
  
  // Privacy-first: don't trace patient content by default
  traceContent: process.env.TRACE_PATIENT_CONTENT === "true" ? true : false,
  
  // Custom headers for healthcare context
  headers: {
    "X-Healthcare-Environment": process.env.NODE_ENV || "development",
    "X-Compliance-Mode": "HIPAA",
    "X-Version": "1.0.0",
  },
  
  // Custom resource attributes
  resourceAttributes: {
    ...healthcareAttributes,
    [SemanticResourceAttributes.SERVICE_NAME]: 'health-sherpa',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  },
});

// Export for use in other modules
export const traceloopSDK = traceloop;