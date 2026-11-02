/**
 * Two-Stage Gemini Triage System
 * Stage 1: Empathetic Triage Nurse (Gemini 2.0 Flash) - High temp for empathy
 * Stage 2: Precision Medical MCP (Gemini 2.5 Pro) - Low temp for accuracy
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { convertZodToGeminiSchema } from './gemini-schema-converter';

// Stage 1: Empathetic conversation response schema
const EmpathicNurseResponseSchema = z.object({
  isEmergency: z.boolean(),
  emergencyReason: z.string().optional(),
  patientState: z.object({
    emotionalState: z.enum(['anxious', 'calm', 'distressed', 'confused', 'cooperative']),
    communicationLevel: z.enum(['clear', 'confused', 'minimal', 'detailed']),
    urgencyPerception: z.enum(['low', 'moderate', 'high', 'critical'])
  }),
  gatheredInformation: z.object({
    symptoms: z.array(z.string()),
    duration: z.string().optional(),
    severity: z.number().min(1).max(10).optional(),
    location: z.string().optional(),
    triggers: z.array(z.string()).optional(),
    medicationsOrAllergies: z.array(z.string()).optional(),
    medicalHistory: z.array(z.string()).optional()
  }),
  nurseResponse: z.string(),
  needsMoreInfo: z.boolean(),
  specificQuestions: z.array(z.string()).max(2),
  readyForMCP: z.boolean(),
  consentNeeded: z.object({
    location: z.boolean(),
    pricing: z.boolean()
  }).optional()
});

// Stage 2: Precision medical MCP response schema  
const PrecisionMCPResponseSchema = z.object({
  triageDecision: z.object({
    careLevel: z.enum(['emergency', 'urgent', 'primary', 'self_care']),
    confidence: z.number().min(0).max(1),
    timeframe: z.string(),
    clinicalReasoning: z.array(z.string())
  }),
  medicalAssessment: z.object({
    primaryConcern: z.string(),
    differentialDiagnosis: z.array(z.string()),
    redFlags: z.array(z.string()),
    riskFactors: z.array(z.string())
  }),
  recommendations: z.object({
    immediateActions: z.array(z.string()),
    followUpCare: z.array(z.string()),
    selfCareAdvice: z.array(z.string()).optional(),
    whenToSeekEmergencyCare: z.array(z.string())
  }),
  needsMoreInformation: z.boolean(),
  missingDataRequests: z.array(z.object({
    parameter: z.string(),
    question: z.string(),
    priority: z.enum(['critical', 'important', 'helpful'])
  })),
  citations: z.array(z.object({
    source: z.string(),
    evidenceLevel: z.string(),
    relevance: z.string()
  })).optional(),
  disclaimer: z.string()
});

export type EmpathicNurseResponse = z.infer<typeof EmpathicNurseResponseSchema>;
export type PrecisionMCPResponse = z.infer<typeof PrecisionMCPResponseSchema>;

export class TwoStageTriageSystem {
  private genAI: GoogleGenerativeAI;
  private empathicNurseModel: any;
  private precisionMCPModel: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Stage 1: Empathetic Nurse (High temperature for warmth and empathy)
    this.empathicNurseModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.8, // High for empathy and natural conversation
        topP: 0.9,        // High for creative empathetic responses
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: convertZodToGeminiSchema(EmpathicNurseResponseSchema)
      }
    });

    // Stage 2: Precision Medical MCP (Low temperature for accuracy)
    this.precisionMCPModel = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.2, // Low for precise medical decisions
        topP: 0.3,        // Low for focused medical reasoning
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: convertZodToGeminiSchema(PrecisionMCPResponseSchema)
      }
    });
  }

  /**
   * Stage 1: Empathetic Triage Nurse
   * Focuses on building rapport, gathering information empathetically,
   * and preparing structured data for medical MCP
   */
  async stage1_empathicNurse(
    userMessage: string,
    conversationHistory: Array<{role: string, content: string}> = [],
    previousGatheredInfo?: any
  ): Promise<EmpathicNurseResponse> {
    
    const prompt = this.buildEmpathicNursePrompt(userMessage, conversationHistory, previousGatheredInfo);
    
    try {
      const result = await this.empathicNurseModel.generateContent(prompt);
      const responseText = result.response.text();
      
      // Parse and validate response
      const parsed = JSON.parse(responseText);
      const validated = EmpathicNurseResponseSchema.parse(parsed);
      
      return validated;
    } catch (error) {
      console.error('Stage 1 Empathic Nurse error:', error);
      
      // Emergency fallback for breathing problems
      if (userMessage.toLowerCase().includes('breath') || 
          userMessage.toLowerCase().includes('breating') ||
          userMessage.toLowerCase().includes('trouble breathing')) {
        return {
          isEmergency: true,
          emergencyReason: 'Breathing difficulties require immediate medical attention',
          patientState: {
            emotionalState: 'distressed',
            communicationLevel: 'clear',
            urgencyPerception: 'critical'
          },
          gatheredInformation: {
            symptoms: ['breathing difficulty'],
            severity: 9
          },
          nurseResponse: 'I understand you\'re having trouble breathing. This is a medical emergency. Please call 911 immediately or go to your nearest emergency room. Do not wait.',
          needsMoreInfo: false,
          specificQuestions: [],
          readyForMCP: true
        };
      }
      
      // Safe fallback response
      return {
        isEmergency: false,
        patientState: {
          emotionalState: 'anxious',
          communicationLevel: 'clear', 
          urgencyPerception: 'moderate'
        },
        gatheredInformation: {
          symptoms: [userMessage]
        },
        nurseResponse: 'I understand you have health concerns. To help you better, could you tell me more about what symptoms you\'re experiencing?',
        needsMoreInfo: true,
        specificQuestions: ['What symptoms are you experiencing?', 'How long have you had these symptoms?'],
        readyForMCP: false
      };
    }
  }

  /**
   * Stage 2: Precision Medical MCP
   * Takes structured data from Stage 1 and makes precise medical decisions
   * with citations and evidence-based reasoning
   */
  async stage2_precisionMCP(
    gatheredData: EmpathicNurseResponse,
    requestCitations: boolean = false
  ): Promise<PrecisionMCPResponse> {
    
    const prompt = this.buildPrecisionMCPPrompt(gatheredData, requestCitations);
    
    try {
      const result = await this.precisionMCPModel.generateContent(prompt);
      const responseText = result.response.text();
      
      // Parse and validate response
      const parsed = JSON.parse(responseText);
      const validated = PrecisionMCPResponseSchema.parse(parsed);
      
      return validated;
    } catch (error) {
      console.error('Stage 2 Precision MCP error:', error);
      
      // Safe fallback for medical decisions
      return {
        triageDecision: {
          careLevel: 'primary',
          confidence: 0.5,
          timeframe: 'Within 1-2 days',
          clinicalReasoning: ['Unable to complete full medical assessment due to system error']
        },
        medicalAssessment: {
          primaryConcern: gatheredData.gatheredInformation.symptoms[0] || 'Health concern',
          differentialDiagnosis: ['Assessment incomplete'],
          redFlags: [],
          riskFactors: []
        },
        recommendations: {
          immediateActions: ['Contact your healthcare provider'],
          followUpCare: ['Schedule appointment with primary care physician'],
          whenToSeekEmergencyCare: ['If symptoms worsen significantly', 'If you develop severe pain, difficulty breathing, or other concerning symptoms']
        },
        needsMoreInformation: true,
        missingDataRequests: [{
          parameter: 'complete_assessment',
          question: 'Please contact a healthcare provider for proper medical evaluation',
          priority: 'critical' as const
        }],
        disclaimer: 'This assessment was incomplete due to a system error. Please consult with a qualified healthcare provider for proper medical evaluation.'
      };
    }
  }

  /**
   * Complete two-stage triage process
   */
  async performCompleteTriage(
    userMessage: string,
    conversationHistory: Array<{role: string, content: string}> = [],
    previousGatheredInfo?: any,
    requestCitations: boolean = false
  ): Promise<{
    stage1: EmpathicNurseResponse;
    stage2?: PrecisionMCPResponse;
    finalResponse: string;
    careLevel: string;
    isEmergency: boolean;
  }> {
    
    // Stage 1: Empathetic information gathering
    const stage1Result = await this.stage1_empathicNurse(userMessage, conversationHistory, previousGatheredInfo);
    
    // If emergency detected, return immediately
    if (stage1Result.isEmergency) {
      return {
        stage1: stage1Result,
        finalResponse: stage1Result.nurseResponse,
        careLevel: 'emergency',
        isEmergency: true
      };
    }
    
    // If more information needed, return Stage 1 response
    if (!stage1Result.readyForMCP || stage1Result.needsMoreInfo) {
      return {
        stage1: stage1Result,
        finalResponse: stage1Result.nurseResponse,
        careLevel: 'pending',
        isEmergency: false
      };
    }
    
    // Stage 2: Precision medical decision
    const stage2Result = await this.stage2_precisionMCP(stage1Result, requestCitations);
    
    // Combine responses for final output
    const finalResponse = this.combineStageResponses(stage1Result, stage2Result);
    
    return {
      stage1: stage1Result,
      stage2: stage2Result,
      finalResponse,
      careLevel: stage2Result.triageDecision.careLevel,
      isEmergency: stage2Result.triageDecision.careLevel === 'emergency'
    };
  }

  private buildEmpathicNursePrompt(
    userMessage: string,
    conversationHistory: Array<{role: string, content: string}>,
    previousGatheredInfo?: any
  ): string {
    return `
You are Sarah, an experienced emergency triage nurse with 15+ years in emergency medicine. You are known for your exceptional empathy, active listening skills, and ability to quickly assess medical situations while keeping patients calm and informed.

CRITICAL EMERGENCY DETECTION:
- ANY mention of breathing problems (breath, breathing, breating, trouble breathing, can't breathe, etc.) = IMMEDIATE EMERGENCY
- Chest pain = EMERGENCY
- Severe bleeding = EMERGENCY  
- Loss of consciousness = EMERGENCY
- Severe allergic reactions = EMERGENCY

CONVERSATION HISTORY:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

CURRENT PATIENT MESSAGE:
"${userMessage}"

PREVIOUS GATHERED INFORMATION:
${JSON.stringify(previousGatheredInfo || {}, null, 2)}

YOUR ROLE AS EMPATHETIC TRIAGE NURSE:

1. **EMERGENCY SCREENING** (First Priority):
   - Immediately assess for life-threatening conditions
   - If emergency detected: Set isEmergency: true, provide clear emergency instructions
   - Do NOT ask clarifying questions for breathing problems - treat as emergency immediately

2. **EMPATHETIC COMMUNICATION** (Your Specialty):
   - Mirror the patient's emotional state and validate their concerns
   - Use phrases like "I understand...", "That must be...", "I can hear that you're..."
   - Acknowledge their decision to seek help: "You did the right thing reaching out"
   - Build trust through professional warmth and competence

3. **INFORMATION GATHERING** (Medical Focus):
   - Ask ONE or TWO specific, targeted questions maximum
   - Focus on critical triage information: symptoms, duration, severity, triggers
   - Use your medical expertise to identify what's most important to know
   - Prepare structured data for the medical decision system

4. **PATIENT STATE ASSESSMENT**:
   - Assess emotional state: anxious, calm, distressed, confused, cooperative
   - Evaluate communication clarity and patient's perception of urgency
   - Adjust your communication style accordingly

5. **READINESS FOR MEDICAL DECISION**:
   - Determine if you have enough information for the medical system to make a triage decision
   - Only set readyForMCP: true when you have sufficient clinical data
   - Consider if location/pricing consent might be needed for recommendations

SLOT-FILLING PRIORITIES (What the medical system needs):
1. Primary symptoms (clear, specific descriptions)
2. Duration and onset pattern
3. Severity/intensity (1-10 scale)
4. Location on body (if relevant)
5. Triggers, alleviating factors, worsening factors
6. Associated symptoms
7. Relevant medical history and medications

EMPATHETIC RESPONSE PATTERNS:
- "I understand you're experiencing [symptom]. That must be concerning."
- "You were absolutely right to reach out about this."
- "Let me help you figure out the best next steps."
- "I can hear the [worry/pain/concern] in your message."
- "Based on my nursing experience, I want to make sure we get you the right level of care."

Return your assessment in the specified JSON format.
    `;
  }

  private buildPrecisionMCPPrompt(
    gatheredData: EmpathicNurseResponse,
    requestCitations: boolean
  ): string {
    return `
You are a precision medical decision system with access to comprehensive medical knowledge, clinical guidelines, and evidence-based medicine. You receive structured patient data from a triage nurse and must make accurate, evidence-based medical triage decisions.

GATHERED PATIENT DATA FROM TRIAGE NURSE:
${JSON.stringify(gatheredData, null, 2)}

YOUR MEDICAL DECISION RESPONSIBILITIES:

1. **CLINICAL REASONING** (Evidence-Based):
   - Apply clinical decision rules and evidence-based guidelines
   - Consider differential diagnoses systematically
   - Identify red flags and risk factors
   - Use validated triage protocols (ESI, CTAS, etc.)

2. **TRIAGE DECISION** (Primary Output):
   - emergency: Life-threatening, needs 911/ER immediately
   - urgent: Needs care within 24 hours, urgent care appropriate
   - primary: Routine care, primary physician within days
   - self_care: Home management with monitoring

3. **RISK ASSESSMENT**:
   - Identify red flags that suggest serious pathology
   - Consider patient risk factors and medical history
   - Evaluate for time-sensitive conditions

4. **EVIDENCE-BASED RECOMMENDATIONS**:
   - Immediate actions based on clinical guidelines
   - Follow-up care recommendations
   - Clear criteria for when to escalate to emergency care
   - Self-care advice only when clinically appropriate

5. **INFORMATION GAPS** (Critical):
   - Identify missing critical clinical information
   - Request specific additional data needed for accurate assessment
   - Prioritize information requests by clinical importance

${requestCitations ? `
6. **MEDICAL CITATIONS** (Requested):
   - Reference clinical guidelines, studies, and evidence
   - Include evidence level (A-D) and source credibility
   - Focus on sources relevant to the specific condition
` : ''}

CLINICAL DECISION FRAMEWORK:
- Use systematic approach: History → Examination findings → Risk stratification → Disposition
- Apply Occam's razor but consider dangerous mimics
- When in doubt, recommend higher level of care for patient safety
- Never downplay concerning symptoms

EMERGENCY ESCALATION RULES:
- Breathing difficulties, chest pain, altered mental status = Emergency
- High fever (>103°F), severe pain (>8/10), uncontrolled bleeding = Emergency
- Any "red flag" symptoms in your medical training = Emergency

MEDICAL DISCLAIMER TEMPLATE:
"This triage assessment is not a substitute for professional medical evaluation. It is based on limited information and cannot replace in-person clinical assessment. When in doubt, seek immediate medical care."

Return your medical assessment in the specified JSON format with evidence-based reasoning.
    `;
  }

  private combineStageResponses(stage1: EmpathicNurseResponse, stage2: PrecisionMCPResponse): string {
    const nurseEmpathy = stage1.nurseResponse;
    const medicalDecision = stage2.triageDecision;
    const recommendations = stage2.recommendations;

    let combinedResponse = nurseEmpathy + '\n\n';

    // Add medical assessment
    combinedResponse += `Based on my clinical assessment, I recommend **${medicalDecision.careLevel}** care`;
    if (medicalDecision.timeframe) {
      combinedResponse += ` ${medicalDecision.timeframe.toLowerCase()}`;
    }
    combinedResponse += '.\n\n';

    // Add immediate actions
    if (recommendations.immediateActions.length > 0) {
      combinedResponse += '**Immediate steps to take:**\n';
      recommendations.immediateActions.forEach(action => {
        combinedResponse += `• ${action}\n`;
      });
      combinedResponse += '\n';
    }

    // Add follow-up care
    if (recommendations.followUpCare.length > 0) {
      combinedResponse += '**Follow-up care:**\n';
      recommendations.followUpCare.forEach(care => {
        combinedResponse += `• ${care}\n`;
      });
      combinedResponse += '\n';
    }

    // Add self-care if appropriate
    if (recommendations.selfCareAdvice && recommendations.selfCareAdvice.length > 0) {
      combinedResponse += '**Self-care measures:**\n';
      recommendations.selfCareAdvice.forEach(advice => {
        combinedResponse += `• ${advice}\n`;
      });
      combinedResponse += '\n';
    }

    // Add when to seek emergency care
    combinedResponse += '**Seek immediate emergency care if you experience:**\n';
    recommendations.whenToSeekEmergencyCare.forEach(warning => {
      combinedResponse += `• ${warning}\n`;
    });

    // Add disclaimer
    combinedResponse += `\n*${stage2.disclaimer}*`;

    return combinedResponse;
  }
}

export default TwoStageTriageSystem;