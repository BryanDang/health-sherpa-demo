/**
 * Unit Tests for Component State Storage
 * Tests core functionality for storing stateful LLM response data
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');
const { renderHook, act } = require('@testing-library/react');
const {
  useComponentStateStorage,
} = require('../../src/hooks/useComponentStateStorage');

describe('Component State Storage Unit Tests', () => {
  let mockSetState;

  beforeEach(() => {
    mockSetState = jest.fn();
  });

  describe('Input Validation', () => {
    test('validates stateful response structure', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const validResponse = {
        updated_reasoning: {
          plan: 'Assessment plan',
          steps: ['Step 1', 'Step 2'],
          observations: ['Observation 1'],
          confidence: 0.8,
        },
        assistant_message: 'Test message',
        updated_memory: {
          symptoms: [],
          medicalHistory: [],
          medications: [],
          allergies: [],
          emergencyFlags: [],
          lastUpdate: '2023-01-01T12:00:00Z',
        },
        emergency_detected: false,
        care_level: 'primary',
        timestamp: '2023-01-01T12:00:00Z',
      };

      expect(result.current.validateStatefulResponse(validResponse)).toBe(true);
    });

    test('rejects invalid response structure', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const invalidResponse = {
        // Missing required fields
        some_field: 'value',
      };

      expect(result.current.validateStatefulResponse(invalidResponse)).toBe(
        false
      );
    });

    test('validates memory object structure', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const validMemory = {
        symptoms: [
          {
            description: 'Test symptom',
            severity: 5,
            onset: 'recent',
            timestamp: '2023-01-01T12:00:00Z',
          },
        ],
        medicalHistory: ['History item'],
        medications: ['Medication'],
        allergies: ['Allergy'],
        emergencyFlags: ['EMERGENCY'],
        lastUpdate: '2023-01-01T12:00:00Z',
      };

      expect(result.current.validateMemoryObject(validMemory)).toBe(true);
    });

    test('validates reasoning object structure', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const validReasoning = {
        plan: 'Assessment plan',
        steps: ['Step 1', 'Step 2'],
        observations: ['Observation 1'],
        confidence: 0.8,
      };

      expect(result.current.validateReasoningObject(validReasoning)).toBe(true);
    });
  });

  describe('State Processing', () => {
    test('processes valid stateful response correctly', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const statefulResponse = {
        updated_reasoning: {
          plan: 'Medical assessment',
          steps: ['Check symptoms', 'Determine urgency'],
          observations: ['Patient reports breathing difficulty'],
          confidence: 0.9,
        },
        assistant_message: 'Please seek immediate medical attention',
        updated_memory: {
          symptoms: [
            {
              description: 'breathing difficulty',
              severity: 9,
              onset: 'sudden',
              timestamp: '2023-01-01T12:00:00Z',
            },
          ],
          medicalHistory: [],
          medications: [],
          allergies: [],
          emergencyFlags: ['RESPIRATORY_DISTRESS'],
          lastUpdate: '2023-01-01T12:00:00Z',
        },
        emergency_detected: true,
        care_level: 'emergency',
        timestamp: '2023-01-01T12:00:00Z',
      };

      act(() => {
        result.current.processStatefulResponse(statefulResponse);
      });

      expect(result.current.currentReasoning).toEqual(
        statefulResponse.updated_reasoning
      );
      expect(result.current.currentSessionMemory).toEqual(
        statefulResponse.updated_memory
      );
      expect(result.current.emergencyDetected).toBe(true);
      expect(result.current.currentCareLevel).toBe('emergency');
    });

    test('extracts emergency flags from memory', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const memoryWithEmergencyFlags = {
        symptoms: [],
        medicalHistory: [],
        medications: [],
        allergies: [],
        emergencyFlags: ['RESPIRATORY_DISTRESS', 'CARDIAC_SYMPTOMS'],
        lastUpdate: '2023-01-01T12:00:00Z',
      };

      act(() => {
        result.current.updateSessionMemory(memoryWithEmergencyFlags);
      });

      expect(result.current.emergencyDetected).toBe(true);
      expect(result.current.currentSessionMemory.emergencyFlags).toHaveLength(
        2
      );
    });

    test('determines care level from response', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const careLevels = ['emergency', 'urgent', 'primary', 'self_care'];

      careLevels.forEach((level) => {
        act(() => {
          result.current.updateCareLevel(level);
        });

        expect(result.current.currentCareLevel).toBe(level);
      });
    });
  });

  describe('Message Enhancement', () => {
    test('enhances existing message with reasoning and memory', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const existingMessage = {
        id: 'msg-123',
        role: 'assistant',
        content: 'Test message',
        timestamp: new Date('2023-01-01T12:00:00Z'),
      };

      const reasoning = {
        plan: 'Assessment plan',
        steps: ['Step 1'],
        observations: ['Observation 1'],
        confidence: 0.8,
      };

      const memory = {
        symptoms: [],
        medicalHistory: [],
        medications: [],
        allergies: [],
        emergencyFlags: [],
        lastUpdate: '2023-01-01T12:00:00Z',
      };

      act(() => {
        const enhancedMessage = result.current.enhanceMessage(
          existingMessage,
          reasoning,
          memory
        );
        result.current.updateMessages([enhancedMessage]);
      });

      const messages = result.current.messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].reasoning).toEqual(reasoning);
      expect(messages[0].memory).toEqual(memory);
    });

    test('handles message enhancement with missing data', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const existingMessage = {
        id: 'msg-123',
        role: 'assistant',
        content: 'Test message',
        timestamp: new Date('2023-01-01T12:00:00Z'),
      };

      act(() => {
        const enhancedMessage = result.current.enhanceMessage(
          existingMessage,
          null,
          null
        );
        result.current.updateMessages([enhancedMessage]);
      });

      const messages = result.current.messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].reasoning).toBeUndefined();
      expect(messages[0].memory).toBeUndefined();
    });
  });

  describe('State Getters', () => {
    test('returns current session memory', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const memory = {
        symptoms: [
          {
            description: 'headache',
            severity: 6,
            onset: 'gradual',
            timestamp: '2023-01-01T12:00:00Z',
          },
        ],
        medicalHistory: ['migraine'],
        medications: ['ibuprofen'],
        allergies: ['penicillin'],
        emergencyFlags: [],
        lastUpdate: '2023-01-01T12:00:00Z',
      };

      act(() => {
        result.current.updateSessionMemory(memory);
      });

      expect(result.current.getCurrentSessionMemory()).toEqual(memory);
    });

    test('returns current reasoning state', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      const reasoning = {
        plan: 'Headache assessment',
        steps: ['Check severity', 'Review history'],
        observations: ['Chronic headache pattern'],
        confidence: 0.7,
      };

      act(() => {
        result.current.updateReasoning(reasoning);
      });

      expect(result.current.getCurrentReasoning()).toEqual(reasoning);
    });

    test('returns emergency detection status', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      expect(result.current.isEmergencyDetected()).toBe(false);

      act(() => {
        result.current.setEmergencyDetected(true);
      });

      expect(result.current.isEmergencyDetected()).toBe(true);
    });
  });

  describe('State Clearing', () => {
    test('clears all state data', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      // Set up some state
      act(() => {
        result.current.updateSessionMemory({
          symptoms: [],
          medicalHistory: [],
          medications: [],
          allergies: [],
          emergencyFlags: ['EMERGENCY'],
          lastUpdate: '2023-01-01T12:00:00Z',
        });
        result.current.setEmergencyDetected(true);
        result.current.updateCareLevel('emergency');
      });

      // Clear all state
      act(() => {
        result.current.clearAllState();
      });

      expect(result.current.currentSessionMemory).toBeNull();
      expect(result.current.currentReasoning).toBeNull();
      expect(result.current.currentCareLevel).toBeNull();
      expect(result.current.emergencyDetected).toBe(false);
      expect(result.current.messages).toHaveLength(0);
    });

    test('clears only session memory', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      // Set up state
      act(() => {
        result.current.updateSessionMemory({
          symptoms: [],
          medicalHistory: [],
          medications: [],
          allergies: [],
          emergencyFlags: [],
          lastUpdate: '2023-01-01T12:00:00Z',
        });
        result.current.updateReasoning({
          plan: 'Test',
          steps: [],
          observations: [],
          confidence: 0.5,
        });
      });

      // Clear only memory
      act(() => {
        result.current.clearSessionMemory();
      });

      expect(result.current.currentSessionMemory).toBeNull();
      expect(result.current.currentReasoning).not.toBeNull(); // Should remain
    });
  });

  describe('State Validation', () => {
    test('validates state consistency', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      // Set up consistent state
      act(() => {
        result.current.updateSessionMemory({
          symptoms: [],
          medicalHistory: [],
          medications: [],
          allergies: [],
          emergencyFlags: ['EMERGENCY'],
          lastUpdate: '2023-01-01T12:00:00Z',
        });
        result.current.setEmergencyDetected(true);
      });

      expect(result.current.validateStateConsistency()).toBe(true);
    });

    test('detects state inconsistency', () => {
      const { result } = renderHook(() => useComponentStateStorage());

      // Set up inconsistent state
      act(() => {
        result.current.updateSessionMemory({
          symptoms: [],
          medicalHistory: [],
          medications: [],
          allergies: [],
          emergencyFlags: ['EMERGENCY'], // Has emergency flag
          lastUpdate: '2023-01-01T12:00:00Z',
        });
        result.current.setEmergencyDetected(false); // But emergency detected is false
      });

      expect(result.current.validateStateConsistency()).toBe(false);
    });
  });
});
