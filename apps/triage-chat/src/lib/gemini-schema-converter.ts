/**
 * Gemini Schema Converter
 * Converts Zod schemas to JSON Schema format compatible with Google Gemini API
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Converts a Zod schema to Gemini-compatible JSON Schema format
 * Fixes the original MCP issue where raw Zod objects were passed to Gemini
 */
export function convertZodToGeminiSchema(zodSchema: z.ZodType): any {
  try {
    // Convert Zod schema to JSON Schema format
    const jsonSchema = zodToJsonSchema(zodSchema, {
      target: 'jsonSchema7', // Ensure compatibility with Gemini
      $refStrategy: 'none', // Avoid references that might cause issues
      errorMessages: false, // Disable error messages for cleaner schema
      strictUnions: false, // Less strict for Gemini compatibility
    });
    
    // Clean the schema for Gemini compatibility
    const cleanedSchema = cleanSchemaForGemini(jsonSchema);
    
    return cleanedSchema;
  } catch (error) {
    console.error('Failed to convert Zod schema to JSON Schema:', error);
    throw new Error(`Schema conversion failed: ${error.message}`);
  }
}

/**
 * Recursively clean JSON Schema to remove properties that Gemini doesn't support
 */
function cleanSchemaForGemini(schema: any): any {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(item => cleanSchemaForGemini(item));
  }

  const cleaned = { ...schema };

  // Remove properties that Gemini doesn't support
  const unsupportedProperties = [
    '$schema',
    'additionalProperties',
    'patternProperties',
    'dependencies',
    'allOf',
    'anyOf',
    'oneOf',
    'not',
    'if',
    'then',
    'else',
    'examples',
    'default',
    'const',
    'contentEncoding',
    'contentMediaType',
    'definitions',
    '$ref',
    '$id',
    '$comment'
  ];

  unsupportedProperties.forEach(prop => {
    if (prop in cleaned) {
      delete cleaned[prop];
    }
  });

  // Recursively clean nested objects
  Object.keys(cleaned).forEach(key => {
    if (typeof cleaned[key] === 'object' && cleaned[key] !== null) {
      cleaned[key] = cleanSchemaForGemini(cleaned[key]);
    }
  });

  return cleaned;
}

/**
 * Creates a Gemini model configuration with proper schema conversion
 * @param model - Gemini model name (e.g., 'gemini-2.0-flash', 'gemini-2.5-pro')
 * @param zodSchema - Zod schema to convert
 * @param temperature - Temperature for response generation (0.1-0.9)
 * @param maxTokens - Maximum output tokens
 */
export function createGeminiModelConfig(
  model: string,
  zodSchema: z.ZodType,
  temperature: number = 0.7,
  maxTokens: number = 2048
) {
  const responseSchema = convertZodToGeminiSchema(zodSchema);
  
  return {
    model,
    generationConfig: {
      responseMimeType: 'application/json' as const,
      responseSchema: responseSchema, // Properly converted JSON Schema
      temperature,
      maxOutputTokens: maxTokens,
    }
  };
}

/**
 * Stage-specific configuration factory for the two-stage triage system
 */
export class TriageStageConfigs {
  /**
   * Stage 1: Empathetic Triage Nurse (High temperature for warmth)
   */
  static createEmpathicNurseConfig(zodSchema: z.ZodType) {
    return createGeminiModelConfig(
      'gemini-2.0-flash',
      zodSchema,
      0.8, // High temperature for empathy and natural conversation
      1024  // Moderate token limit for conversational responses
    );
  }

  /**
   * Stage 2: Precision Medical MCP (Low temperature for accuracy)
   */
  static createMedicalMCPConfig(zodSchema: z.ZodType) {
    return createGeminiModelConfig(
      'gemini-2.5-pro',
      zodSchema,
      0.2, // Low temperature for precise medical decisions
      2048  // Higher token limit for detailed medical reasoning
    );
  }
}

/**
 * Validates a response against the original Zod schema for type safety
 * Even with structured output, validate for additional safety
 */
export function validateGeminiResponse<T>(
  response: string,
  zodSchema: z.ZodType<T>
): T {
  try {
    const parsedResponse = JSON.parse(response);
    const validatedResponse = zodSchema.parse(parsedResponse);
    return validatedResponse;
  } catch (error) {
    console.error('Gemini response validation failed:', error);
    throw new Error(`Response validation failed: ${error.message}`);
  }
}