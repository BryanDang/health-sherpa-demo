import { SelfCareGuidance, Citation } from '@/types/triage';

export const SELF_CARE_RECOMMENDATIONS: Record<string, SelfCareGuidance> = {
  cold_flu: {
    recommendations: [
      'Rest and get plenty of sleep to help your immune system fight the infection',
      'Stay hydrated with water, herbal teas, or clear broths',
      'Use a humidifier or breathe steam from a hot shower to ease congestion',
      'Try over-the-counter medications like acetaminophen or ibuprofen for fever and body aches',
      'Use throat lozenges or gargle with warm salt water for sore throat',
      'Consider zinc lozenges within 24 hours of symptom onset',
    ],
    citations: [
      {
        source: 'CDC',
        title: 'Common Cold and Runny Nose',
        url: 'https://www.cdc.gov/antibiotic-use/colds.html',
      },
      {
        source: 'Mayo Clinic',
        title: 'Common Cold Self-Care',
        url: 'https://www.mayoclinic.org/diseases-conditions/common-cold/diagnosis-treatment/drc-20351611',
      },
    ],
    redFlags: [
      'Fever rises above 100.4°F (38°C)',
      'Symptoms worsen after 3-5 days instead of improving',
      'Difficulty breathing or shortness of breath',
      'Severe headache or sinus pain',
      'Persistent cough with thick, discolored mucus',
    ],
    followUpCriteria: [
      'Symptoms persist longer than 10 days',
      'Development of new symptoms like ear pain or sinus pressure',
      'If you have underlying conditions like asthma or diabetes',
    ],
  },

  minor_fever: {
    recommendations: [
      'Rest and avoid strenuous activities',
      'Drink plenty of fluids to prevent dehydration',
      'Take acetaminophen or ibuprofen as directed on package',
      'Use light clothing and keep room temperature comfortable',
      'Take lukewarm baths or use cool washcloths on forehead',
    ],
    citations: [
      {
        source: 'Cleveland Clinic',
        title: 'Fever Treatment and Care',
        url: 'https://my.clevelandclinic.org/health/symptoms/10880-fever',
      },
      {
        source: 'American Academy of Family Physicians',
        title: 'Fever in Adults',
        url: 'https://familydoctor.org/condition/fever/',
      },
    ],
    redFlags: [
      'Fever rises above 103°F (39.4°C)',
      'Fever lasts more than 3 days',
      'Severe headache or neck stiffness',
      'Difficulty breathing',
      'Severe abdominal pain',
    ],
    followUpCriteria: [
      "Temperature doesn't respond to medication",
      'Signs of dehydration (dizziness, decreased urination)',
      'Development of rash or other concerning symptoms',
    ],
  },

  digestive_upset: {
    recommendations: [
      'Stay hydrated with clear fluids, electrolyte solutions, or clear broths',
      'Follow the BRAT diet: bananas, rice, applesauce, toast',
      'Avoid dairy, fatty foods, caffeine, and alcohol',
      'Rest and avoid solid foods until vomiting stops',
      'Consider probiotics after symptoms improve',
      'Ginger tea may help with nausea',
    ],
    citations: [
      {
        source:
          'NIH National Institute of Diabetes and Digestive and Kidney Diseases',
        title: 'Diarrhea Treatment',
        url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/diarrhea/treatment',
      },
      {
        source: 'Mayo Clinic',
        title: 'Gastroenteritis Self-Care',
        url: 'https://www.mayoclinic.org/diseases-conditions/viral-gastroenteritis/diagnosis-treatment/drc-20378849',
      },
    ],
    redFlags: [
      'Blood in vomit or stool',
      'Signs of severe dehydration (dizziness, little/no urination)',
      'High fever above 101.3°F (38.5°C)',
      'Severe abdominal pain',
      'Symptoms persist more than 3 days',
    ],
    followUpCriteria: [
      'Unable to keep fluids down for 24 hours',
      'Severe cramping or abdominal pain',
      'Signs of dehydration despite fluid intake',
    ],
  },

  minor_cuts_scrapes: {
    recommendations: [
      'Clean hands thoroughly before treating the wound',
      'Stop bleeding by applying gentle pressure with a clean cloth',
      'Clean the wound with water and mild soap',
      'Apply an antibiotic ointment if available',
      'Cover with a sterile bandage and change daily',
      'Keep the wound clean and dry',
    ],
    citations: [
      {
        source: 'American Red Cross',
        title: 'Wound Care and Bandaging',
        url: 'https://www.redcross.org/take-a-class/first-aid/first-aid-tips/first-aid-basics',
      },
      {
        source: 'Mayo Clinic',
        title: 'Cuts and Scrapes First Aid',
        url: 'https://www.mayoclinic.org/first-aid/first-aid-cuts/basics/art-20056711',
      },
    ],
    redFlags: [
      "Deep cuts that won't stop bleeding after 10 minutes of pressure",
      'Signs of infection: increased redness, warmth, swelling, pus',
      'Cuts longer than 1/2 inch or deeper than 1/4 inch',
      "Embedded objects or debris that won't wash out",
      'Numbness or inability to move the area normally',
    ],
    followUpCriteria: [
      'No signs of healing after 2-3 days',
      'Increased pain, redness, or swelling',
      'Red streaking from the wound',
      'Tetanus vaccination not current (within 10 years)',
    ],
  },

  minor_sprains: {
    recommendations: [
      'Follow R.I.C.E. protocol: Rest, Ice, Compression, Elevation',
      'Rest the injured area and avoid activities that cause pain',
      'Apply ice for 15-20 minutes every 2-3 hours for first 48 hours',
      'Use elastic bandage for compression (not too tight)',
      'Elevate the injured area above heart level when possible',
      'Take over-the-counter pain relievers as needed',
    ],
    citations: [
      {
        source: 'American Academy of Orthopaedic Surgeons',
        title: 'Sprains and Strains',
        url: 'https://orthoinfo.aaos.org/en/diseases--conditions/sprains-and-strains/',
      },
      {
        source: 'Mayo Clinic',
        title: 'Sprain First Aid',
        url: 'https://www.mayoclinic.org/first-aid/first-aid-sprain/basics/art-20056622',
      },
    ],
    redFlags: [
      'Severe pain or inability to bear weight',
      'Numbness or tingling in the area',
      'Signs of fracture (visible deformity, severe swelling)',
      'No improvement after 2-3 days',
      'Skin color changes (blue, gray, or cold)',
    ],
    followUpCriteria: [
      "Pain and swelling don't improve after 48 hours",
      'Inability to use the injured area normally after a few days',
      'Recurring injury to the same area',
    ],
  },
};

export const GENERAL_SELF_CARE_PRINCIPLES = [
  'Monitor your symptoms - keep track of changes',
  'Stay hydrated and get adequate rest',
  "Don't ignore worsening symptoms",
  'When in doubt, seek professional medical advice',
  'Trust your instincts - you know your body best',
];

export const WHEN_TO_SEEK_CARE_INDICATORS = [
  'Symptoms are getting worse instead of better',
  'You develop new, concerning symptoms',
  "You're unable to function normally",
  'You feel something is seriously wrong',
  "Home remedies aren't providing relief after appropriate time",
];
