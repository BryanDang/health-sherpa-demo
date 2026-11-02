import { EmergencySymptom, Citation } from '@/types/triage';

export const EMERGENCY_SYMPTOMS: EmergencySymptom[] = [
  {
    symptom: 'severe_breathing_difficulty',
    description: 'Severe difficulty breathing or shortness of breath',
    action:
      'Call 911 immediately - this may indicate respiratory distress or failure',
  },
  {
    symptom: 'chest_pain',
    description:
      'Chest pain or pressure, especially if radiating to arm, jaw, or back',
    action: 'Call 911 immediately - this may indicate a heart attack',
  },
  {
    symptom: 'sudden_confusion',
    description:
      'Sudden confusion, slurred speech, or difficulty understanding speech',
    action:
      'Call 911 immediately - possible stroke (remember FAST: Face drooping, Arm weakness, Speech difficulty, Time to call 911)',
  },
  {
    symptom: 'severe_headache',
    description: 'Severe headache with vision changes, weakness, or confusion',
    action:
      'Go to emergency room immediately - may indicate brain bleed or meningitis',
  },
  {
    symptom: 'high_fever',
    description: 'Fever above 103°F (39.4°C) in adults',
    action: 'Seek emergency care - may signal severe infection',
  },
  {
    symptom: 'severe_abdominal_pain',
    description:
      'Severe, sudden abdominal pain, especially with vomiting blood',
    action: 'Go to emergency room - possible appendicitis or internal bleeding',
  },
  {
    symptom: 'uncontrolled_bleeding',
    description: 'Heavy bleeding that does not stop with pressure',
    action:
      'Call 911 immediately - may indicate major trauma or internal hemorrhage',
  },
  {
    symptom: 'loss_consciousness',
    description: 'Loss of consciousness or fainting',
    action:
      'Call 911 immediately - may indicate cardiac arrest, stroke, or severe hypoglycemia',
  },
  {
    symptom: 'seizures',
    description:
      'Seizures, especially first-time, prolonged (>5 minutes), or back-to-back',
    action: 'Call 911 immediately - indicates neurological emergency',
  },
  {
    symptom: 'sudden_dizziness_weakness',
    description: 'Sudden severe dizziness, weakness, or vision changes',
    action: 'Call 911 immediately - potentially stroke or vestibular emergency',
  },
  {
    symptom: 'coughing_vomiting_blood',
    description: 'Coughing up or vomiting blood',
    action: 'Go to emergency room immediately - may indicate internal bleeding',
  },
  {
    symptom: 'severe_allergic_reaction',
    description:
      'Swelling of face, lips, tongue, throat, or difficulty breathing',
    action:
      'Call 911 and use epinephrine if available - anaphylaxis requires immediate treatment',
  },
  {
    symptom: 'head_spine_injury',
    description:
      'Head or spine injury with confusion, fainting, or severe pain',
    action:
      'Call 911 immediately - possible traumatic brain injury or spinal damage',
  },
  {
    symptom: 'severe_burns',
    description:
      'Large, deep burns or burns on face, hands, feet, groin, or major joints',
    action:
      'Go to emergency room - risk of infection and systemic complications',
  },
  {
    symptom: 'poisoning_overdose',
    description: 'Suspected poisoning or drug overdose',
    action: 'Call 911 and Poison Control (1-800-222-1222) immediately',
  },
];

export const URGENT_CARE_CRITERIA = {
  fever: {
    adults: 'Below 103°F (39.4°C) but persistent',
    children_over_3months: 'Below 100.4°F (38°C) but concerning',
  },
  pain_severity: 'Intensity 8-10 on pain scale',
  symptom_duration: 'Worsening symptoms over 24-48 hours',
  breathing: 'Mild to moderate difficulty breathing (not severe)',
  vomiting_diarrhea: 'Persistent for >1 day or severe dehydration risk',
};

export const PRIMARY_CARE_CRITERIA = {
  pain_severity: 'Intensity 5-7 on pain scale',
  symptom_duration: 'Symptoms lasting >3 days without improvement',
  chronic_management: 'Ongoing health conditions needing management',
  preventive_care: 'Routine checkups and screenings',
};

export const SELF_CARE_CRITERIA = {
  pain_severity: 'Intensity 1-4 on pain scale',
  symptom_duration: 'Recent onset (<3 days)',
  fever: 'Low-grade or no fever',
  functionality: 'Able to maintain daily activities with minor discomfort',
};

export const MEDICAL_CITATIONS: Citation[] = [
  {
    source: 'Cleveland Clinic',
    title: 'When to Go to the Emergency Room',
    url: 'https://my.clevelandclinic.org/health/treatments/12574-emergency-room-visit',
  },
  {
    source: 'MedlinePlus',
    title: 'Medical Emergencies',
    url: 'https://medlineplus.gov/medicalemergencies.html',
  },
  {
    source: 'CDC',
    title: 'Cold Versus Flu',
    url: 'https://www.cdc.gov/flu/about/coldflu.html',
  },
  {
    source: 'NHS Scotland',
    title: 'Illnesses and Conditions A-Z',
    url: 'https://www.nhsinform.scot/illnesses-and-conditions/a-to-z',
  },
  {
    source: 'Science Direct',
    title: 'Telephone Triage in Healthcare',
    url: 'https://www.sciencedirect.com/science/article/pii/S1551741121002473',
  },
  {
    source: 'NCBI',
    title: 'Telephone Triage Systems',
    url: 'https://www.ncbi.nlm.nih.gov/books/NBK557583/',
  },
];
