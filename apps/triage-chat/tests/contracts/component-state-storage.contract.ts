/**
 * Contract for TriageChat Component State Storage
 * Defines how the component stores and manages stateful LLM response data
 */

export interface ComponentStateStorageContract {
  /**
   * Input: Data structures that need to be stored in component state
   */
  inputs: {
    /** Stateful LLM response from API */
    statefulResponse: {
      updated_reasoning: {
        plan: string;
        steps: string[];
        observations: string[];
        confidence: number;
      };
      assistant_message: string;
      updated_memory: {
        symptoms: Array<{
          description: string;
          severity: number;
          onset: string;
          timestamp: string;
        }>;
        medicalHistory: string[];
        medications: string[];
        allergies: string[];
        emergencyFlags: string[];
        lastUpdate: string;
      };
      emergency_detected: boolean;
      care_level: 'emergency' | 'urgent' | 'primary' | 'self_care';
      timestamp: string;
    };

    /** Existing message that needs reasoning/memory attached */
    existingMessage: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
    };
  };

  /**
   * Output: Component state updates and data structures
   */
  outputs: {
    /** Updated component state structure */
    componentState: {
      /** Array of messages with enhanced data */
      messages: Array<{
        id: string;
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
        reasoning?: {
          plan: string;
          steps: string[];
          observations: string[];
          confidence: number;
        };
        memory?: {
          symptoms: Array<{
            description: string;
            severity: number;
            onset: string;
            timestamp: string;
          }>;
          medicalHistory: string[];
          medications: string[];
          allergies: string[];
          emergencyFlags: string[];
          lastUpdate: string;
        };
        careLevel?: 'emergency' | 'urgent' | 'primary' | 'self_care';
        emergencyDetected?: boolean;
      }>;

      /** Current session memory (latest state) */
      currentSessionMemory: {
        symptoms: Array<{
          description: string;
          severity: number;
          onset: string;
          timestamp: string;
        }>;
        medicalHistory: string[];
        medications: string[];
        allergies: string[];
        emergencyFlags: string[];
        lastUpdate: string;
      } | null;

      /** Current reasoning state */
      currentReasoning: {
        plan: string;
        steps: string[];
        observations: string[];
        confidence: number;
      } | null;

      /** Current care level */
      currentCareLevel: 'emergency' | 'urgent' | 'primary' | 'self_care' | null;

      /** Emergency detection flag */
      emergencyDetected: boolean;
    };

    /** State setter functions */
    stateFunctions: {
      updateMessages: (messages: any[]) => void;
      setCurrentSessionMemory: (memory: any) => void;
      setCurrentReasoning: (reasoning: any) => void;
      setCurrentCareLevel: (level: any) => void;
      setEmergencyDetected: (detected: boolean) => void;
    };
  };

  /**
   * Side effects: What happens when state is updated
   */
  sideEffects: [
    'React component re-renders',
    'UI updates to show new reasoning/memory data',
    'Emergency UI alerts may trigger',
    'Progressive disclosure components receive new data',
    'Care level indicators update',
    'Memory persistence triggers may activate',
  ];

  /**
   * Failure modes: How this can fail
   */
  failureModes: [
    'Malformed stateful response causes state corruption',
    'Memory object structure changes break existing state',
    'Race conditions during rapid API calls',
    'State becomes inconsistent between memory and messages',
    'Emergency flags not properly detected in state',
    'Component crashes due to undefined nested properties',
    'Memory grows unbounded causing performance issues',
    'Stale state displayed to user during updates',
  ];

  /**
   * Dependencies: What this relies on
   */
  dependencies: [
    'React useState hooks',
    'React useCallback hooks',
    'Stateful LLM API response format',
    'Existing TriageChat message structure',
    'Emergency detection logic',
    'Care level determination logic',
  ];
}

/**
 * Type definitions for the contract
 */
export type StatefulLLMResponse =
  ComponentStateStorageContract['inputs']['statefulResponse'];
export type EnhancedMessage =
  ComponentStateStorageContract['outputs']['componentState']['messages'][0];
export type SessionMemory =
  ComponentStateStorageContract['outputs']['componentState']['currentSessionMemory'];
export type ReasoningState =
  ComponentStateStorageContract['outputs']['componentState']['currentReasoning'];
export type CareLevel =
  ComponentStateStorageContract['outputs']['componentState']['currentCareLevel'];
