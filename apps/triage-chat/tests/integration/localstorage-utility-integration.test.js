/**
 * Integration Tests for LocalStorage Utility
 * Tests integration with medical triage components and real storage scenarios
 */

import { LocalStorageUtility } from '@/lib/localstorage-utility';
import { useComponentStateStorage } from '@/hooks/useComponentStateStorage';
import { renderHook, act } from '@testing-library/react';

// Mock fetch for API calls
global.fetch = jest.fn();

const mockMedicalMemory = {
  symptoms: [
    {
      description: 'Chest pain',
      severity: 9,
      onset: '30 minutes ago',
      timestamp: '2024-01-15T12:00:00Z',
    },
    {
      description: 'Shortness of breath',
      severity: 7,
      onset: '30 minutes ago',
      timestamp: '2024-01-15T12:00:00Z',
    },
  ],
  medicalHistory: ['Hypertension', 'Type 2 Diabetes'],
  medications: ['Lisinopril 10mg daily', 'Metformin 1000mg twice daily'],
  allergies: ['Penicillin - severe reaction'],
  emergencyFlags: ['CHEST_PAIN', 'CARDIAC_RISK'],
  lastUpdate: '2024-01-15T12:00:00Z',
};

const mockReasoning = {
  plan: 'Assess chest pain for potential cardiac emergency',
  steps: [
    'Evaluate pain characteristics and radiation',
    'Check vital signs and oxygen saturation',
    'Assess cardiovascular risk factors',
    'Determine urgency and care pathway',
  ],
  observations: [
    'Patient reports severe crushing chest pain',
    'Pain radiates to left arm and jaw',
    'Associated with shortness of breath',
    'History of cardiovascular risk factors',
  ],
  confidence: 0.92,
};

// Skipped: feature not built (local storage utility).
describe.skip('[feature not built] LocalStorage Utility Integration Tests', () => {
  let utility;

  beforeEach(() => {
    utility = new LocalStorageUtility({
      hipaaMode: true,
      encryptionRequired: true,
      auditLogging: true,
    });
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Integration with Medical Components', () => {
    test('stores and retrieves medical session state', async () => {
      const sessionState = {
        currentMemory: mockMedicalMemory,
        currentReasoning: mockReasoning,
        sessionId: 'session_123',
        emergencyDetected: true,
        careLevel: 'emergency',
      };

      const storeResult = await utility.store('medical_session', sessionState, {
        dataType: 'session_state',
        encrypt: true,
        sessionBound: true,
      });

      expect(storeResult.success).toBe(true);
      expect(storeResult.encrypted).toBe(true);

      const retrievedState = await utility.retrieve('medical_session', {
        decrypt: true,
      });

      expect(retrievedState.currentMemory.symptoms).toHaveLength(2);
      expect(retrievedState.emergencyDetected).toBe(true);
      expect(retrievedState.careLevel).toBe('emergency');
    });

    test('integrates with useComponentStateStorage hook', async () => {
      const { result } = renderHook(() => useComponentStateStorage());

      await act(async () => {
        // Simulate processing a medical response
        const mockResponse = {
          updated_reasoning: mockReasoning,
          updated_memory: mockMedicalMemory,
          emergency_detected: true,
          care_level: 'emergency',
          assistant_message:
            'Based on your symptoms, this requires immediate medical attention.',
        };

        result.current.processStatefulResponse(mockResponse);
      });

      // Check that state was properly stored
      expect(result.current.currentReasoning).toEqual(mockReasoning);
      expect(result.current.currentSessionMemory).toEqual(mockMedicalMemory);
      expect(result.current.emergencyDetected).toBe(true);
    });

    test('persists memory across component remounts', async () => {
      // First mount - store medical data
      const { result: firstMount } = renderHook(() =>
        useComponentStateStorage()
      );

      await act(async () => {
        const response = {
          updated_memory: mockMedicalMemory,
          updated_reasoning: mockReasoning,
          emergency_detected: false,
          care_level: 'urgent',
        };
        firstMount.current.processStatefulResponse(response);
      });

      // Simulate component unmount/remount
      const { result: secondMount } = renderHook(() =>
        useComponentStateStorage()
      );

      // Check that memory persisted
      expect(secondMount.current.currentSessionMemory.symptoms).toHaveLength(2);
      expect(secondMount.current.currentSessionMemory.emergencyFlags).toContain(
        'CHEST_PAIN'
      );
    });

    test('handles progressive memory updates', async () => {
      const { result } = renderHook(() => useComponentStateStorage());

      // First medical interaction
      await act(async () => {
        const firstResponse = {
          updated_memory: {
            symptoms: [mockMedicalMemory.symptoms[0]], // Only chest pain
            medicalHistory: mockMedicalMemory.medicalHistory,
            medications: mockMedicalMemory.medications,
            allergies: mockMedicalMemory.allergies,
            emergencyFlags: ['CHEST_PAIN'],
            lastUpdate: '2024-01-15T12:00:00Z',
          },
          updated_reasoning: mockReasoning,
        };
        result.current.processStatefulResponse(firstResponse);
      });

      expect(result.current.currentSessionMemory.symptoms).toHaveLength(1);

      // Second medical interaction - adding symptom
      await act(async () => {
        const secondResponse = {
          updated_memory: mockMedicalMemory, // Now includes shortness of breath
          updated_reasoning: {
            ...mockReasoning,
            observations: [
              ...mockReasoning.observations,
              'Added shortness of breath to assessment',
            ],
          },
        };
        result.current.processStatefulResponse(secondResponse);
      });

      expect(result.current.currentSessionMemory.symptoms).toHaveLength(2);
      expect(result.current.currentReasoning.observations).toContain(
        'Added shortness of breath to assessment'
      );
    });
  });

  describe('Emergency Data Handling', () => {
    test('prioritizes emergency data storage', async () => {
      const emergencyData = {
        emergencyFlags: ['CARDIAC_ARREST', 'IMMEDIATE_911'],
        criticalVitals: {
          consciousness: 'unresponsive',
          breathing: 'absent',
          pulse: 'weak',
        },
        timestamp: Date.now(),
        location: 'Emergency detected - immediate action required',
      };

      const result = await utility.store('emergency_state', emergencyData, {
        dataType: 'session_state',
        encrypt: true,
        emergency: true,
      });

      expect(result.success).toBe(true);

      // Emergency data should be retrievable immediately
      const retrieved = await utility.retrieve('emergency_state', {
        decrypt: true,
      });
      expect(retrieved.emergencyFlags).toContain('CARDIAC_ARREST');
    });

    test('maintains emergency data during storage failures', async () => {
      const emergencyMemory = {
        ...mockMedicalMemory,
        emergencyFlags: ['CARDIAC_EMERGENCY', 'CALL_911_NOW'],
        criticalSymptoms: [
          {
            description: 'Cardiac arrest',
            severity: 10,
            onset: 'now',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      // Mock storage failure
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage full');
      });

      // Should fall back to in-memory storage for emergency data
      const result = await utility.store('emergency_memory', emergencyMemory, {
        dataType: 'session_state',
        emergency: true,
      });

      expect(result.success).toBe(true);
      expect(utility.isFallbackModeActive()).toBe(true);

      // Restore original function
      localStorage.setItem = originalSetItem;
    });

    test('triggers emergency wipe when required', async () => {
      // Store various medical data
      await utility.store('patient_session_1', mockMedicalMemory);
      await utility.store('patient_session_2', mockReasoning);
      await utility.store('emergency_override', { trigger: 'breach_detected' });

      const auditLogBefore = utility.getAuditLog().length;

      // Trigger emergency wipe
      await utility.emergencyWipe();

      expect(localStorage.length).toBe(0);

      const auditLog = utility.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(auditLogBefore);
      expect(auditLog).toContainEqual(
        expect.objectContaining({
          action: 'EMERGENCY_WIPE',
          severity: 'CRITICAL',
        })
      );
    });
  });

  describe('HIPAA Compliance Integration', () => {
    test('prevents PHI storage in medical contexts', async () => {
      const medicalDataWithPHI = {
        patientInfo: {
          name: 'John Doe',
          ssn: '123-45-6789',
          dob: '1980-01-01',
        },
        symptoms: mockMedicalMemory.symptoms,
        diagnosis: 'Acute myocardial infarction',
      };

      await expect(
        utility.store('patient_data', medicalDataWithPHI)
      ).rejects.toThrow('PHI detected');

      // Verify nothing was stored
      const retrieved = await utility.retrieve('patient_data');
      expect(retrieved).toBeNull();
    });

    test('allows anonymized medical data storage', async () => {
      const anonymizedMedicalData = {
        sessionId: 'anon_session_456',
        symptomsReported: ['chest_pain', 'shortness_of_breath'],
        severityScores: [9, 7],
        recommendedCareLevel: 'emergency',
        timestamp: Date.now(),
      };

      const result = await utility.store(
        'anonymized_session',
        anonymizedMedicalData,
        {
          dataType: 'session_state',
          encrypt: true,
        }
      );

      expect(result.success).toBe(true);

      const retrieved = await utility.retrieve('anonymized_session', {
        decrypt: true,
      });
      expect(retrieved.symptomsReported).toContain('chest_pain');
    });

    test('generates HIPAA compliance audit trail', async () => {
      // Attempt to store PHI
      const phiData = { patientSSN: '123-45-6789' };

      try {
        await utility.store('phi_test', phiData);
      } catch (error) {
        // Expected to fail
      }

      // Store legitimate medical session data
      await utility.store(
        'session_data',
        {
          sessionId: 'medical_session_789',
          careLevel: 'urgent',
          timestamp: Date.now(),
        },
        { encrypt: true }
      );

      const auditLog = utility.getAuditLog();

      expect(auditLog).toContainEqual(
        expect.objectContaining({
          action: 'PHI_DETECTED',
          blocked: true,
          severity: 'HIGH',
        })
      );

      expect(auditLog).toContainEqual(
        expect.objectContaining({
          action: 'STORE',
          key: 'session_data',
          encrypted: true,
        })
      );
    });
  });

  describe('Performance and Scalability', () => {
    test('handles large medical datasets efficiently', async () => {
      const largeMedicalDataset = {
        symptoms: Array.from({ length: 100 }, (_, i) => ({
          description: `Symptom ${i}`,
          severity: Math.floor(Math.random() * 10) + 1,
          onset: `${i} minutes ago`,
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
        })),
        medicalHistory: Array.from({ length: 50 }, (_, i) => `Condition ${i}`),
        medications: Array.from({ length: 30 }, (_, i) => `Medication ${i}`),
        allergies: Array.from({ length: 10 }, (_, i) => `Allergy ${i}`),
        emergencyFlags: ['COMPLEX_CASE'],
        lastUpdate: new Date().toISOString(),
      };

      const startTime = performance.now();

      const result = await utility.store(
        'large_medical_dataset',
        largeMedicalDataset,
        {
          dataType: 'session_state',
          encrypt: true,
        }
      );

      const endTime = performance.now();
      const storageTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(storageTime).toBeLessThan(1000); // Should complete within 1 second

      // Test retrieval performance
      const retrieveStartTime = performance.now();
      const retrieved = await utility.retrieve('large_medical_dataset', {
        decrypt: true,
      });
      const retrieveEndTime = performance.now();
      const retrieveTime = retrieveEndTime - retrieveStartTime;

      expect(retrieved.symptoms).toHaveLength(100);
      expect(retrieveTime).toBeLessThan(500); // Should retrieve within 500ms
    });

    test('manages storage quota with automatic cleanup', async () => {
      // Fill storage with temporary medical sessions
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          utility.store(
            `temp_session_${i}`,
            {
              sessionData: `Medical session ${i}`,
              timestamp: Date.now() - i * 3600000, // Older sessions
            },
            {
              expirationTime: i < 10 ? 1000 : 300000, // First 10 expire quickly
              sessionBound: true,
            }
          )
        );
      }

      await Promise.all(promises);

      // Trigger cleanup by attempting to store when quota is full
      const cleanupResult = await utility.clear('temp_session_*', {
        olderThan: 500,
      });

      expect(cleanupResult.itemsRemoved).toBeGreaterThan(0);
      expect(cleanupResult.bytesFreed).toBeGreaterThan(0);
    });

    test('optimizes encryption for medical data types', async () => {
      const sensitiveData = {
        sessionToken: 'session_abc123',
        userRole: 'physician',
        accessLevel: 'full_medical_access',
      };

      const nonSensitiveData = {
        uiTheme: 'dark',
        language: 'en',
        notificationPreferences: true,
      };

      // Sensitive data should be encrypted
      const sensitiveResult = await utility.store('sensitive', sensitiveData, {
        dataType: 'session_state',
      });

      // Non-sensitive data should not require encryption
      const nonSensitiveResult = await utility.store(
        'preferences',
        nonSensitiveData,
        {
          dataType: 'ui_preferences',
        }
      );

      expect(sensitiveResult.encrypted).toBe(true);
      expect(nonSensitiveResult.encrypted).toBe(false);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('recovers from browser storage corruption', async () => {
      // Store valid medical data
      await utility.store('medical_session', mockMedicalMemory);

      // Corrupt the stored data
      localStorage.setItem('medical_session', 'corrupted-data{invalid-json');

      // Should handle corruption gracefully
      const retrieved = await utility.retrieve('medical_session');
      expect(retrieved).toBeNull();

      // Should log the corruption event
      const auditLog = utility.getAuditLog();
      expect(auditLog).toContainEqual(
        expect.objectContaining({
          action: 'DATA_CORRUPTION_DETECTED',
          key: 'medical_session',
        })
      );
    });

    test('maintains functionality during storage degradation', async () => {
      // Mock intermittent storage failures
      let callCount = 0;
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn((key, value) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Storage temporarily unavailable');
        }
        return originalSetItem.call(localStorage, key, value);
      });

      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await utility.store(`test_item_${i}`, {
          medicalData: `Session ${i}`,
          timestamp: Date.now(),
        });
        results.push(result);
      }

      // Some operations should succeed despite failures
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Fallback mode should be activated
      expect(utility.isFallbackModeActive()).toBe(true);

      // Restore original function
      localStorage.setItem = originalSetItem;
    });

    test('handles concurrent medical session updates', async () => {
      const sessionId = 'concurrent_medical_session';

      // Simulate multiple concurrent updates to medical session
      const concurrentPromises = [];

      for (let i = 0; i < 5; i++) {
        concurrentPromises.push(
          utility.store(
            sessionId,
            {
              ...mockMedicalMemory,
              lastUpdate: new Date(Date.now() + i * 1000).toISOString(),
              updateNumber: i,
            },
            {
              dataType: 'session_state',
              encrypt: true,
            }
          )
        );
      }

      const results = await Promise.all(concurrentPromises);

      // All operations should complete
      results.forEach((result) => {
        expect(result).toHaveProperty('success');
      });

      // Final state should be consistent
      const finalState = await utility.retrieve(sessionId, { decrypt: true });
      expect(finalState).toHaveProperty('updateNumber');
      expect(finalState.symptoms).toHaveLength(2);
    });
  });

  describe('Cross-Component Data Sharing', () => {
    test('shares memory data between reasoning and memory display components', async () => {
      // Store medical session data
      const sessionData = {
        memory: mockMedicalMemory,
        reasoning: mockReasoning,
        careLevel: 'emergency',
      };

      await utility.store('shared_session', sessionData, {
        dataType: 'session_state',
        encrypt: true,
      });

      // Simulate ReasoningDisplay component accessing data
      const reasoningData = await utility.retrieve('shared_session', {
        decrypt: true,
      });
      expect(reasoningData.reasoning.confidence).toBe(0.92);

      // Simulate MemoryDisplay component accessing same data
      const memoryData = await utility.retrieve('shared_session', {
        decrypt: true,
      });
      expect(memoryData.memory.symptoms).toHaveLength(2);
      expect(memoryData.memory.emergencyFlags).toContain('CHEST_PAIN');
    });

    test('maintains data consistency across component updates', async () => {
      const initialSession = {
        memory: mockMedicalMemory,
        reasoning: mockReasoning,
        lastActivity: Date.now(),
      };

      await utility.store('consistent_session', initialSession, {
        encrypt: true,
      });

      // Simulate memory component updating symptoms
      const updatedMemory = {
        ...mockMedicalMemory,
        symptoms: [
          ...mockMedicalMemory.symptoms,
          {
            description: 'Nausea',
            severity: 5,
            onset: '10 minutes ago',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await utility.store(
        'consistent_session',
        {
          ...initialSession,
          memory: updatedMemory,
          lastActivity: Date.now(),
        },
        { encrypt: true }
      );

      // Verify both components see the update
      const currentSession = await utility.retrieve('consistent_session', {
        decrypt: true,
      });
      expect(currentSession.memory.symptoms).toHaveLength(3);
      expect(currentSession.memory.symptoms[2].description).toBe('Nausea');
    });
  });
});

/**
 * Test utilities for integration testing
 */
const createMockMedicalSession = (overrides = {}) => {
  return {
    sessionId: 'test_session_' + Date.now(),
    memory: mockMedicalMemory,
    reasoning: mockReasoning,
    careLevel: 'urgent',
    emergencyDetected: false,
    timestamp: Date.now(),
    ...overrides,
  };
};

const simulateNetworkFailure = () => {
  global.fetch.mockRejectedValue(new Error('Network error'));
};

const simulateStorageQuotaExceeded = () => {
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = jest.fn(() => {
    throw new Error('QuotaExceededError');
  });
  return () => {
    localStorage.setItem = originalSetItem;
  };
};

const createLargeMedicalDataset = (size = 100) => {
  return {
    symptoms: Array.from({ length: size }, (_, i) => ({
      description: `Test symptom ${i}`,
      severity: Math.floor(Math.random() * 10) + 1,
      onset: `${i} minutes ago`,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
    })),
    medicalHistory: Array.from(
      { length: size / 2 },
      (_, i) => `Condition ${i}`
    ),
    medications: Array.from({ length: size / 3 }, (_, i) => `Medication ${i}`),
    allergies: Array.from({ length: size / 10 }, (_, i) => `Allergy ${i}`),
    emergencyFlags: ['TEST_FLAG'],
    lastUpdate: new Date().toISOString(),
  };
};
