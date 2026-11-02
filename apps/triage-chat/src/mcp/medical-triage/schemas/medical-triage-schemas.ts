/**
 * Medical Triage Schemas with Instructor Integration
 * Comprehensive type-safe schemas for medical triage decisions
 */

import { z } from 'zod';

// Core symptom information schema
export const SymptomInfoSchema = z.object({
  symptoms: z.array(z.string()).min(1, 'At least one symptom required'),
  duration: z.enum(['less_than_3_days', '3_to_7_days', 'more_than_7_days']),
  intensity: z.number().min(1).max(10),
  recentContact: z.boolean(),
  fever: z.number().optional(),
  location: z.string().optional(),
  triggers: z.array(z.string()).optional(),
  alleviatingFactors: z.array(z.string()).optional(),
  worseningFactors: z.array(z.string()).optional(),
  associatedSymptoms: z.array(z.string()).optional(),
});

// Medical citation schema with Google Search integration
export const MedicalCitationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  source: z.string(),
  excerpt: z.string(),
  relevance: z.enum(['high', 'medium', 'low']),
  dateAccessed: z.string().datetime(),
  credibility: z.enum(['high', 'medium', 'low']),
  evidenceLevel: z.enum(['A', 'B', 'C', 'D']).optional(),
});

// Emergency detection result schema
export const EmergencyDetectionSchema = z.object({
  isEmergency: z.boolean(),
  confidence: z.number().min(0).max(1),
  emergencyType: z
    .enum([
      'cardiac',
      'respiratory',
      'neurological',
      'bleeding',
      'poisoning',
      'trauma',
      'allergic_reaction',
      'other',
    ])
    .optional(),
  reasoning: z.array(z.string()),
  redFlags: z.array(z.string()),
  immediateActions: z.array(z.string()),
});

// Comprehensive triage decision schema
export const TriageDecisionSchema = z.object({
  careLevel: z.enum(['emergency', 'urgent', 'primary', 'self_care']),
  confidence: z.number().min(0).max(1),
  reasoning: z.array(z.string()),
  redFlags: z.array(z.string()),
  timeframe: z.string(),
  nextSteps: z.array(z.string()),
  selfCareAdvice: z.array(z.string()).optional(),
  citations: z.array(MedicalCitationSchema).optional(),
  specialConsiderations: z.array(z.string()).optional(),
  followUpRequired: z.boolean().default(false),
  disclaimers: z.array(z.string()),
});

// Slot-filling parameter schema
export const SlotFillingSchema = z.object({
  missingParameters: z.array(
    z.enum([
      'symptoms',
      'duration',
      'intensity',
      'location',
      'fever',
      'triggers',
      'alleviating_factors',
      'worsening_factors',
      'associated_symptoms',
    ])
  ),
  requiredParameters: z.array(z.string()),
  optionalParameters: z.array(z.string()),
  priorityOrder: z.array(z.string()),
  emergencyScreeningNeeded: z.boolean().default(false),
});

// Empathetic response schema for bot conversation
export const EmpathicResponseSchema = z.object({
  // Internal clinical reasoning (not shown to patient)
  clinicalReasoning: z.string(),
  emergencyRuledOut: z.boolean(),
  riskAssessment: z.enum(['low', 'medium', 'high', 'critical']),

  // Patient-facing content
  empathicConfirmation: z.string(),
  assessmentSummary: z.string(),
  followUpQuestions: z.array(z.string()).max(2),
  reassurance: z.string(),

  // Structured medical data
  careLevel: z.enum(['emergency', 'urgent', 'primary', 'self_care']),
  immediateActions: z.array(z.string()),
  citations: z.array(MedicalCitationSchema).optional(),

  // Conversation flow
  needsMoreInfo: z.boolean(),
  slotFilling: SlotFillingSchema.optional(),

  // Safety and compliance
  medicalDisclaimer: z.string(),
  emergencyInstructions: z.string().optional(),
});

// Special population considerations
export const SpecialPopulationSchema = z.object({
  populationType: z.enum([
    'infant',
    'child',
    'elderly',
    'pregnant',
    'immunocompromised',
  ]),
  ageInMonths: z.number().optional(),
  gestationalWeek: z.number().optional(),
  specialConsiderations: z.array(z.string()),
  modifiedThresholds: z.record(z.string(), z.number()).optional(),
  additionalRedFlags: z.array(z.string()),
});

// Citation research request schema
export const CitationRequestSchema = z.object({
  query: z.string(),
  medicalDomain: z.enum([
    'general_medicine',
    'emergency_medicine',
    'primary_care',
    'urgent_care',
    'pediatrics',
    'geriatrics',
    'obstetrics',
  ]),
  evidenceLevel: z.enum([
    'systematic_review',
    'clinical_trial',
    'guidelines',
    'expert_opinion',
  ]),
  maxResults: z.number().min(1).max(10).default(5),
  requiredSources: z.array(z.string()).optional(),
  excludedSources: z.array(z.string()).optional(),
});

// Complete MCP tool input schema
export const MedicalTriageMCPSchema = z.object({
  symptoms: z.array(z.string()).min(1),
  patientContext: z
    .object({
      age: z.number().optional(),
      sex: z.enum(['male', 'female', 'other']).optional(),
      medicalHistory: z.array(z.string()).optional(),
      currentMedications: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      specialPopulation: SpecialPopulationSchema.optional(),
    })
    .optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        timestamp: z.string().datetime(),
      })
    )
    .optional(),
  memoryContext: z.string().optional(),
  userGoal: z.string().optional(),
  requestCitations: z.boolean().default(true),
  citationRequest: CitationRequestSchema.optional(),
});

// Export all schemas for use in MCP server
export type SymptomInfo = z.infer<typeof SymptomInfoSchema>;
export type MedicalCitation = z.infer<typeof MedicalCitationSchema>;
export type EmergencyDetection = z.infer<typeof EmergencyDetectionSchema>;
export type TriageDecision = z.infer<typeof TriageDecisionSchema>;
export type SlotFilling = z.infer<typeof SlotFillingSchema>;
export type EmpathicResponse = z.infer<typeof EmpathicResponseSchema>;
export type SpecialPopulation = z.infer<typeof SpecialPopulationSchema>;
export type CitationRequest = z.infer<typeof CitationRequestSchema>;
export type MedicalTriageMCPInput = z.infer<typeof MedicalTriageMCPSchema>;

// Medical safety validators
export const medicalSafetyValidator = (response: string): string => {
  const dangerPatterns = [
    /ignore.*(chest pain|shortness of breath|severe headache|bleeding)/i,
    /wait.*weeks.*(severe|emergency|urgent|critical)/i,
    /definitely.*(cancer|heart attack|stroke|diagnosis)/i,
    /never.*seek.*(medical|help|doctor|emergency)/i,
    /just.*anxiety.*(chest pain|shortness of breath)/i,
  ];

  for (const pattern of dangerPatterns) {
    if (pattern.test(response)) {
      throw new Error(
        `Response contains potentially dangerous medical advice: ${pattern.source}`
      );
    }
  }

  return response;
};

// Emergency escalation validator
export const emergencyEscalationValidator = (
  careLevel: string,
  symptoms: string[]
): string => {
  const emergencyKeywords = [
    'chest pain',
    'difficulty breathing',
    'severe headache',
    'uncontrolled bleeding',
    'loss of consciousness',
    'confusion',
    'severe abdominal pain',
    'poisoning',
  ];

  const hasEmergencySymptoms = symptoms.some((symptom) =>
    emergencyKeywords.some((keyword) => symptom.toLowerCase().includes(keyword))
  );

  if (hasEmergencySymptoms && careLevel !== 'emergency') {
    throw new Error(
      `Emergency symptoms detected but care level is ${careLevel}. Must escalate to emergency.`
    );
  }

  return careLevel;
};
