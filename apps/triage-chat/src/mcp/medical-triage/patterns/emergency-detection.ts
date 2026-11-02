/**
 * Comprehensive Emergency Detection Patterns
 * Based on Health Sherpa Decision Tree and Clinical Guidelines
 */

import { EmergencyDetection } from '../schemas/medical-triage-schemas';

export interface EmergencyPattern {
  name: string;
  description: string;
  evaluate(symptoms: string[], context: string): EmergencyDetection;
}

/**
 * Cardiac Emergency Pattern - Chest pain, heart attack symptoms
 */
export class CardiacEmergencyPattern implements EmergencyPattern {
  name = 'cardiac_emergency';
  description =
    'Detects cardiac emergencies including heart attacks, chest pain, and cardiac arrest';

  evaluate(symptoms: string[], context: string): EmergencyDetection {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();

    const indicators = {
      hasChestPain:
        /chest pain|chest pressure|chest tight|crushing|squeezing|elephant.*chest/.test(
          text
        ),
      hasRadiation:
        /arm.*pain|jaw.*pain|neck.*pain|back.*pain|shoulder.*pain/.test(text) &&
        /chest/.test(text),
      hasSOB:
        /short.*breath|difficulty breath|can't breath|gasping|breathing.*hard/.test(
          text
        ),
      hasSweating: /sweat|diaphor|clam|cold.*sweat/.test(text),
      hasNausea: /nausea|vomit|sick.*stomach/.test(text),
      hasLightheadedness: /dizzy|lightheaded|faint|weak/.test(text),
      isSevere:
        /severe|worst|unbearable|crushing|10.*10|nine.*ten|eight.*ten/.test(
          text
        ),
      hasCardiacHistory: /heart.*attack|cardiac|angina|stent|bypass/.test(text),
      isExertional: /exercise|stairs|walking|exertion|activity/.test(text),
      hasPalpitations:
        /palpitation|racing.*heart|irregular.*beat|heart.*skip/.test(text),
    };

    // Evidence-based scoring from AHA guidelines
    const emergencyScore =
      (indicators.hasChestPain ? 4 : 0) +
      (indicators.hasRadiation ? 3 : 0) +
      (indicators.hasSOB ? 3 : 0) +
      (indicators.hasSweating ? 2 : 0) +
      (indicators.hasNausea ? 1 : 0) +
      (indicators.hasLightheadedness ? 2 : 0) +
      (indicators.isSevere ? 3 : 0) +
      (indicators.hasCardiacHistory ? 2 : 0) +
      (indicators.hasPalpitations ? 1 : 0);

    const isEmergency = emergencyScore >= 7;
    const confidence = Math.min(emergencyScore / 21, 1.0);

    return {
      isEmergency,
      confidence,
      emergencyType: 'cardiac',
      reasoning: this.buildCardiacReasoning(indicators, emergencyScore),
      redFlags: this.extractCardiacRedFlags(indicators),
      immediateActions: isEmergency
        ? [
            'Call 911 immediately',
            'Chew 325mg aspirin if not allergic',
            'Sit upright and stay calm',
            'Do not drive yourself to hospital',
            'Have someone stay with you',
          ]
        : [],
    };
  }

  private buildCardiacReasoning(indicators: any, score: number): string[] {
    const reasoning = [];
    if (indicators.hasChestPain)
      reasoning.push('Chest pain/pressure indicates potential cardiac event');
    if (indicators.hasRadiation)
      reasoning.push('Pain radiating to arm/jaw/neck suggests cardiac origin');
    if (indicators.hasSOB)
      reasoning.push('Shortness of breath with chest pain is concerning');
    if (indicators.isSevere)
      reasoning.push('Severe pain intensity increases cardiac emergency risk');
    if (indicators.hasCardiacHistory)
      reasoning.push('History of cardiac disease increases risk');
    reasoning.push(
      `Cardiac emergency score: ${score}/21 (emergency threshold: 7)`
    );
    return reasoning;
  }

  private extractCardiacRedFlags(indicators: any): string[] {
    const redFlags = [];
    if (indicators.hasChestPain) redFlags.push('Chest pain');
    if (indicators.hasRadiation) redFlags.push('Radiating pain');
    if (indicators.hasSOB) redFlags.push('Shortness of breath');
    if (indicators.hasSweating) redFlags.push('Diaphoresis');
    if (indicators.hasNausea) redFlags.push('Nausea with chest pain');
    return redFlags;
  }
}

/**
 * Respiratory Emergency Pattern - Breathing difficulties, respiratory distress
 */
export class RespiratoryEmergencyPattern implements EmergencyPattern {
  name = 'respiratory_emergency';
  description =
    'Detects respiratory emergencies including severe breathing difficulties';

  evaluate(symptoms: string[], context: string): EmergencyDetection {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();

    const indicators = {
      hasSevereSOB:
        /severe.*breath|can't.*breath|gasping|choking|suffocating/.test(text),
      hasStridor: /stridor|wheez.*loud|high.*pitch.*breath/.test(text),
      hasCyanosis: /blue|cyanosis|purple.*lips|blue.*lips/.test(text),
      hasRetractions: /retraction|sucking.*chest|ribs.*pulling/.test(text),
      cannotSpeak: /can't.*speak|unable.*talk|one.*word|short.*sentences/.test(
        text
      ),
      hasOrthopnea: /can't.*lie.*down|sit.*up.*breath|three.*pillow/.test(text),
      hasAsthmaHistory: /asthma|inhaler|bronchial|allergic/.test(text),
      hasChestTightness: /tight.*chest|constrict|band.*chest/.test(text),
      hasRapidBreathing: /rapid.*breath|panting|breath.*fast/.test(text),
      hasAnxiety: /panic|anxiety|scared|afraid/.test(text),
      isWorsening: /getting.*worse|rapid.*worse|sudden.*worse/.test(text),
    };

    const emergencyScore =
      (indicators.hasSevereSOB ? 5 : 0) +
      (indicators.hasStridor ? 4 : 0) +
      (indicators.hasCyanosis ? 5 : 0) +
      (indicators.hasRetractions ? 4 : 0) +
      (indicators.cannotSpeak ? 4 : 0) +
      (indicators.hasOrthopnea ? 3 : 0) +
      (indicators.hasChestTightness ? 2 : 0) +
      (indicators.hasRapidBreathing ? 2 : 0) +
      (indicators.isWorsening ? 3 : 0);

    const isEmergency = emergencyScore >= 8;
    const confidence = Math.min(emergencyScore / 32, 1.0);

    return {
      isEmergency,
      confidence,
      emergencyType: 'respiratory',
      reasoning: this.buildRespiratoryReasoning(indicators, emergencyScore),
      redFlags: this.extractRespiratoryRedFlags(indicators),
      immediateActions: isEmergency
        ? [
            'Call 911 immediately',
            'Sit upright - do not lie down',
            'Use rescue inhaler if available',
            'Loosen tight clothing',
            'Stay calm and breathe slowly',
          ]
        : [],
    };
  }

  private buildRespiratoryReasoning(indicators: any, score: number): string[] {
    const reasoning = [];
    if (indicators.hasSevereSOB)
      reasoning.push(
        'Severe shortness of breath indicates respiratory emergency'
      );
    if (indicators.hasStridor)
      reasoning.push('Stridor suggests upper airway obstruction');
    if (indicators.hasCyanosis)
      reasoning.push('Cyanosis indicates inadequate oxygenation');
    if (indicators.cannotSpeak)
      reasoning.push('Unable to speak in full sentences - severe distress');
    if (indicators.isWorsening)
      reasoning.push('Rapidly worsening symptoms require immediate care');
    reasoning.push(
      `Respiratory emergency score: ${score}/32 (emergency threshold: 8)`
    );
    return reasoning;
  }

  private extractRespiratoryRedFlags(indicators: any): string[] {
    const redFlags = [];
    if (indicators.hasSevereSOB) redFlags.push('Severe dyspnea');
    if (indicators.hasStridor) redFlags.push('Stridor');
    if (indicators.hasCyanosis) redFlags.push('Cyanosis');
    if (indicators.cannotSpeak) redFlags.push('Unable to speak');
    if (indicators.hasRetractions) redFlags.push('Chest retractions');
    return redFlags;
  }
}

/**
 * Neurological Emergency Pattern - Stroke, seizures, altered mental status
 */
export class NeurologicalEmergencyPattern implements EmergencyPattern {
  name = 'neurological_emergency';
  description =
    'Detects neurological emergencies including strokes and seizures';

  evaluate(symptoms: string[], context: string): EmergencyDetection {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();

    const indicators = {
      hasConfusion:
        /confusion|disoriented|not.*making.*sense|altered.*mental/.test(text),
      hasSlurredSpeech:
        /slurred.*speech|garbled|can't.*speak.*clearly|mumbling/.test(text),
      hasWeakness: /weakness|weak|can't.*move|paralysis|numb/.test(text),
      hasFacialDrooping:
        /face.*droop|facial.*weak|smile.*uneven|face.*numb/.test(text),
      hasVisionChanges: /vision.*change|blind|double.*vision|can't.*see/.test(
        text
      ),
      hasSevereHeadache:
        /severe.*headache|worst.*headache|sudden.*headache|thunderclap/.test(
          text
        ),
      hasSeizure: /seizure|convuls|shaking|epilep|fit/.test(text),
      hasBalance: /balance|dizzy|unsteady|falling|coordination/.test(text),
      isSuddenOnset: /sudden|immediate|all.*once|out.*nowhere/.test(text),
      hasNeckStiffness: /neck.*stiff|neck.*pain|meningism/.test(text),
      hasLOC: /unconscious|passed.*out|faint|blackout|lost.*conscious/.test(
        text
      ),
    };

    const emergencyScore =
      (indicators.hasConfusion ? 4 : 0) +
      (indicators.hasSlurredSpeech ? 4 : 0) +
      (indicators.hasWeakness ? 4 : 0) +
      (indicators.hasFacialDrooping ? 5 : 0) +
      (indicators.hasVisionChanges ? 3 : 0) +
      (indicators.hasSevereHeadache ? 4 : 0) +
      (indicators.hasSeizure ? 5 : 0) +
      (indicators.isSuddenOnset ? 3 : 0) +
      (indicators.hasNeckStiffness ? 3 : 0) +
      (indicators.hasLOC ? 5 : 0);

    const isEmergency = emergencyScore >= 8;
    const confidence = Math.min(emergencyScore / 40, 1.0);

    return {
      isEmergency,
      confidence,
      emergencyType: 'neurological',
      reasoning: this.buildNeurologicalReasoning(indicators, emergencyScore),
      redFlags: this.extractNeurologicalRedFlags(indicators),
      immediateActions: isEmergency
        ? [
            'Call 911 immediately',
            'Note time of symptom onset',
            'Do not give anything by mouth',
            'Keep patient calm and still',
            'Monitor breathing and consciousness',
          ]
        : [],
    };
  }

  private buildNeurologicalReasoning(indicators: any, score: number): string[] {
    const reasoning = [];
    if (indicators.hasConfusion)
      reasoning.push('Altered mental status indicates neurological emergency');
    if (indicators.hasSlurredSpeech)
      reasoning.push('Slurred speech suggests stroke or neurological event');
    if (indicators.hasWeakness)
      reasoning.push('Sudden weakness may indicate stroke');
    if (indicators.hasFacialDrooping)
      reasoning.push('Facial drooping is classic stroke sign');
    if (indicators.hasSeizure)
      reasoning.push('Seizure activity requires immediate medical attention');
    if (indicators.isSuddenOnset)
      reasoning.push('Sudden onset increases stroke likelihood');
    reasoning.push(
      `Neurological emergency score: ${score}/40 (emergency threshold: 8)`
    );
    return reasoning;
  }

  private extractNeurologicalRedFlags(indicators: any): string[] {
    const redFlags = [];
    if (indicators.hasConfusion) redFlags.push('Altered mental status');
    if (indicators.hasSlurredSpeech) redFlags.push('Slurred speech');
    if (indicators.hasWeakness) redFlags.push('Sudden weakness');
    if (indicators.hasFacialDrooping) redFlags.push('Facial drooping');
    if (indicators.hasSeizure) redFlags.push('Seizure activity');
    if (indicators.hasVisionChanges) redFlags.push('Vision changes');
    return redFlags;
  }
}

/**
 * Bleeding Emergency Pattern - Uncontrolled bleeding, hemorrhage
 */
export class BleedingEmergencyPattern implements EmergencyPattern {
  name = 'bleeding_emergency';
  description = 'Detects bleeding emergencies requiring immediate intervention';

  evaluate(symptoms: string[], context: string): EmergencyDetection {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();

    const indicators = {
      hasActiveBleed: /bleeding|blood|hemorrhag|cut|wound|lacerat/.test(text),
      isUncontrolled:
        /won't.*stop|continuous|despite.*pressure|soaking|pooling|through.*bandage/.test(
          text
        ),
      isSevereLocation:
        /artery|arterial|head|neck|chest|abdomen|femoral|major/.test(text),
      isDeepWound: /deep|severe|gaping|bone|muscle|fat|tendon/.test(text),
      isProfuse: /profuse|heavy|lots|pouring|spurting|gushing/.test(text),
      hasShockSigns: /dizzy|weak|faint|pale|cold|sweat|rapid.*pulse/.test(text),
      failedTreatment: /despite|tried|pressure|bandage.*soaked|tourniquet/.test(
        text
      ),
      isPostOperative: /surgery|operation|procedure|post.*op/.test(text),
      hasBloodThinners: /warfarin|coumadin|blood.*thinner|anticoagul/.test(
        text
      ),
      duration: this.extractDuration(text),
    };

    const emergencyScore =
      (indicators.hasActiveBleed ? 2 : 0) +
      (indicators.isUncontrolled ? 4 : 0) +
      (indicators.isSevereLocation ? 4 : 0) +
      (indicators.isDeepWound ? 3 : 0) +
      (indicators.isProfuse ? 3 : 0) +
      (indicators.hasShockSigns ? 5 : 0) +
      (indicators.failedTreatment ? 3 : 0) +
      (indicators.isPostOperative ? 2 : 0) +
      (indicators.hasBloodThinners ? 2 : 0) +
      (indicators.duration > 15 ? 3 : 0);

    const isEmergency = emergencyScore >= 8;
    const confidence = Math.min(emergencyScore / 31, 1.0);

    return {
      isEmergency,
      confidence,
      emergencyType: 'bleeding',
      reasoning: this.buildBleedingReasoning(indicators, emergencyScore),
      redFlags: this.extractBleedingRedFlags(indicators),
      immediateActions: isEmergency
        ? [
            'Call 911 immediately',
            'Apply direct pressure to bleeding site',
            'Elevate injured area above heart if possible',
            'Do not remove embedded objects',
            'Monitor for signs of shock',
          ]
        : [],
    };
  }

  private extractDuration(text: string): number {
    const patterns = [/(\d+)\s*minutes?/i, /(\d+)\s*mins?/i, /(\d+)\s*hours?/i];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        return text.includes('hour') ? value * 60 : value;
      }
    }

    if (/long.*time|while|ages/.test(text)) return 30;
    return 0;
  }

  private buildBleedingReasoning(indicators: any, score: number): string[] {
    const reasoning = [];
    if (indicators.isUncontrolled)
      reasoning.push('Uncontrolled bleeding indicates vascular emergency');
    if (indicators.isSevereLocation)
      reasoning.push('Bleeding in critical location requires immediate care');
    if (indicators.hasShockSigns)
      reasoning.push('Signs of shock from blood loss');
    if (indicators.failedTreatment)
      reasoning.push('Failed standard bleeding control measures');
    if (indicators.duration > 15)
      reasoning.push('Prolonged bleeding (>15 minutes) concerning');
    reasoning.push(
      `Bleeding emergency score: ${score}/31 (emergency threshold: 8)`
    );
    return reasoning;
  }

  private extractBleedingRedFlags(indicators: any): string[] {
    const redFlags = [];
    if (indicators.isUncontrolled) redFlags.push('Uncontrolled hemorrhage');
    if (indicators.isSevereLocation) redFlags.push('Critical bleeding site');
    if (indicators.hasShockSigns) redFlags.push('Signs of shock');
    if (indicators.isProfuse) redFlags.push('Profuse bleeding');
    return redFlags;
  }
}

/**
 * Allergic Reaction Emergency Pattern - Anaphylaxis and severe allergic reactions
 */
export class AllergicReactionEmergencyPattern implements EmergencyPattern {
  name = 'allergic_emergency';
  description = 'Detects severe allergic reactions and anaphylaxis';

  evaluate(symptoms: string[], context: string): EmergencyDetection {
    const text = `${symptoms.join(' ')} ${context}`.toLowerCase();

    const indicators = {
      hasBreathing: /difficulty.*breath|wheez|tight.*chest|can't.*breath/.test(
        text
      ),
      hasSwelling: /swelling|swell|puffy|face.*big|lips.*big|tongue.*big/.test(
        text
      ),
      hasHives: /hives|rash|itchy|red.*bumps|welts/.test(text),
      hasVomiting: /vomit|nausea|stomach.*pain|diarrhea/.test(text),
      hasDizziness: /dizzy|faint|weak|lightheaded|confused/.test(text),
      hasRapidPulse: /rapid.*pulse|heart.*racing|palpitation/.test(text),
      isGeneralized: /all.*over|everywhere|spreading|whole.*body/.test(text),
      hasExposure: /ate|food|medication|bee.*sting|insect|latex/.test(text),
      isRapidOnset: /sudden|immediate|minutes|rapid/.test(text),
      hasThroatTight: /throat.*tight|throat.*closing|swallow.*hard/.test(text),
      hasVoiceChange: /voice.*change|hoarse|raspy/.test(text),
    };

    const emergencyScore =
      (indicators.hasBreathing ? 5 : 0) +
      (indicators.hasSwelling ? 4 : 0) +
      (indicators.hasHives ? 2 : 0) +
      (indicators.hasVomiting ? 2 : 0) +
      (indicators.hasDizziness ? 3 : 0) +
      (indicators.hasRapidPulse ? 2 : 0) +
      (indicators.isGeneralized ? 3 : 0) +
      (indicators.isRapidOnset ? 3 : 0) +
      (indicators.hasThroatTight ? 5 : 0) +
      (indicators.hasVoiceChange ? 4 : 0);

    const isEmergency = emergencyScore >= 8;
    const confidence = Math.min(emergencyScore / 33, 1.0);

    return {
      isEmergency,
      confidence,
      emergencyType: 'allergic_reaction',
      reasoning: this.buildAllergicReasoning(indicators, emergencyScore),
      redFlags: this.extractAllergicRedFlags(indicators),
      immediateActions: isEmergency
        ? [
            'Call 911 immediately',
            'Use EpiPen if available',
            'Remove or avoid allergen',
            'Lie flat with legs elevated',
            'Monitor breathing closely',
          ]
        : [],
    };
  }

  private buildAllergicReasoning(indicators: any, score: number): string[] {
    const reasoning = [];
    if (indicators.hasBreathing)
      reasoning.push('Respiratory symptoms indicate potential anaphylaxis');
    if (indicators.hasSwelling)
      reasoning.push(
        'Facial/throat swelling suggests severe allergic reaction'
      );
    if (indicators.hasThroatTight)
      reasoning.push('Throat tightness indicates airway compromise');
    if (indicators.isRapidOnset)
      reasoning.push('Rapid onset suggests severe allergic reaction');
    if (indicators.isGeneralized)
      reasoning.push('Generalized symptoms indicate systemic reaction');
    reasoning.push(
      `Allergic emergency score: ${score}/33 (emergency threshold: 8)`
    );
    return reasoning;
  }

  private extractAllergicRedFlags(indicators: any): string[] {
    const redFlags = [];
    if (indicators.hasBreathing) redFlags.push('Breathing difficulty');
    if (indicators.hasSwelling) redFlags.push('Facial/throat swelling');
    if (indicators.hasThroatTight) redFlags.push('Throat tightness');
    if (indicators.hasVoiceChange) redFlags.push('Voice changes');
    return redFlags;
  }
}

/**
 * Main Emergency Detection System
 */
export class EmergencyDetectionSystem {
  private patterns: EmergencyPattern[];

  constructor() {
    this.patterns = [
      new CardiacEmergencyPattern(),
      new RespiratoryEmergencyPattern(),
      new NeurologicalEmergencyPattern(),
      new BleedingEmergencyPattern(),
      new AllergicReactionEmergencyPattern(),
    ];
  }

  async evaluateEmergency(
    symptoms: string[],
    context: string
  ): Promise<EmergencyDetection> {
    const results = this.patterns.map((pattern) =>
      pattern.evaluate(symptoms, context)
    );

    // Find the highest confidence emergency
    const emergencyResults = results.filter((r) => r.isEmergency);

    if (emergencyResults.length === 0) {
      return {
        isEmergency: false,
        confidence: 0,
        reasoning: ['No emergency patterns detected'],
        redFlags: [],
        immediateActions: [],
      };
    }

    // Return the most confident emergency result
    const bestResult = emergencyResults.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return bestResult;
  }

  getAvailablePatterns(): string[] {
    return this.patterns.map((p) => p.name);
  }
}

export default EmergencyDetectionSystem;
