/** Shared helpers for price lookups. Sample data. Not medical advice. */

/** Great-circle distance in miles. */
export function distanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function categorizeProviderType(type: string): string {
  const typeMap: Record<string, string> = {
    hospital: 'hospital',
    urgent_care: 'urgent_care',
    clinic: 'primary_care',
    physician: 'primary_care',
    specialist: 'specialist',
  };
  return typeMap[type?.toLowerCase()] || 'healthcare_facility';
}

export function serviceDescription(serviceType: string): string {
  const descriptions: Record<string, string> = {
    urgent_care_visit: 'Urgent care office visit for established patient',
    new_patient_visit: 'New patient office visit with comprehensive evaluation',
    emergency_visit: 'Emergency department visit',
    basic_blood_work: 'Basic metabolic panel blood test',
    chest_xray: 'Chest X-ray examination',
    strep_test: 'Rapid strep throat test',
    flu_test: 'Influenza diagnostic test',
    urine_test: 'Urinalysis with microscopy',
    covid_test: 'COVID-19 diagnostic test',
  };
  return descriptions[serviceType] || 'Medical service';
}

export function estimateProcedures(symptoms: string, careLevel: string, serviceType: string): any[] {
  const procedures = [];
  const symptomLower = symptoms?.toLowerCase() || '';
  
  // Base visit cost is always included
  const baseVisitCosts: Record<string, { min: number, max: number }> = {
    emergency_visit: { min: 150, max: 3000 },
    urgent_care_visit: { min: 75, max: 200 },
    new_patient_visit: { min: 100, max: 300 },
  };
  
  const baseCost = baseVisitCosts[serviceType] || { min: 100, max: 300 };
  procedures.push({
    name: 'Initial consultation and examination',
    estimatedCost: `${baseCost.min}-${baseCost.max}`,
    cptCode: serviceType === 'emergency_visit' ? '99282' : serviceType === 'urgent_care_visit' ? '99213' : '99203',
  });
  
  // Add procedures based on symptoms
  if (symptomLower.includes('chest pain') || symptomLower.includes('heart')) {
    procedures.push({
      name: 'EKG/ECG (heart rhythm test)',
      estimatedCost: '150-400',
      cptCode: '93000',
    });
    if (careLevel === 'emergency') {
      procedures.push({
        name: 'Cardiac enzyme blood tests',
        estimatedCost: '200-500',
        cptCode: '80053',
      });
    }
  }
  
  if (symptomLower.includes('breathing') || symptomLower.includes('cough') || symptomLower.includes('chest')) {
    procedures.push({
      name: 'Chest X-ray',
      estimatedCost: '100-400',
      cptCode: '71020',
    });
  }
  
  if (symptomLower.includes('throat') || symptomLower.includes('strep')) {
    procedures.push({
      name: 'Rapid strep test',
      estimatedCost: '25-70',
      cptCode: '87880',
    });
  }
  
  if (symptomLower.includes('flu') || symptomLower.includes('fever')) {
    procedures.push({
      name: 'Influenza test',
      estimatedCost: '30-80',
      cptCode: '87804',
    });
  }
  
  if (symptomLower.includes('urine') || symptomLower.includes('burning') || symptomLower.includes('kidney')) {
    procedures.push({
      name: 'Urinalysis',
      estimatedCost: '25-100',
      cptCode: '81003',
    });
  }
  
  if (symptomLower.includes('blood') || symptomLower.includes('infection') || symptomLower.includes('fever')) {
    procedures.push({
      name: 'Complete blood count (CBC)',
      estimatedCost: '30-150',
      cptCode: '85025',
    });
  }
  
  if (symptomLower.includes('covid') || symptomLower.includes('coronavirus')) {
    procedures.push({
      name: 'COVID-19 test',
      estimatedCost: '50-150',
      cptCode: '87635',
    });
  }
  
  if (symptomLower.includes('broken') || symptomLower.includes('fracture') || symptomLower.includes('sprain')) {
    procedures.push({
      name: 'X-ray of affected area',
      estimatedCost: '100-500',
      cptCode: '73060',
    });
  }
  
  if (careLevel === 'emergency' && !procedures.some(p => p.name.includes('blood'))) {
    procedures.push({
      name: 'Basic metabolic panel',
      estimatedCost: '75-200',
      cptCode: '80047',
    });
  }
  
  return procedures;
}
