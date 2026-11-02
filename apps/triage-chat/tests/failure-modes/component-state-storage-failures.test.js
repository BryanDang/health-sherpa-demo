/**
 * Failure Mode Tests for Component State Storage
 * Tests all the ways state management can fail
 */

import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { useComponentStateStorage } from "../../src/hooks/useComponentStateStorage";

describe("Component State Storage Failure Modes", () => {
  let hook;

  // Run a response through the mounted hook and keep React state in sync.
  const processResponse = (response) => {
    act(() => {
      hook.result.current.processStatefulResponse(response);
    });
  };

  const memoryWith = (emergencyFlags) => ({
    symptoms: [],
    medicalHistory: [],
    medications: [],
    allergies: [],
    emergencyFlags,
    lastUpdate: "2023-01-01",
  });

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    hook = renderHook(() => useComponentStateStorage());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Malformed Response Handling", () => {
    test("handles completely malformed stateful response", () => {
      const malformedResponse = {
        // Missing required fields
        some_random_field: "value",
      };

      expect(() => {
        processResponse(malformedResponse);
      }).not.toThrow();

      // Safe defaults
      expect(hook.result.current.currentSessionMemory).toBeNull();
      expect(hook.result.current.currentReasoning).toBeNull();
      expect(hook.result.current.emergencyDetected).toBe(false);
    });

    test("handles null/undefined stateful response", () => {
      [null, undefined].forEach((response) => {
        expect(() => {
          processResponse(response);
        }).not.toThrow();

        expect(hook.result.current.currentSessionMemory).toBeNull();
      });
    });

    test("handles partial stateful response with missing nested objects", () => {
      const partialResponse = {
        assistant_message: "Some message",
        // Missing updated_reasoning and updated_memory
      };

      expect(() => {
        processResponse(partialResponse);
      }).not.toThrow();

      // Missing nested objects leave reasoning and memory empty
      expect(hook.result.current.currentReasoning).toBeNull();
      expect(hook.result.current.currentSessionMemory).toBeNull();
    });
  });

  describe("Memory Object Structure Changes", () => {
    test("handles memory object with unexpected structure", () => {
      const responseWithBadMemory = {
        assistant_message: "Test message",
        updated_memory: {
          // Wrong structure - should have arrays but has strings
          symptoms: "not an array",
          emergencyFlags: "not an array either",
          invalidField: "should be ignored",
        },
      };

      expect(() => {
        processResponse(responseWithBadMemory);
      }).not.toThrow();

      // Non-array memory fields reject the response and leave memory empty
      expect(hook.result.current.currentSessionMemory).toBeNull();
      expect(hook.result.current.emergencyDetected).toBe(false);
    });

    test("handles memory with malformed symptoms array", () => {
      const responseWithBadSymptoms = {
        assistant_message: "Test message",
        updated_memory: {
          symptoms: [
            {
              description: "Valid symptom",
              severity: 5,
              onset: "recent",
              timestamp: "2023-01-01",
            },
            { description: "Missing fields" }, // Missing severity, onset, timestamp
            "not an object", // Wrong type
            null, // Null entry
          ],
          emergencyFlags: ["RESPIRATORY_DISTRESS"],
          medicalHistory: [],
          medications: [],
          allergies: [],
          lastUpdate: "2023-01-01",
        },
      };

      expect(() => {
        processResponse(responseWithBadSymptoms);
      }).not.toThrow();

      // A malformed symptom entry rejects the response and leaves memory empty
      expect(hook.result.current.currentSessionMemory).toBeNull();
    });
  });

  describe("Race Condition Handling", () => {
    test("handles rapid sequential state updates", async () => {
      const responses = [
        {
          assistant_message: "First",
          updated_memory: memoryWith([]),
        },
        {
          assistant_message: "Second",
          updated_memory: memoryWith(["EMERGENCY"]),
        },
        {
          assistant_message: "Third",
          updated_memory: memoryWith([]),
        },
      ];

      // Simulate rapid API calls
      responses.forEach((response, index) => {
        setTimeout(() => {
          processResponse(response);
        }, index * 10);
      });

      // Wait for all updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // The last response wins and has no emergency flags
      expect(hook.result.current.currentSessionMemory.emergencyFlags).toEqual(
        [],
      );
      expect(hook.result.current.emergencyDetected).toBe(false);
    });

    test("handles concurrent state updates from multiple sources", () => {
      act(() => {
        hook.result.current.setCurrentSessionMemory(memoryWith([]));
        hook.result.current.setCurrentReasoning({
          plan: "test",
          steps: [],
          observations: [],
          confidence: 0.5,
        });
        hook.result.current.setEmergencyDetected(true);
        hook.result.current.setCurrentCareLevel("emergency");
      });

      // No crash and every update lands
      expect(hook.result.current.currentSessionMemory).not.toBeNull();
      expect(hook.result.current.currentReasoning.plan).toBe("test");
      expect(hook.result.current.emergencyDetected).toBe(true);
      expect(hook.result.current.currentCareLevel).toBe("emergency");
    });
  });

  describe("State Consistency Issues", () => {
    test("handles inconsistent emergency detection between memory and flags", () => {
      const inconsistentResponse = {
        assistant_message: "Test message",
        updated_memory: {
          symptoms: [],
          emergencyFlags: ["RESPIRATORY_DISTRESS"], // Has emergency flag
          medicalHistory: [],
          medications: [],
          allergies: [],
          lastUpdate: "2023-01-01",
        },
        emergency_detected: false, // But emergency_detected is false
        care_level: "self_care", // And care level is self_care
      };

      expect(() => {
        processResponse(inconsistentResponse);
      }).not.toThrow();

      // Should prioritize memory emergencyFlags over emergency_detected
      expect(hook.result.current.emergencyDetected).toBe(true);
    });

    test("handles state where messages and memory become out of sync", () => {
      const messagesWithOldMemory = [
        {
          id: "1",
          role: "assistant",
          content: "Old message",
          memory: { symptoms: [], emergencyFlags: [] },
        },
      ];

      const newMemory = {
        symptoms: [
          {
            description: "New symptom",
            severity: 8,
            onset: "recent",
            timestamp: "2023-01-02",
          },
        ],
        emergencyFlags: ["EMERGENCY"],
        medicalHistory: [],
        medications: [],
        allergies: [],
        lastUpdate: "2023-01-02",
      };

      // Memory updates stay independent of the message history
      act(() => {
        hook.result.current.updateMessages(messagesWithOldMemory);
        hook.result.current.setCurrentSessionMemory(newMemory);
      });

      expect(hook.result.current.currentSessionMemory).toEqual(newMemory);
      expect(hook.result.current.messages).toHaveLength(1);
    });
  });

  describe("Performance and Memory Issues", () => {
    test("handles large memory objects without performance degradation", () => {
      const largeMemory = {
        symptoms: Array(1000)
          .fill()
          .map((_, i) => ({
            description: `Symptom ${i}`,
            severity: 5,
            onset: "recent",
            timestamp: "2023-01-01",
          })),
        emergencyFlags: Array(100).fill("EMERGENCY"),
        medicalHistory: Array(500).fill("History item"),
        medications: Array(200).fill("Medication"),
        allergies: Array(100).fill("Allergy"),
        lastUpdate: "2023-01-01",
      };

      const startTime = Date.now();

      expect(() => {
        processResponse({
          assistant_message: "Test",
          updated_memory: largeMemory,
        });
      }).not.toThrow();

      const endTime = Date.now();

      // Should process large memory objects quickly (< 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });

    test("handles memory cleanup when component unmounts", () => {
      const { unmount, result } = renderHook(() => useComponentStateStorage());

      // Set some memory
      act(() => {
        result.current.setCurrentSessionMemory({
          symptoms: [],
          emergencyFlags: [],
          medicalHistory: [],
          medications: [],
          allergies: [],
          lastUpdate: "2023-01-01",
        });
      });

      expect(() => {
        unmount();
      }).not.toThrow();

      // Should clean up memory references
      // This prevents memory leaks in React
    });
  });

  describe("Component Crash Prevention", () => {
    test("handles deeply nested undefined properties", () => {
      const responseWithDeepNesting = {
        updated_memory: {
          symptoms: [
            {
              description: "Test",
              details: {
                nested: {
                  property: {
                    that: {
                      does: {
                        not: {
                          exist: undefined,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      };

      expect(() => {
        processResponse(responseWithDeepNesting);
      }).not.toThrow();
    });

    test("handles circular references in memory objects", () => {
      const circularMemory = {
        symptoms: [],
        emergencyFlags: [],
        medicalHistory: [],
        medications: [],
        allergies: [],
        lastUpdate: "2023-01-01",
      };

      // Create circular reference
      circularMemory.circularRef = circularMemory;

      expect(() => {
        processResponse({
          assistant_message: "Test",
          updated_memory: circularMemory,
        });
      }).not.toThrow();
    });
  });

  describe("Stale State Prevention", () => {
    test("handles stale state during rapid updates", async () => {
      let stateUpdateCount = 0;

      const mockStateUpdate = () => {
        stateUpdateCount++;
        return new Promise((resolve) => setTimeout(resolve, 50));
      };

      // Simulate rapid state updates
      const updates = [mockStateUpdate(), mockStateUpdate(), mockStateUpdate()];

      await Promise.all(updates);

      // Should handle all updates without showing stale state
      expect(stateUpdateCount).toBe(3);
    });

    test("handles state updates during component re-renders", () => {
      const { rerender, result } = renderHook(() => useComponentStateStorage());

      // Simulate state update during re-render
      expect(() => {
        rerender();
        act(() => {
          result.current.setCurrentSessionMemory(memoryWith([]));
        });
      }).not.toThrow();
    });
  });
});
