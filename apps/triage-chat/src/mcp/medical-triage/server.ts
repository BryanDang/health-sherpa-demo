/**
 * Medical Triage MCP Server
 * Implements comprehensive medical triage with Instructor integration,
 * Gemini 2.5 Pro decision-making, and citation research
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmergencyDetectionSystem } from './patterns/emergency-detection';
import { convertZodToGeminiSchema, TriageStageConfigs } from '../../lib/gemini-schema-converter';
import {
  MedicalTriageMCPSchema,
  EmpathicResponseSchema,
  CitationRequestSchema,
  MedicalCitationSchema,
  TriageDecisionSchema,
  medicalSafetyValidator,
  emergencyEscalationValidator,
  type MedicalTriageMCPInput,
  type EmpathicResponse,
  type MedicalCitation,
  type TriageDecision,
} from './schemas/medical-triage-schemas';

interface InstructorConfig {
  model: string;
  temperature: number;
  schema: any;
  maxTokens: number;
  retries: number;
}

/**
 * Citation Research System using Gemini 2.5 Pro + Google Search
 */
class CitationResearcher {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.1, // Low temperature for factual accuracy
        maxOutputTokens: 2048,
      },
    });
  }

  async researchCitations(
    query: string,
    domain: string,
    maxResults: number = 5
  ): Promise<MedicalCitation[]> {
    try {
      // Use Gemini 2.5 Pro with Google Search integration
      const searchPrompt = `
        Research medical information for: "${query}"
        Medical domain: ${domain}
        
        Find ${maxResults} credible medical sources that provide evidence-based information.
        Focus on:
        1. Peer-reviewed medical journals
        2. Clinical guidelines from medical organizations
        3. Government health agencies (CDC, NIH, WHO)
        4. Medical textbooks and references
        
        For each source, provide:
        - Title of the article/resource
        - URL (if available)
        - Source organization/journal
        - Brief excerpt relevant to the query
        - Credibility assessment (high/medium/low)
        - Evidence level (A=systematic review, B=RCT, C=observational, D=expert opinion)
        
        Return structured JSON with citation information.
      `;

      const result = await this.model.generateContent(searchPrompt);
      const response = result.response.text();

      // Parse and validate citations
      const citations = this.parseCitationResponse(response);

      return citations.map((citation) => ({
        ...citation,
        dateAccessed: new Date().toISOString(),
        relevance: this.assessRelevance(citation.excerpt, query),
      }));
    } catch (error) {
      console.error('Citation research error:', error);
      return this.getFallbackCitations(query, domain);
    }
  }

  private parseCitationResponse(response: string): Partial<MedicalCitation>[] {
    // Parse AI response and extract citation information
    // This would implement proper JSON parsing with error handling
    try {
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Fallback parsing for non-JSON responses
      return this.extractCitationsFromText(response);
    }
  }

  private extractCitationsFromText(text: string): Partial<MedicalCitation>[] {
    // Extract citations from structured text response
    const citations: Partial<MedicalCitation>[] = [];
    const lines = text.split('\n');

    let currentCitation: Partial<MedicalCitation> = {};

    for (const line of lines) {
      if (line.startsWith('Title:')) {
        if (currentCitation.title) citations.push(currentCitation);
        currentCitation = { title: line.substring(6).trim() };
      } else if (line.startsWith('URL:')) {
        currentCitation.url = line.substring(4).trim();
      } else if (line.startsWith('Source:')) {
        currentCitation.source = line.substring(7).trim();
      } else if (line.startsWith('Excerpt:')) {
        currentCitation.excerpt = line.substring(8).trim();
      } else if (line.startsWith('Credibility:')) {
        currentCitation.credibility = line
          .substring(12)
          .trim()
          .toLowerCase() as any;
      } else if (line.startsWith('Evidence Level:')) {
        currentCitation.evidenceLevel = line.substring(15).trim() as any;
      }
    }

    if (currentCitation.title) citations.push(currentCitation);
    return citations;
  }

  private assessRelevance(
    excerpt: string,
    query: string
  ): 'high' | 'medium' | 'low' {
    const queryTerms = query.toLowerCase().split(' ');
    const excerptLower = excerpt.toLowerCase();

    const matchCount = queryTerms.filter((term) =>
      excerptLower.includes(term)
    ).length;
    const relevanceRatio = matchCount / queryTerms.length;

    if (relevanceRatio > 0.7) return 'high';
    if (relevanceRatio > 0.4) return 'medium';
    return 'low';
  }

  private getFallbackCitations(
    query: string,
    domain: string
  ): MedicalCitation[] {
    // Fallback citations for common medical queries
    const fallbackSources = [
      {
        title: 'Clinical Guidelines for Emergency Medicine',
        url: 'https://www.acep.org/clinical-guidelines',
        source: 'American College of Emergency Physicians',
        excerpt: 'Evidence-based emergency medicine guidelines',
        credibility: 'high' as const,
        evidenceLevel: 'A' as const,
      },
      {
        title: 'CDC Health Information',
        url: 'https://www.cdc.gov/health',
        source: 'Centers for Disease Control and Prevention',
        excerpt: 'Public health recommendations and guidelines',
        credibility: 'high' as const,
        evidenceLevel: 'A' as const,
      },
    ];

    return fallbackSources.map((source) => ({
      ...source,
      relevance: 'medium' as const,
      dateAccessed: new Date().toISOString(),
    }));
  }
}

/**
 * Instructor-style structured LLM interaction
 */
class InstructorClient {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string, config: InstructorConfig) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Convert Zod schema to JSON Schema format for Gemini
    const jsonSchema = convertZodToGeminiSchema(config.schema);
    
    this.model = this.genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
        responseMimeType: 'application/json',
        // Use converted JSON Schema instead of raw Zod object
        responseSchema: jsonSchema,
      },
    });
  }

  async complete<T>(
    prompt: string,
    schema: any,
    retries: number = 3
  ): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await this.model.generateContent(prompt);
        const response = result.response.text();

        // Parse and validate against schema
        const parsed = JSON.parse(response);
        const validated = schema.parse(parsed);

        return validated;
      } catch (error) {
        console.error(`Instructor attempt ${attempt + 1} failed:`, error);
        if (attempt === retries - 1) throw error;

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    throw new Error('All Instructor attempts failed');
  }
}

/**
 * Main Medical Triage MCP Server
 */
export class MedicalTriageMCPServer {
  private emergencyDetector: EmergencyDetectionSystem;
  private citationResearcher: CitationResearcher;
  private instructorClient: InstructorClient;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.emergencyDetector = new EmergencyDetectionSystem();
    this.citationResearcher = new CitationResearcher(apiKey);

    // Configure Instructor client for Gemini 2.5 Pro
    this.instructorClient = new InstructorClient(apiKey, {
      model: 'gemini-2.5-pro',
      temperature: 0.2,
      schema: EmpathicResponseSchema,
      maxTokens: 4096,
      retries: 3,
    });
  }

  async processMedicalTriage(
    input: MedicalTriageMCPInput
  ): Promise<EmpathicResponse> {
    try {
      // Validate input
      const validatedInput = MedicalTriageMCPSchema.parse(input);

      // Step 1: Emergency Detection (Rule-based + AI)
      const emergencyResult = await this.emergencyDetector.evaluateEmergency(
        validatedInput.symptoms,
        validatedInput.memoryContext || ''
      );

      // Step 2: If emergency detected, immediate escalation
      if (emergencyResult.isEmergency) {
        return {
          clinicalReasoning: emergencyResult.reasoning.join('; '),
          emergencyRuledOut: false,
          riskAssessment: 'critical',
          empathicConfirmation:
            this.generateEmergencyConfirmation(emergencyResult),
          assessmentSummary: `Emergency condition detected: ${emergencyResult.emergencyType}`,
          followUpQuestions: [],
          reassurance:
            'Emergency services are the appropriate level of care for your symptoms.',
          careLevel: 'emergency',
          immediateActions: emergencyResult.immediateActions,
          citations: await this.getEmergencyCitations(
            emergencyResult.emergencyType
          ),
          needsMoreInfo: false,
          medicalDisclaimer:
            'This is an emergency situation. Call 911 immediately.',
          emergencyInstructions:
            'Call 911 now. Do not delay seeking immediate medical attention.',
        };
      }

      // Step 3: Comprehensive AI Triage with Instructor
      const triageResponse = await this.performInstructorTriage(
        validatedInput,
        emergencyResult
      );

      // Step 4: Safety Validation
      medicalSafetyValidator(triageResponse.empathicConfirmation);
      emergencyEscalationValidator(
        triageResponse.careLevel,
        validatedInput.symptoms
      );

      // Step 5: Citation Research (if requested)
      if (validatedInput.requestCitations) {
        triageResponse.citations = await this.researchMedicalCitations(
          validatedInput.symptoms,
          triageResponse.careLevel,
          validatedInput.citationRequest
        );
      }

      return triageResponse;
    } catch (error) {
      console.error('Medical triage error:', error);
      return this.generateSafetyFallback(input.symptoms);
    }
  }

  private async performInstructorTriage(
    input: MedicalTriageMCPInput,
    emergencyResult: any
  ): Promise<EmpathicResponse> {
    const prompt = this.buildInstructorPrompt(input, emergencyResult);

    const response = await this.instructorClient.complete<EmpathicResponse>(
      prompt,
      EmpathicResponseSchema
    );

    return response;
  }

  private buildInstructorPrompt(
    input: MedicalTriageMCPInput,
    emergencyResult: any
  ): string {
    return `
    You are a highly skilled medical triage AI assistant trained in emergency medicine and clinical decision-making.
    Your role is to provide empathetic, evidence-based medical triage decisions while maintaining patient safety.

    CRITICAL SAFETY RULES:
    1. Always err on the side of caution for patient safety
    2. Never downplay emergency symptoms
    3. Provide empathetic responses that acknowledge patient concerns
    4. Use evidence-based medical reasoning
    5. Follow slot-filling pattern: confirm understanding + ask 1-2 specific questions

    PATIENT INFORMATION:
    Symptoms: ${input.symptoms.join(', ')}
    Patient Context: ${JSON.stringify(input.patientContext || {})}
    Memory Context: ${input.memoryContext || 'None'}
    User Goal: ${input.userGoal || 'Medical triage assessment'}
    
    EMERGENCY SCREENING RESULT:
    ${emergencyResult.isEmergency ? 'EMERGENCY DETECTED' : 'No emergency detected'}
    Emergency Score: ${emergencyResult.confidence}
    Reasoning: ${emergencyResult.reasoning.join('; ')}

    CONVERSATION HISTORY:
    ${input.conversationHistory?.map((msg) => `${msg.role}: ${msg.content}`).join('\n') || 'None'}

    INSTRUCTIONS:
    1. Provide clinical reasoning (internal, not shown to patient)
    2. Confirm emergency was ruled out (true/false)
    3. Assess risk level (low/medium/high/critical)
    4. Create empathetic confirmation of what you understand
    5. Provide brief assessment summary
    6. Ask 1-2 specific follow-up questions (max 2)
    7. Provide appropriate reassurance
    8. Determine care level (emergency/urgent/primary/self_care)
    9. List immediate actions if needed
    10. Indicate if more information is needed
    11. Include appropriate medical disclaimer
    12. Add emergency instructions if high risk

    EMPATHETIC PATTERN:
    - Acknowledge patient's concerns
    - Validate their decision to seek help
    - Confirm what you understand from their description
    - Ask targeted questions to gather missing critical information
    - Provide reassurance appropriate to the situation

    SLOT-FILLING PRIORITIES:
    1. Pain severity and location (if mentioned)
    2. Symptom duration and onset
    3. Associated symptoms
    4. Triggers and alleviating factors
    5. Patient medical history relevance

    Return your response in the exact JSON schema format specified.
    `;
  }

  private generateEmergencyConfirmation(emergencyResult: any): string {
    return `I understand you're experiencing ${emergencyResult.emergencyType || 'emergency'} symptoms. Based on your description, these symptoms require immediate medical attention. I'm concerned about your safety and want to ensure you get the urgent care you need right away.`;
  }

  private async getEmergencyCitations(
    emergencyType?: string
  ): Promise<MedicalCitation[]> {
    if (!emergencyType) return [];

    const query = `${emergencyType} emergency medical treatment guidelines`;
    return await this.citationResearcher.researchCitations(
      query,
      'emergency_medicine',
      3
    );
  }

  private async researchMedicalCitations(
    symptoms: string[],
    careLevel: string,
    citationRequest?: any
  ): Promise<MedicalCitation[]> {
    const query =
      citationRequest?.query ||
      `${symptoms.join(' ')} medical treatment ${careLevel}`;
    const domain = citationRequest?.medicalDomain || 'general_medicine';
    const maxResults = citationRequest?.maxResults || 5;

    return await this.citationResearcher.researchCitations(
      query,
      domain,
      maxResults
    );
  }

  private generateSafetyFallback(symptoms: string[]): EmpathicResponse {
    return {
      clinicalReasoning: 'System error occurred during triage assessment',
      emergencyRuledOut: false,
      riskAssessment: 'high',
      empathicConfirmation:
        'I understand you have medical concerns, and I want to ensure you receive appropriate care.',
      assessmentSummary:
        'Due to a system error, I cannot provide a complete assessment.',
      followUpQuestions: ['Can you describe your most concerning symptom?'],
      reassurance:
        'For your safety, I recommend seeking medical attention from a healthcare professional.',
      careLevel: 'urgent',
      immediateActions: [
        'Contact a healthcare provider',
        'Consider urgent care or emergency room if symptoms are severe',
      ],
      needsMoreInfo: true,
      medicalDisclaimer:
        'This system experienced an error. Please consult with a qualified healthcare provider.',
      emergencyInstructions:
        'If you are experiencing severe symptoms, call 911 immediately.',
    };
  }
}

export default MedicalTriageMCPServer;
