/**
 * MCP Integration Layer for Medical Triage
 * Connects the Medical Triage MCP Server to the existing triage API
 */

import { MedicalTriageMCPServer } from './server';
import {
  MedicalTriageMCPInput,
  EmpathicResponse,
  SpecialPopulationSchema,
  type SpecialPopulation,
} from './schemas/medical-triage-schemas';

interface TriageAPIRequest {
  message: string;
  context?: {
    age?: number;
    sex?: string;
    medical_history?: string[];
    medications?: string[];
    allergies?: string[];
  };
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  memory_context?: string;
  user_goal?: string;
}

interface TriageAPIResponse {
  message: string;
  care_level: 'emergency' | 'urgent' | 'primary' | 'self_care';
  confidence: number;
  reasoning: string[];
  red_flags: string[];
  immediate_actions: string[];
  citations?: Array<{
    title: string;
    url: string;
    source: string;
    excerpt: string;
    credibility: string;
  }>;
  needs_more_info: boolean;
  follow_up_questions: string[];
  medical_disclaimer: string;
  emergency_instructions?: string;
}

export class MedicalTriageMCPIntegration {
  private mcpServer: MedicalTriageMCPServer;
  private symptomExtractor: SymptomExtractor;
  private responseFormatter: ResponseFormatter;

  constructor(apiKey: string) {
    this.mcpServer = new MedicalTriageMCPServer(apiKey);
    this.symptomExtractor = new SymptomExtractor();
    this.responseFormatter = new ResponseFormatter();
  }

  async handleTriageRequest(
    request: TriageAPIRequest
  ): Promise<TriageAPIResponse> {
    try {
      // Step 1: Extract symptoms and context from natural language
      const extractedSymptoms = this.symptomExtractor.extractSymptoms(
        request.message
      );

      // Step 2: Process special populations
      const specialPopulation = this.detectSpecialPopulation(request.context);

      // Step 3: Build MCP input
      const mcpInput: MedicalTriageMCPInput = {
        symptoms: extractedSymptoms,
        patientContext: {
          age: request.context?.age,
          sex: request.context?.sex as any,
          medicalHistory: request.context?.medical_history,
          currentMedications: request.context?.medications,
          allergies: request.context?.allergies,
          specialPopulation: specialPopulation,
        },
        conversationHistory: request.conversation_history?.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp || new Date().toISOString(),
        })),
        memoryContext: request.memory_context,
        userGoal: request.user_goal || 'Get medical guidance for my symptoms',
        requestCitations: true,
        citationRequest: {
          query: `${extractedSymptoms.join(' ')} medical treatment`,
          medicalDomain: this.determineMedicalDomain(extractedSymptoms),
          evidenceLevel: 'clinical_trial',
          maxResults: 5,
        },
      };

      // Step 4: Process through MCP server
      const mcpResponse = await this.mcpServer.processMedicalTriage(mcpInput);

      // Step 5: Format for API response
      const apiResponse = this.responseFormatter.formatResponse(mcpResponse);

      return apiResponse;
    } catch (error) {
      console.error('MCP integration error:', error);
      return this.generateErrorResponse(request.message, error);
    }
  }

  private detectSpecialPopulation(
    context?: any
  ): SpecialPopulation | undefined {
    if (!context?.age) return undefined;

    const age = context.age;

    // Infant (0-12 months)
    if (age < 1) {
      return {
        populationType: 'infant',
        ageInMonths: age * 12,
        specialConsiderations: [
          'Infants dehydrate quickly',
          'Fever in infants <3 months requires immediate evaluation',
          'Different normal ranges for vital signs',
          'Higher risk for serious bacterial infections',
        ],
        additionalRedFlags: [
          'Any fever in infant <3 months',
          'Poor feeding or decreased urine output',
          'Excessive crying or lethargy',
          'Breathing difficulties',
        ],
      };
    }

    // Child (1-17 years)
    if (age < 18) {
      return {
        populationType: 'child',
        ageInMonths: age * 12,
        specialConsiderations: [
          'Children compensate well until suddenly decompensating',
          'Age-appropriate communication needed',
          'Parent/guardian involvement in care decisions',
          'Different medication dosing',
        ],
        additionalRedFlags: [
          'High fever with altered mental status',
          'Difficulty breathing or unusual breathing patterns',
          'Severe dehydration signs',
          'Persistent vomiting',
        ],
      };
    }

    // Elderly (65+ years)
    if (age >= 65) {
      return {
        populationType: 'elderly',
        specialConsiderations: [
          'Atypical symptom presentation common',
          'Multiple comorbidities affect treatment',
          'Polypharmacy considerations',
          'Higher risk for complications',
          'Delirium risk with infections',
        ],
        modifiedThresholds: {
          fever_threshold: 99.5, // Lower fever threshold
          pain_tolerance: 0.8, // May underreport pain
        },
        additionalRedFlags: [
          'New confusion or altered mental status',
          'Falls or mobility changes',
          'Medication interactions',
          'Failure to thrive',
        ],
      };
    }

    // Pregnancy considerations
    if (
      context.sex === 'female' &&
      context.medical_history?.includes('pregnancy')
    ) {
      return {
        populationType: 'pregnant',
        gestationalWeek: context.gestational_week,
        specialConsiderations: [
          'Physiological changes affect symptom interpretation',
          'Fetal safety considerations',
          'Medication restrictions',
          'Pregnancy-specific complications',
        ],
        additionalRedFlags: [
          'Vaginal bleeding',
          'Severe abdominal pain',
          'Decreased fetal movement',
          'Severe headache with vision changes',
          'Swelling of face/hands',
        ],
      };
    }

    return undefined;
  }

  private determineMedicalDomain(symptoms: string[]): string {
    const symptomText = symptoms.join(' ').toLowerCase();

    if (/chest pain|heart|cardiac|shortness.*breath/.test(symptomText)) {
      return 'emergency_medicine';
    }
    if (/fever|infection|cold|flu/.test(symptomText)) {
      return 'primary_care';
    }
    if (/cut|wound|injury|trauma/.test(symptomText)) {
      return 'urgent_care';
    }
    if (/child|infant|baby/.test(symptomText)) {
      return 'pediatrics';
    }
    if (/elderly|senior/.test(symptomText)) {
      return 'geriatrics';
    }
    if (/pregnant|pregnancy/.test(symptomText)) {
      return 'obstetrics';
    }

    return 'general_medicine';
  }

  private generateErrorResponse(
    message: string,
    error: any
  ): TriageAPIResponse {
    return {
      message:
        'I apologize, but I encountered an error while processing your medical query. For your safety, I recommend consulting with a healthcare professional directly.',
      care_level: 'urgent',
      confidence: 0.5,
      reasoning: [
        'System error occurred during triage assessment',
        'Safety escalation due to processing error',
        'Recommendation to seek professional medical advice',
      ],
      red_flags: ['System processing error'],
      immediate_actions: [
        'Contact a healthcare provider',
        'Consider urgent care if symptoms are concerning',
        'Call 911 if experiencing emergency symptoms',
      ],
      needs_more_info: true,
      follow_up_questions: [
        'Can you describe your most concerning symptom?',
        'Are you experiencing any emergency symptoms like difficulty breathing or chest pain?',
      ],
      medical_disclaimer:
        'This system experienced an error. Please consult with a qualified healthcare provider for proper medical evaluation.',
      emergency_instructions:
        'If you are experiencing severe symptoms, call 911 immediately.',
    };
  }
}

/**
 * Symptom Extraction using NLP techniques
 */
class SymptomExtractor {
  private medicalTerms: Set<string>;
  private bodyParts: Set<string>;
  private intensityWords: Set<string>;

  constructor() {
    this.medicalTerms = new Set([
      'pain',
      'ache',
      'sore',
      'hurt',
      'burning',
      'sharp',
      'dull',
      'throbbing',
      'fever',
      'chills',
      'headache',
      'nausea',
      'vomiting',
      'diarrhea',
      'constipation',
      'cough',
      'shortness of breath',
      'difficulty breathing',
      'wheezing',
      'dizzy',
      'lightheaded',
      'fainting',
      'weakness',
      'fatigue',
      'tired',
      'rash',
      'itching',
      'swelling',
      'bleeding',
      'bruising',
      'blurred vision',
      'double vision',
      'hearing loss',
      'ringing in ears',
      'difficulty swallowing',
      'sore throat',
      'hoarse voice',
      'chest pain',
      'palpitations',
      'irregular heartbeat',
      'abdominal pain',
      'stomach pain',
      'heartburn',
      'indigestion',
      'joint pain',
      'muscle pain',
      'back pain',
      'neck pain',
      'urinary frequency',
      'burning urination',
      'blood in urine',
      'confusion',
      'memory loss',
      'difficulty concentrating',
      'anxiety',
      'depression',
      'mood changes',
      'irritability',
    ]);

    this.bodyParts = new Set([
      'head',
      'neck',
      'shoulder',
      'arm',
      'elbow',
      'wrist',
      'hand',
      'finger',
      'chest',
      'back',
      'abdomen',
      'stomach',
      'hip',
      'leg',
      'knee',
      'ankle',
      'foot',
      'toe',
      'eye',
      'ear',
      'nose',
      'mouth',
      'throat',
      'jaw',
      'heart',
      'lung',
      'liver',
      'kidney',
      'bladder',
    ]);

    this.intensityWords = new Set([
      'severe',
      'intense',
      'excruciating',
      'unbearable',
      'terrible',
      'awful',
      'moderate',
      'mild',
      'slight',
      'minor',
      'little',
      'small',
      'sudden',
      'gradual',
      'chronic',
      'persistent',
      'constant',
      'intermittent',
      'sharp',
      'dull',
      'stabbing',
      'burning',
      'throbbing',
      'cramping',
    ]);
  }

  extractSymptoms(message: string): string[] {
    const symptoms: string[] = [];
    const words = message.toLowerCase().split(/\s+/);

    // Extract symptom phrases
    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Check for medical terms
      if (this.medicalTerms.has(word)) {
        let phrase = word;

        // Look for intensity modifiers before
        if (i > 0 && this.intensityWords.has(words[i - 1])) {
          phrase = `${words[i - 1]} ${phrase}`;
        }

        // Look for body parts after
        if (i < words.length - 1 && this.bodyParts.has(words[i + 1])) {
          phrase = `${phrase} ${words[i + 1]}`;
        }

        symptoms.push(phrase);
      }

      // Check for body part + pain/symptom combinations
      if (this.bodyParts.has(word) && i < words.length - 1) {
        const nextWord = words[i + 1];
        if (this.medicalTerms.has(nextWord)) {
          symptoms.push(`${word} ${nextWord}`);
        }
      }
    }

    // Extract numeric pain scales
    const painScaleMatch = message.match(
      /(\d+)\s*(?:out of|\/)\s*10|(\d+)\/10/i
    );
    if (painScaleMatch) {
      const scale = painScaleMatch[1] || painScaleMatch[2];
      symptoms.push(`pain level ${scale}/10`);
    }

    // Extract duration information
    const durationMatch = message.match(
      /(\d+)\s*(minute|hour|day|week|month)s?/i
    );
    if (durationMatch) {
      symptoms.push(`duration ${durationMatch[1]} ${durationMatch[2]}s`);
    }

    // Remove duplicates and return
    return [...new Set(symptoms)];
  }
}

/**
 * Response Formatter for API compatibility
 */
class ResponseFormatter {
  formatResponse(mcpResponse: EmpathicResponse): TriageAPIResponse {
    return {
      message: this.buildResponseMessage(mcpResponse),
      care_level: mcpResponse.careLevel,
      confidence: this.calculateConfidence(mcpResponse),
      reasoning: this.extractReasoning(mcpResponse),
      red_flags: this.extractRedFlags(mcpResponse),
      immediate_actions: mcpResponse.immediateActions,
      citations: mcpResponse.citations?.map((citation) => ({
        title: citation.title,
        url: citation.url,
        source: citation.source,
        excerpt: citation.excerpt,
        credibility: citation.credibility,
      })),
      needs_more_info: mcpResponse.needsMoreInfo,
      follow_up_questions: mcpResponse.followUpQuestions,
      medical_disclaimer: mcpResponse.medicalDisclaimer,
      emergency_instructions: mcpResponse.emergencyInstructions,
    };
  }

  private buildResponseMessage(mcpResponse: EmpathicResponse): string {
    let message = mcpResponse.empathicConfirmation;

    if (mcpResponse.assessmentSummary) {
      message += `\n\n${mcpResponse.assessmentSummary}`;
    }

    if (mcpResponse.reassurance) {
      message += `\n\n${mcpResponse.reassurance}`;
    }

    if (mcpResponse.followUpQuestions.length > 0) {
      message += `\n\nTo help me provide the most accurate guidance, I'd like to know:\n`;
      mcpResponse.followUpQuestions.forEach((question, index) => {
        message += `${index + 1}. ${question}\n`;
      });
    }

    return message;
  }

  private calculateConfidence(mcpResponse: EmpathicResponse): number {
    // Map risk assessment to confidence levels
    const riskToConfidence = {
      low: 0.9,
      medium: 0.7,
      high: 0.5,
      critical: 0.95, // High confidence in emergency detection
    };

    return riskToConfidence[mcpResponse.riskAssessment] || 0.6;
  }

  private extractReasoning(mcpResponse: EmpathicResponse): string[] {
    const reasoning = [];

    if (mcpResponse.clinicalReasoning) {
      reasoning.push(mcpResponse.clinicalReasoning);
    }

    if (mcpResponse.emergencyRuledOut) {
      reasoning.push(
        'Emergency conditions ruled out based on symptom assessment'
      );
    }

    reasoning.push(`Risk level assessed as: ${mcpResponse.riskAssessment}`);
    reasoning.push(`Recommended care level: ${mcpResponse.careLevel}`);

    return reasoning;
  }

  private extractRedFlags(mcpResponse: EmpathicResponse): string[] {
    const redFlags = [];

    if (mcpResponse.riskAssessment === 'critical') {
      redFlags.push('Critical risk assessment');
    }

    if (mcpResponse.riskAssessment === 'high') {
      redFlags.push('High risk symptoms identified');
    }

    if (!mcpResponse.emergencyRuledOut) {
      redFlags.push('Emergency conditions not fully ruled out');
    }

    return redFlags;
  }
}

export default MedicalTriageMCPIntegration;
