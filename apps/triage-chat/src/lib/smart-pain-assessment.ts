/**
 * Smart Pain Assessment Utility
 * 
 * Provides context-aware pain assessment that considers:
 * - Pain location and associated risk factors
 * - Patient autonomy and choice in care decisions
 * - Clinical reasoning for different pain patterns
 * - Non-judgmental triage that offers options
 */

export interface PainAssessment {
  severity: number; // 1-10 scale
  location: string;
  characteristics?: string[];
  onset?: 'sudden' | 'gradual' | 'unknown';
  duration?: string;
}

export interface PainTriageRecommendation {
  careLevel: 'emergency' | 'urgent' | 'primary' | 'self_care';
  reasoning: string;
  patientChoicePrompt?: string;
  immediateActions: string[];
  warningSignsToWatch: string[];
  followUpRecommendations: string[];
}

/**
 * High-risk pain locations that may indicate emergency conditions
 */
const HIGH_RISK_PAIN_LOCATIONS = {
  chest: {
    riskFactors: ['heart attack', 'pulmonary embolism', 'aortic dissection'],
    emergencyKeywords: ['crushing', 'pressure', 'radiating', 'shortness of breath']
  },
  head: {
    riskFactors: ['stroke', 'brain hemorrhage', 'meningitis'],
    emergencyKeywords: ['sudden', 'worst ever', 'thunderclap', 'vision changes', 'confusion']
  },
  abdomen: {
    riskFactors: ['appendicitis', 'bowel obstruction', 'internal bleeding'],
    emergencyKeywords: ['severe', 'sudden', 'vomiting blood', 'rigid', 'guarding']
  },
  back: {
    riskFactors: ['kidney stones', 'aortic aneurysm', 'spinal injury'],
    emergencyKeywords: ['tearing', 'sudden', 'numbness', 'weakness in legs']
  }
};

/**
 * Lower-risk pain locations that typically don't require emergency care
 */
const MODERATE_RISK_PAIN_LOCATIONS = {
  foot: {
    commonCauses: ['injury', 'strain', 'arthritis', 'gout'],
    urgentKeywords: ['deformity', 'inability to bear weight', 'numbness', 'cold/blue']
  },
  hand: {
    commonCauses: ['strain', 'arthritis', 'carpal tunnel'],
    urgentKeywords: ['severe swelling', 'deformity', 'numbness', 'loss of function']
  },
  knee: {
    commonCauses: ['strain', 'arthritis', 'overuse'],
    urgentKeywords: ['instability', 'locking', 'severe swelling', 'deformity']
  },
  shoulder: {
    commonCauses: ['strain', 'bursitis', 'rotator cuff'],
    urgentKeywords: ['sudden weakness', 'complete loss of movement', 'severe trauma']
  }
};

/**
 * Assess pain and provide clinical reasoning with patient choice
 */
export function assessPain(painData: PainAssessment): PainTriageRecommendation {
  const { severity, location, characteristics = [], onset } = painData;
  const painLocation = location.toLowerCase();

  // Emergency assessment for high-risk locations
  if (isHighRiskLocation(painLocation)) {
    return assessHighRiskPain(painData);
  }

  // Smart assessment for moderate-risk locations
  if (isModerateRiskLocation(painLocation)) {
    return assessModerateRiskPain(painData);
  }

  // General high-severity pain assessment
  if (severity >= 8) {
    return assessSeverePain(painData);
  }

  // Standard pain assessment
  return assessStandardPain(painData);
}

/**
 * Check if pain location is high-risk
 */
function isHighRiskLocation(location: string): boolean {
  return Object.keys(HIGH_RISK_PAIN_LOCATIONS).some(riskLocation => 
    location.includes(riskLocation)
  );
}

/**
 * Check if pain location is moderate-risk
 */
function isModerateRiskLocation(location: string): boolean {
  return Object.keys(MODERATE_RISK_PAIN_LOCATIONS).some(riskLocation => 
    location.includes(riskLocation)
  );
}

/**
 * Assess high-risk pain locations (chest, head, abdomen, back)
 */
function assessHighRiskPain(painData: PainAssessment): PainTriageRecommendation {
  const { severity, location, characteristics = [] } = painData;
  const painLocation = location.toLowerCase();

  // Check for emergency keywords
  const riskData = Object.entries(HIGH_RISK_PAIN_LOCATIONS).find(([key]) => 
    painLocation.includes(key)
  )?.[1];

  const hasEmergencyFeatures = riskData?.emergencyKeywords.some(keyword =>
    characteristics.some(char => char.toLowerCase().includes(keyword))
  );

  if (hasEmergencyFeatures || severity >= 9) {
    return {
      careLevel: 'emergency',
      reasoning: `High-severity ${location} pain with concerning features requires immediate evaluation`,
      immediateActions: ['Call 911 or go to emergency room immediately'],
      warningSignsToWatch: ['Worsening pain', 'New symptoms', 'Difficulty breathing'],
      followUpRecommendations: []
    };
  }

  return {
    careLevel: 'urgent',
    reasoning: `${location} pain at this severity level needs prompt medical evaluation`,
    patientChoicePrompt: `Given your ${location} pain, I recommend urgent care evaluation. Would you like me to help you find urgent care facilities, or do you have questions about your symptoms first?`,
    immediateActions: ['Seek urgent care within 1-2 hours'],
    warningSignsToWatch: riskData?.emergencyKeywords || [],
    followUpRecommendations: ['Follow up with primary care if symptoms persist']
  };
}

/**
 * Assess moderate-risk pain locations (foot, hand, knee, shoulder)
 */
function assessModerateRiskPain(painData: PainAssessment): PainTriageRecommendation {
  const { severity, location, characteristics = [] } = painData;
  const painLocation = location.toLowerCase();

  // Check for urgent care features
  const riskData = Object.entries(MODERATE_RISK_PAIN_LOCATIONS).find(([key]) => 
    painLocation.includes(key)
  )?.[1];

  const hasUrgentFeatures = riskData?.urgentKeywords.some(keyword =>
    characteristics.some(char => char.toLowerCase().includes(keyword))
  );

  if (hasUrgentFeatures) {
    return {
      careLevel: 'urgent',
      reasoning: `${location} pain with concerning features (${characteristics.join(', ')}) needs prompt evaluation`,
      immediateActions: ['Seek urgent care or emergency room'],
      warningSignsToWatch: riskData?.urgentKeywords || [],
      followUpRecommendations: ['Follow up with orthopedic or primary care']
    };
  }

  // High severity but low-risk location - offer patient choice
  if (severity >= 8) {
    return {
      careLevel: 'urgent',
      reasoning: `Severe ${location} pain significantly impacts function and quality of life`,
      patientChoicePrompt: `I understand you're experiencing severe ${location} pain (${severity}/10). You have a couple of options: I can help you find urgent care for immediate relief, or we can discuss the symptoms first to determine the best type of care for your situation. What feels right to you?`,
      immediateActions: [
        'Apply ice if recent injury (first 24-48 hours)',
        'Elevate if possible',
        'Over-the-counter pain relief if appropriate'
      ],
      warningSignsToWatch: [
        'Sudden numbness or tingling',
        'Color changes (blue, pale)',
        'Complete loss of function',
        'Fever or signs of infection'
      ],
      followUpRecommendations: [
        'Urgent care if pain worsens or function deteriorates',
        'Primary care for ongoing management',
        'Physical therapy evaluation if appropriate'
      ]
    };
  }

  return assessStandardPain(painData);
}

/**
 * Assess severe pain (8-10/10) with patient choice framework
 */
function assessSeverePain(painData: PainAssessment): PainTriageRecommendation {
  const { severity, location } = painData;

  return {
    careLevel: 'urgent',
    reasoning: `Pain level ${severity}/10 significantly impacts daily function and quality of life`,
    patientChoicePrompt: `A pain level of ${severity} out of 10 is quite severe and I want to make sure you get the right care. You have options: I can help you find urgent care right now for immediate evaluation and pain management, or if you'd prefer, I can do a quick assessment first to help determine the best place for you to get care. What approach feels right to you?`,
    immediateActions: [
      'Rest and avoid aggravating activities',
      'Apply appropriate heat/cold therapy',
      'Consider over-the-counter pain relief if safe'
    ],
    warningSignsToWatch: [
      'Pain becomes unbearable (10/10)',
      'New neurological symptoms (numbness, weakness)',
      'Signs of infection (fever, redness, swelling)',
      'Unable to function normally'
    ],
    followUpRecommendations: [
      'Urgent care for immediate evaluation and treatment',
      'Primary care follow-up within 24-48 hours',
      'Consider pain management specialist if chronic'
    ]
  };
}

/**
 * Standard pain assessment for lower severity levels
 */
function assessStandardPain(painData: PainAssessment): PainTriageRecommendation {
  const { severity, location } = painData;

  if (severity >= 6) {
    return {
      careLevel: 'primary',
      reasoning: `Moderate ${location} pain warrants medical evaluation for proper diagnosis and treatment`,
      immediateActions: [
        'Rest and activity modification',
        'Apply ice or heat as appropriate',
        'Over-the-counter pain medications if safe'
      ],
      warningSignsToWatch: [
        'Pain worsens significantly',
        'New symptoms develop',
        'Pain interferes with sleep or daily activities'
      ],
      followUpRecommendations: [
        'Schedule appointment with primary care provider',
        'Urgent care if pain worsens or new symptoms develop'
      ]
    };
  }

  return {
    careLevel: 'self_care',
    reasoning: `Mild to moderate ${location} pain can often be managed with self-care measures initially`,
    immediateActions: [
      'Rest and avoid aggravating activities',
      'Apply ice for acute injuries, heat for muscle tension',
      'Gentle movement and stretching as tolerated',
      'Over-the-counter pain relief if appropriate'
    ],
    warningSignsToWatch: [
      'Pain worsens over 24-48 hours',
      'New symptoms develop',
      'Unable to use affected area normally'
    ],
    followUpRecommendations: [
      'Primary care if no improvement in 3-5 days',
      'Urgent care if pain suddenly worsens'
    ]
  };
}

/**
 * Generate patient choice prompt for high-severity pain
 */
export function generatePainChoicePrompt(
  severity: number, 
  location: string,
  isHighRisk: boolean = false
): string {
  if (isHighRisk) {
    return `Your ${location} pain at ${severity}/10 with these symptoms needs immediate medical attention. I recommend going to the emergency room right away.`;
  }

  if (severity >= 8) {
    return `I understand you're experiencing severe ${location} pain (${severity}/10). Given how significant this is, you have a couple of options: I can help you find urgent care right now for immediate evaluation and pain relief, or if you'd like, I can do a quick assessment first to help determine the best place for you to get care. What feels right to you?`;
  }

  return `For ${location} pain at ${severity}/10, would you like me to help you find nearby care options, or shall we discuss your symptoms first to determine the best approach?`;
}