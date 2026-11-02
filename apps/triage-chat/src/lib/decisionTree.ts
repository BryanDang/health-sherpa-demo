/**
 * Health Sherpa Triage Decision Tree
 *
 * Evidence-based decision logic for 26-40 yo uninsured population
 * Based on CDC, NHS, and clinical guidelines
 */

export interface SymptomInfo {
  symptoms: string[];
  duration: 'less_than_3_days' | '3_to_7_days' | 'more_than_7_days';
  intensity: number; // 1-10 scale
  recentContact: boolean;
  fever?: number; // Temperature in Fahrenheit
}

export interface TriageDecision {
  careLevel: 'emergency' | 'urgent' | 'primary' | 'self_care';
  reasoning: string[];
  redFlags: string[];
  timeframe: string;
  nextSteps: string[];
  selfCareAdvice?: string[];
}

// Emergency symptoms requiring immediate ER/911
export const EMERGENCY_SYMPTOMS = [
  'severe difficulty breathing',
  'difficulty breathing',
  'trouble breathing',
  'shortness of breath',
  "can't breathe",
  'chest pain',
  'chest pressure',
  'sudden confusion',
  'slurred speech',
  'severe headache',
  'high fever above 103',
  'fever above 103',
  'severe abdominal pain',
  'uncontrolled bleeding',
  'loss of consciousness',
  'fainting',
  'seizures',
  'sudden dizziness',
  'sudden weakness',
  'change in vision',
  'coughing up blood',
  'vomiting blood',
  'severe allergic reaction',
  'swelling of face',
  'swelling of throat',
  'head injury',
  'spine injury',
  'severe burns',
  'stroke symptoms',
  'heart attack symptoms',
  'poisoning',
  'overdose',
];

// Urgent care symptoms (24 hour attention)
export const URGENT_SYMPTOMS = [
  'severe pain',
  'pain 8',
  'pain 9',
  'pain 10',
  '8/10 pain',
  '9/10 pain',
  '10/10 pain',
  'unable to walk',
  "can't walk",
  "can't bear weight",
  'unable to bear weight',
  'minor cuts',
  'minor burns',
  'sprains',
  'minor fractures',
  'ear infection',
  'sore throat',
  'urinary tract infection',
  'uti',
  'persistent cough',
  'difficulty breathing mild',
  'persistent vomiting',
  'severe diarrhea',
  'migraine',
  'severe headache',
  'skin infection',
  'rash',
  'dehydration',
  'allergic reaction mild',
  'dental problems',
  'toothache',
  'eye infection',
  'conjunctivitis',
  'pink eye',
  'sti symptoms',
  'mild asthma attack',
];

/**
 * Main decision tree logic
 */
export function evaluateSymptoms(symptomInfo: SymptomInfo): TriageDecision {
  const { symptoms, duration, intensity, recentContact, fever } = symptomInfo;

  // Step 1: Check for emergency symptoms
  const emergencyCheck = checkEmergencySymptoms(symptoms, fever);
  if (emergencyCheck.isEmergency) {
    return {
      careLevel: 'emergency',
      reasoning: emergencyCheck.reasoning,
      redFlags: emergencyCheck.redFlags,
      timeframe: 'Immediately',
      nextSteps: ['Call 911 immediately', 'Go to nearest emergency room'],
      selfCareAdvice: [],
    };
  }

  // Step 2: Classify based on structured criteria
  const classification = classifySymptoms(symptomInfo);

  return classification;
}

/**
 * Check for emergency symptoms
 */
function checkEmergencySymptoms(
  symptoms: string[],
  fever?: number
): {
  isEmergency: boolean;
  reasoning: string[];
  redFlags: string[];
} {
  const lowerSymptoms = symptoms.map((s) => s.toLowerCase());
  const foundEmergencySymptoms: string[] = [];

  // Check for emergency keywords
  for (const symptom of lowerSymptoms) {
    for (const emergencySymptom of EMERGENCY_SYMPTOMS) {
      if (symptom.includes(emergencySymptom)) {
        foundEmergencySymptoms.push(emergencySymptom);
      }
    }
  }

  // Check high fever (>103°F)
  if (fever && fever > 103) {
    foundEmergencySymptoms.push('high fever above 103°F');
  }

  if (foundEmergencySymptoms.length > 0) {
    return {
      isEmergency: true,
      reasoning: [
        `Emergency symptoms detected: ${foundEmergencySymptoms.join(', ')}`,
        'These symptoms require immediate medical attention',
      ],
      redFlags: foundEmergencySymptoms,
    };
  }

  return {
    isEmergency: false,
    reasoning: [],
    redFlags: [],
  };
}

/**
 * Classify symptoms based on decision tree criteria
 */
function classifySymptoms(symptomInfo: SymptomInfo): TriageDecision {
  const { symptoms, duration, intensity, fever } = symptomInfo;
  const lowerSymptoms = symptoms.map((s) => s.toLowerCase());

  // Check for urgent care criteria
  const urgentSymptoms = lowerSymptoms.filter((symptom) =>
    URGENT_SYMPTOMS.some((urgent) => symptom.includes(urgent))
  );

  // Decision logic based on criteria table

  // Check for high pain descriptions in text regardless of parsed intensity
  const painDescriptions = lowerSymptoms.join(' ');
  const hasHighPain =
    painDescriptions.includes('10/10') ||
    painDescriptions.includes('9/10') ||
    painDescriptions.includes('8/10') ||
    painDescriptions.includes('severe pain') ||
    painDescriptions.includes("can't bear weight") ||
    painDescriptions.includes('unable to walk');

  // Urgent Care: High fever (>100.4°F), severe symptoms (8-10), urgent symptoms, or high pain descriptions
  if (
    (fever && fever > 100.4) ||
    intensity >= 8 ||
    hasHighPain ||
    urgentSymptoms.length > 0 ||
    (symptoms.some((s) => s.toLowerCase().includes('persistent vomiting')) &&
      duration !== 'less_than_3_days') ||
    (symptoms.some((s) => s.toLowerCase().includes('severe diarrhea')) &&
      duration === 'more_than_7_days')
  ) {
    return {
      careLevel: 'urgent',
      reasoning: [
        ...(fever && fever > 100.4
          ? [`Fever of ${fever}°F indicates possible infection`]
          : []),
        ...(intensity >= 8
          ? [
              `High symptom intensity (${intensity}/10) requires prompt attention`,
            ]
          : []),
        ...(hasHighPain
          ? [`Severe pain described that requires urgent evaluation`]
          : []),
        ...(urgentSymptoms.length > 0
          ? [`Urgent symptoms detected: ${urgentSymptoms.join(', ')}`]
          : []),
        'These symptoms may require prompt medical attention within 24 hours',
      ],
      redFlags: urgentSymptoms,
      timeframe: 'Within 24 hours',
      nextSteps: [
        'Consider visiting an urgent care center',
        'See a doctor today if possible',
        'Monitor symptoms for worsening',
      ],
      selfCareAdvice: getUrgentCareAdvice(symptoms),
    };
  }

  // Primary Care: Moderate symptoms (5-7), symptoms >3 days, worsening symptoms
  if (
    (intensity >= 5 && intensity <= 7) ||
    duration !== 'less_than_3_days' ||
    symptoms.some((s) => s.toLowerCase().includes('worsening'))
  ) {
    return {
      careLevel: 'primary',
      reasoning: [
        ...(intensity >= 5 && intensity <= 7
          ? [`Moderate symptom intensity (${intensity}/10)`]
          : []),
        ...(duration !== 'less_than_3_days'
          ? [`Symptoms lasting ${duration.replace(/_/g, ' ')}`]
          : []),
        'These symptoms may need medical evaluation but are not urgent',
      ],
      redFlags: [],
      timeframe: 'Within 2 weeks',
      nextSteps: [
        'Make an appointment with a primary care doctor',
        'Continue monitoring symptoms',
        'Seek urgent care if symptoms worsen',
      ],
      selfCareAdvice: getPrimaryCareAdvice(symptoms),
    };
  }

  // Self-Care: Mild symptoms (1-4), recent onset (<3 days), no fever/urgent symptoms
  return {
    careLevel: 'self_care',
    reasoning: [
      `Mild symptom intensity (${intensity}/10)`,
      `Recent onset (${duration.replace(/_/g, ' ')})`,
      'No fever or urgent symptoms detected',
      'These symptoms can likely be managed at home',
    ],
    redFlags: [],
    timeframe: 'Monitor for 3-7 days',
    nextSteps: [
      'Try rest, fluids, and over-the-counter medications',
      'Monitor symptoms for changes',
      'Seek care if symptoms worsen or persist beyond 7 days',
    ],
    selfCareAdvice: getSelfCareAdvice(symptoms),
  };
}

/**
 * Get self-care advice based on symptoms
 */
function getSelfCareAdvice(symptoms: string[]): string[] {
  const advice: string[] = [];
  const lowerSymptoms = symptoms.map((s) => s.toLowerCase()).join(' ');

  if (
    lowerSymptoms.includes('cough') ||
    lowerSymptoms.includes('sore throat') ||
    lowerSymptoms.includes('runny nose')
  ) {
    advice.push('Rest and stay hydrated');
    advice.push('Use over-the-counter cold remedies (decongestants, lozenges)');
    advice.push('Monitor for fever or worsening symptoms');
  }

  if (lowerSymptoms.includes('fever')) {
    advice.push('Rest and increase fluid intake');
    advice.push('Take acetaminophen or ibuprofen for fever');
    advice.push('Seek care if fever exceeds 100.4°F or persists >3 days');
  }

  if (
    lowerSymptoms.includes('diarrhea') ||
    lowerSymptoms.includes('vomiting')
  ) {
    advice.push('Stay hydrated with water or electrolyte drinks');
    advice.push(
      'Eat bland foods (BRAT diet: bananas, rice, applesauce, toast)'
    );
    advice.push('Seek care if symptoms last >3 days or include blood');
  }

  if (advice.length === 0) {
    advice.push('Rest and stay hydrated');
    advice.push('Monitor symptoms for changes');
    advice.push('Use appropriate over-the-counter medications as needed');
  }

  return advice;
}

/**
 * Get primary care advice
 */
function getPrimaryCareAdvice(symptoms: string[]): string[] {
  return [
    'Continue current symptom management',
    'Keep a symptom diary to share with your doctor',
    'Take your temperature regularly if you have fever',
    'Prepare a list of questions for your appointment',
  ];
}

/**
 * Get urgent care advice
 */
function getUrgentCareAdvice(symptoms: string[]): string[] {
  return [
    'Do not delay seeking medical attention',
    'Bring a list of current medications',
    'Have someone drive you if you feel unwell',
    'Call ahead to urgent care to check wait times',
  ];
}

/**
 * Generate questions for AI to ask for clarification
 */
export function generateClarificationQuestions(symptoms: string[]): string[] {
  const questions: string[] = [];

  if (symptoms.length === 0) {
    questions.push('Could you describe your main symptoms in more detail?');
  }

  if (
    !symptoms.some(
      (s) =>
        s.toLowerCase().includes('pain') || s.toLowerCase().includes('ache')
    )
  ) {
    questions.push(
      'Are you experiencing any pain? If so, where and how severe is it on a scale of 1-10?'
    );
  }

  questions.push('When did these symptoms first start?');
  questions.push(
    'Have you had any fever? If so, what was your highest temperature?'
  );
  questions.push('Have you been in contact with anyone who was sick recently?');

  return questions;
}
