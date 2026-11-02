/**
 * Hybrid Medical Classifier
 * Combines rule-based emergency detection with AI-powered complex case analysis
 */

export interface MedicalClassification {
  careLevel: 'emergency' | 'urgent' | 'primary' | 'self_care';
  confidence: number;
  reasoning: string[];
  redFlags: string[];
  needsMoreInfo: boolean;
  clarificationQuestions: string[];
  emergencyRuled: boolean; // Critical: did we rule out emergency?
  pattern?: string;
}

export interface EmergencyPattern {
  name: string;
  evaluate(symptoms: string[], context: string): EmergencyResult;
}

export interface EmergencyResult {
  isEmergency: boolean;
  confidence: number;
  reasoning: string[];
  redFlags: string[];
  pattern: string;
}

/**
 * Bleeding Emergency Pattern - handles uncontrolled bleeding cases
 */
class BleedingEmergencyPattern implements EmergencyPattern {
  name = 'bleeding_emergency';

  evaluate(symptoms: string[], context: string): EmergencyResult {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();

    const indicators = {
      hasBleedingKeyword: /bleeding|blood|hemorrhag|cut|wound|lacerat/.test(
        text
      ),
      isDurationCritical: this.extractDuration(text) > 15, // minutes
      isUncontrolled:
        /won't stop|continuous|despite pressure|soaking|pooling|through/.test(
          text
        ),
      isSevereLocation: /artery|arterial|head|neck|chest|abdomen|femoral/.test(
        text
      ),
      isDeepWound: /deep|severe|gaping|to bone|muscle|fat/.test(text),
      isProfuse: /profuse|heavy|lots|pouring|spurting/.test(text),
      failedTreatment: /despite|tried|pressure|bandage.*soaked/.test(text),
    };

    // Evidence-based emergency scoring
    const emergencyScore =
      (indicators.hasBleedingKeyword ? 2 : 0) +
      (indicators.isDurationCritical ? 4 : 0) + // Time critical
      (indicators.isUncontrolled ? 3 : 0) +
      (indicators.isSevereLocation ? 3 : 0) +
      (indicators.isDeepWound ? 2 : 0) +
      (indicators.isProfuse ? 2 : 0) +
      (indicators.failedTreatment ? 3 : 0);

    const isEmergency = emergencyScore >= 6;
    const confidence = Math.min(emergencyScore / 15, 1.0);

    return {
      isEmergency,
      confidence,
      reasoning: this.buildReasoning(indicators, emergencyScore),
      redFlags: this.extractRedFlags(indicators),
      pattern: this.name,
    };
  }

  private extractDuration(text: string): number {
    // Extract duration in minutes
    const patterns = [
      /(\d+)\s*minutes?/i,
      /(\d+)\s*mins?/i,
      /(\d+)\s*hours?/i, // Convert hours to minutes
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        return text.includes('hour') ? value * 60 : value;
      }
    }

    // Check for descriptive durations
    if (/long time|while|ages/.test(text)) return 30;
    return 0;
  }

  private buildReasoning(indicators: any, score: number): string[] {
    const reasoning = [];

    if (indicators.isDurationCritical) {
      reasoning.push('Bleeding duration >15 minutes indicates emergency');
    }
    if (indicators.isUncontrolled) {
      reasoning.push('Uncontrolled bleeding despite treatment');
    }
    if (indicators.isSevereLocation) {
      reasoning.push('Bleeding in critical anatomical location');
    }
    if (indicators.isDeepWound) {
      reasoning.push('Deep wound indicating possible vessel damage');
    }
    if (indicators.failedTreatment) {
      reasoning.push('Failed response to standard bleeding control');
    }

    reasoning.push(`Emergency score: ${score}/15 (threshold: 6)`);
    return reasoning;
  }

  private extractRedFlags(indicators: any): string[] {
    const redFlags = [];
    if (indicators.isDurationCritical) redFlags.push('Prolonged bleeding');
    if (indicators.isUncontrolled) redFlags.push('Uncontrolled hemorrhage');
    if (indicators.isSevereLocation)
      redFlags.push('Critical bleeding location');
    return redFlags;
  }
}

/**
 * Cardiac Emergency Pattern - chest pain, heart attack symptoms
 */
class CardiacEmergencyPattern implements EmergencyPattern {
  name = 'cardiac_emergency';

  evaluate(symptoms: string[], context: string): EmergencyResult {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();

    const indicators = {
      hasChestPain: /chest pain|chest pressure|chest tight|crushing/.test(text),
      hasRadiation:
        /arm|jaw|neck|back|shoulder/.test(text) && /pain|ache|numb/.test(text),
      hasSOB: /short.*breath|difficulty breath|can't breath|gasping/.test(text),
      hasSweating: /sweat|diaphor|clam/.test(text),
      hasNausea: /nausea|vomit|sick/.test(text),
      isExertional: /exercise|stairs|walking|exertion/.test(text),
      isSevere: /severe|worst|unbearable|crushing|elephant/.test(text),
    };

    const emergencyScore =
      (indicators.hasChestPain ? 4 : 0) +
      (indicators.hasRadiation ? 3 : 0) +
      (indicators.hasSOB ? 3 : 0) +
      (indicators.hasSweating ? 2 : 0) +
      (indicators.hasNausea ? 1 : 0) +
      (indicators.isSevere ? 3 : 0);

    const isEmergency = emergencyScore >= 7;

    return {
      isEmergency,
      confidence: Math.min(emergencyScore / 16, 1.0),
      reasoning: this.buildCardiacReasoning(indicators, emergencyScore),
      redFlags: this.extractCardiacRedFlags(indicators),
      pattern: this.name,
    };
  }

  private buildCardiacReasoning(indicators: any, score: number): string[] {
    const reasoning = [];
    if (indicators.hasChestPain) reasoning.push('Chest pain/pressure present');
    if (indicators.hasRadiation)
      reasoning.push('Pain radiating to arm/jaw/neck');
    if (indicators.hasSOB) reasoning.push('Associated shortness of breath');
    if (indicators.isSevere) reasoning.push('Severe pain intensity');
    reasoning.push(`Cardiac emergency score: ${score}/16 (threshold: 7)`);
    return reasoning;
  }

  private extractCardiacRedFlags(indicators: any): string[] {
    const redFlags = [];
    if (indicators.hasChestPain) redFlags.push('Chest pain');
    if (indicators.hasRadiation) redFlags.push('Radiating pain');
    if (indicators.hasSOB) redFlags.push('Shortness of breath');
    return redFlags;
  }
}

/**
 * Vague Symptom Pattern - detects when user is too vague and needs clarification
 */
class VagueSymptomPattern {
  evaluate(
    symptoms: string[],
    context: string
  ): {
    isVague: boolean;
    clarificationQuestions: string[];
    emergencyQuestions: string[];
  } {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();

    const vagueIndicators = {
      hasVagueTerms: /feel bad|unwell|sick|not good|something wrong|pain/.test(
        text
      ),
      lacksSpecificity: symptoms.length < 2,
      lacksDuration:
        !/\d+\s*(minute|hour|day|week)|yesterday|today|recently/.test(text),
      lacksIntensity: !/\d+.*10|severe|mild|moderate|bad|terrible|slight/.test(
        text
      ),
      lacksLocation:
        !/(head|chest|arm|leg|stomach|back|neck|finger|hand)/.test(text) &&
        /pain|hurt|ache/.test(text),
    };

    const vagueScore = Object.values(vagueIndicators).filter(Boolean).length;
    const isVague = vagueScore >= 3;

    if (!isVague) {
      return {
        isVague: false,
        clarificationQuestions: [],
        emergencyQuestions: [],
      };
    }

    // Generate targeted questions to rule out emergencies AND gather info
    return {
      isVague: true,
      clarificationQuestions: this.generateClarificationQuestions(
        vagueIndicators,
        text
      ),
      emergencyQuestions: this.generateEmergencyScreeningQuestions(text),
    };
  }

  private generateClarificationQuestions(
    indicators: any,
    text: string
  ): string[] {
    const questions = [];

    if (indicators.lacksLocation && /pain|hurt|ache/.test(text)) {
      questions.push('Where exactly is the pain located?');
    }

    if (indicators.lacksIntensity) {
      questions.push('On a scale of 1-10, how severe are your symptoms?');
    }

    if (indicators.lacksDuration) {
      questions.push('When did these symptoms start?');
    }

    if (indicators.hasVagueTerms) {
      questions.push('Can you describe your main symptom in more detail?');
    }

    return questions;
  }

  private generateEmergencyScreeningQuestions(text: string): string[] {
    const emergencyQuestions = [];

    // Always screen for life-threatening conditions
    emergencyQuestions.push(
      'Are you having any difficulty breathing or chest pain?'
    );

    if (/pain/.test(text)) {
      emergencyQuestions.push(
        'Is the pain severe (8-10 out of 10) or getting rapidly worse?'
      );
    }

    if (/bleeding|blood|cut|wound/.test(text)) {
      emergencyQuestions.push(
        "Is there any bleeding that won't stop with pressure?"
      );
    }

    emergencyQuestions.push(
      'Are you experiencing any vision changes, confusion, or difficulty speaking?'
    );

    return emergencyQuestions;
  }
}

/**
 * Main Hybrid Medical Classifier
 */
export class HybridMedicalClassifier {
  private emergencyPatterns: EmergencyPattern[];
  private vaguePattern: VagueSymptomPattern;

  constructor() {
    this.emergencyPatterns = [
      new BleedingEmergencyPattern(),
      new CardiacEmergencyPattern(),
    ];
    this.vaguePattern = new VagueSymptomPattern();
  }

  async classify(
    symptoms: string[],
    context: string,
    apiKey: string
  ): Promise<MedicalClassification> {
    // Step 1: Check for vague symptoms first
    const vagueCheck = this.vaguePattern.evaluate(symptoms, context);

    // Step 2: Always run emergency pattern checks (even if vague)
    const emergencyResults = this.checkEmergencyPatterns(symptoms, context);
    const hasEmergency = emergencyResults.some((r) => r.isEmergency);

    // Step 3: If clear emergency, return immediately
    if (hasEmergency && !vagueCheck.isVague) {
      const emergencyResult = emergencyResults.find((r) => r.isEmergency)!;
      return {
        careLevel: 'emergency',
        confidence: emergencyResult.confidence,
        reasoning: emergencyResult.reasoning,
        redFlags: emergencyResult.redFlags,
        needsMoreInfo: false,
        clarificationQuestions: [],
        emergencyRuled: false, // Emergency detected, not ruled out
        pattern: emergencyResult.pattern,
      };
    }

    // Step 4: If vague BUT potential emergency indicators, urgent clarification needed
    if (vagueCheck.isVague && this.hasEmergencyKeywords(symptoms, context)) {
      return {
        careLevel: 'urgent', // Escalate for safety
        confidence: 0.6,
        reasoning: [
          'Vague symptoms with potential emergency indicators',
          'Immediate clarification needed to rule out emergency conditions',
          'Safety escalation due to insufficient information',
        ],
        redFlags: ['Insufficient information for safe triage'],
        needsMoreInfo: true,
        clarificationQuestions: [
          ...vagueCheck.emergencyQuestions, // Emergency screening first
          ...vagueCheck.clarificationQuestions,
        ],
        emergencyRuled: false, // Cannot rule out emergency with vague info
      };
    }

    // Step 5: If vague but no emergency keywords, gather more info
    if (vagueCheck.isVague) {
      return {
        careLevel: 'primary', // Conservative default
        confidence: 0.4,
        reasoning: [
          'Vague symptom description requires clarification',
          'No clear emergency indicators detected',
          'More information needed for accurate triage',
        ],
        redFlags: [],
        needsMoreInfo: true,
        clarificationQuestions: vagueCheck.clarificationQuestions,
        emergencyRuled: true, // No emergency keywords found
      };
    }

    // Step 6: If specific but no emergency, use AI for complex classification
    return await this.aiClassifyComplex(symptoms, context, apiKey);
  }

  private checkEmergencyPatterns(
    symptoms: string[],
    context: string
  ): EmergencyResult[] {
    return this.emergencyPatterns.map((pattern) =>
      pattern.evaluate(symptoms, context)
    );
  }

  private hasEmergencyKeywords(symptoms: string[], context: string): boolean {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();
    const emergencyKeywords = [
      'bleeding',
      'blood',
      'chest pain',
      "can't breath",
      'difficulty breath',
      'severe pain',
      'unconscious',
      'confusion',
      'head injury',
      'overdose',
    ];

    return emergencyKeywords.some((keyword) => text.includes(keyword));
  }

  private async aiClassifyComplex(
    symptoms: string[],
    context: string,
    apiKey: string
  ): Promise<MedicalClassification> {
    // Use AI for non-emergency complex cases
    // Implementation would call Google AI API here
    return {
      careLevel: 'primary',
      confidence: 0.8,
      reasoning: ['AI classification for complex case'],
      redFlags: [],
      needsMoreInfo: false,
      clarificationQuestions: [],
      emergencyRuled: true,
    };
  }
}
