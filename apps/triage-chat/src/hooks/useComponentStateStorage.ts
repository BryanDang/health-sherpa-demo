/**
 * Component State Storage Hook
 * Manages stateful LLM response data in React component state
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  StatefulLLMResponse,
  EnhancedMessage,
  SessionMemory,
  ReasoningState,
  CareLevel,
} from '../../tests/contracts/component-state-storage.contract';

export interface UseComponentStateStorageReturn {
  // State getters
  messages: EnhancedMessage[];
  currentSessionMemory: SessionMemory;
  currentReasoning: ReasoningState;
  currentCareLevel: CareLevel;
  emergencyDetected: boolean;

  // State setters
  updateMessages: (messages: EnhancedMessage[]) => void;
  setCurrentSessionMemory: (memory: SessionMemory) => void;
  setCurrentReasoning: (reasoning: ReasoningState) => void;
  setCurrentCareLevel: (level: CareLevel) => void;
  setEmergencyDetected: (detected: boolean) => void;

  // Processing functions
  processStatefulResponse: (response: StatefulLLMResponse) => void;
  enhanceMessage: (
    message: any,
    reasoning: ReasoningState,
    memory: SessionMemory
  ) => EnhancedMessage;

  // State management
  updateSessionMemory: (memory: SessionMemory) => void;
  updateReasoning: (reasoning: ReasoningState) => void;
  updateCareLevel: (level: CareLevel) => void;

  // Validation functions
  validateStatefulResponse: (response: any) => boolean;
  validateMemoryObject: (memory: any) => boolean;
  validateReasoningObject: (reasoning: any) => boolean;
  validateStateConsistency: () => boolean;

  // Utility functions
  getCurrentSessionMemory: () => SessionMemory;
  getCurrentReasoning: () => ReasoningState;
  isEmergencyDetected: () => boolean;
  getProgressiveDisclosureData: () => any;
  getMessageContextForApi: () => any;

  // Lifecycle functions
  initializeState: () => void;
  clearAllState: () => void;
  clearSessionMemory: () => void;
  cleanup: () => void;

  // Persistence functions
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;

  // Integration functions
  setEmergencyCallback: (callback: (data: any) => void) => void;
  handleApiError: (status: number, message: string) => void;
}

/**
 * Hook for managing component state storage
 */
export function useComponentStateStorage(): UseComponentStateStorageReturn {
  // Core state
  const [messages, setMessages] = useState<EnhancedMessage[]>([]);
  const [currentSessionMemory, setCurrentSessionMemoryState] =
    useState<SessionMemory>(null);
  const [currentReasoning, setCurrentReasoningState] =
    useState<ReasoningState>(null);
  const [currentCareLevel, setCurrentCareLevelState] =
    useState<CareLevel>(null);
  const [emergencyDetected, setEmergencyDetectedState] =
    useState<boolean>(false);

  // Integration state
  const [emergencyCallback, setEmergencyCallbackState] = useState<
    ((data: any) => void) | null
  >(null);

  /**
   * Validate stateful response structure
   */
  const validateStatefulResponse = useCallback((response: any): boolean => {
    if (!response || typeof response !== 'object') {
      return false;
    }

    // Check required fields
    if (
      !response.assistant_message ||
      typeof response.assistant_message !== 'string'
    ) {
      return false;
    }

    // Validate reasoning object if present
    if (
      response.updated_reasoning &&
      !validateReasoningObject(response.updated_reasoning)
    ) {
      return false;
    }

    // Validate memory object if present
    if (
      response.updated_memory &&
      !validateMemoryObject(response.updated_memory)
    ) {
      return false;
    }

    return true;
  }, []);

  /**
   * Validate memory object structure
   */
  const validateMemoryObject = useCallback((memory: any): boolean => {
    if (!memory || typeof memory !== 'object') {
      return false;
    }

    // Check required arrays
    const requiredArrays = [
      'symptoms',
      'medicalHistory',
      'medications',
      'allergies',
      'emergencyFlags',
    ];
    for (const field of requiredArrays) {
      if (!Array.isArray(memory[field])) {
        return false;
      }
    }

    // Validate symptoms structure
    if (memory.symptoms.length > 0) {
      for (const symptom of memory.symptoms) {
        if (!symptom || typeof symptom !== 'object') {
          return false;
        }
        if (!symptom.description || typeof symptom.description !== 'string') {
          return false;
        }
        if (
          typeof symptom.severity !== 'number' ||
          symptom.severity < 0 ||
          symptom.severity > 10
        ) {
          return false;
        }
        if (!symptom.onset || typeof symptom.onset !== 'string') {
          return false;
        }
        if (!symptom.timestamp || typeof symptom.timestamp !== 'string') {
          return false;
        }
      }
    }

    // Validate lastUpdate
    if (!memory.lastUpdate || typeof memory.lastUpdate !== 'string') {
      return false;
    }

    return true;
  }, []);

  /**
   * Validate reasoning object structure
   */
  const validateReasoningObject = useCallback((reasoning: any): boolean => {
    if (!reasoning || typeof reasoning !== 'object') {
      return false;
    }

    // Check required fields
    if (!reasoning.plan || typeof reasoning.plan !== 'string') {
      return false;
    }

    if (!Array.isArray(reasoning.steps)) {
      return false;
    }

    if (!Array.isArray(reasoning.observations)) {
      return false;
    }

    if (
      typeof reasoning.confidence !== 'number' ||
      reasoning.confidence < 0 ||
      reasoning.confidence > 1
    ) {
      return false;
    }

    return true;
  }, []);

  /**
   * Validate state consistency
   */
  const validateStateConsistency = useCallback((): boolean => {
    // Check if emergency detected matches emergency flags
    if (
      currentSessionMemory &&
      currentSessionMemory.emergencyFlags.length > 0
    ) {
      return emergencyDetected === true;
    }

    if (
      currentSessionMemory &&
      currentSessionMemory.emergencyFlags.length === 0
    ) {
      return emergencyDetected === false;
    }

    return true;
  }, [currentSessionMemory, emergencyDetected]);

  /**
   * Normalize and clean memory object
   */
  const normalizeMemoryObject = useCallback((memory: any): SessionMemory => {
    if (!memory || typeof memory !== 'object') {
      return null;
    }

    // Filter valid symptoms
    const validSymptoms = (memory.symptoms || []).filter((symptom: any) => {
      return (
        symptom &&
        typeof symptom === 'object' &&
        typeof symptom.description === 'string' &&
        typeof symptom.severity === 'number' &&
        typeof symptom.onset === 'string' &&
        typeof symptom.timestamp === 'string'
      );
    });

    // Ensure arrays
    const normalizedMemory: SessionMemory = {
      symptoms: validSymptoms,
      medicalHistory: Array.isArray(memory.medicalHistory)
        ? memory.medicalHistory
        : [],
      medications: Array.isArray(memory.medications) ? memory.medications : [],
      allergies: Array.isArray(memory.allergies) ? memory.allergies : [],
      emergencyFlags: Array.isArray(memory.emergencyFlags)
        ? memory.emergencyFlags
        : [],
      lastUpdate: memory.lastUpdate || new Date().toISOString(),
    };

    return normalizedMemory;
  }, []);

  /**
   * Process stateful response from API
   */
  const processStatefulResponse = useCallback(
    (response: StatefulLLMResponse) => {
      if (!response) {
        // Set safe defaults
        setCurrentSessionMemoryState(null);
        setCurrentReasoningState(null);
        setEmergencyDetectedState(false);
        setCurrentCareLevelState(null);
        return;
      }

      // Validate response
      if (!validateStatefulResponse(response)) {
        console.warn('Invalid stateful response structure:', response);
        // Set safe defaults
        setCurrentSessionMemoryState(null);
        setCurrentReasoningState(null);
        setEmergencyDetectedState(false);
        setCurrentCareLevelState(null);
        return;
      }

      // Process reasoning
      if (
        response.updated_reasoning &&
        validateReasoningObject(response.updated_reasoning)
      ) {
        setCurrentReasoningState(response.updated_reasoning);
      } else {
        setCurrentReasoningState(null);
      }

      // Process memory
      const normalizedMemory = normalizeMemoryObject(response.updated_memory);
      setCurrentSessionMemoryState(normalizedMemory);

      // Process emergency detection - prioritize memory emergency flags
      const hasEmergencyFlags =
        normalizedMemory && normalizedMemory.emergencyFlags.length > 0;
      setEmergencyDetectedState(
        hasEmergencyFlags || response.emergency_detected || false
      );

      // Process care level
      const validCareLevels = ['emergency', 'urgent', 'primary', 'self_care'];
      if (
        response.care_level &&
        validCareLevels.includes(response.care_level)
      ) {
        setCurrentCareLevelState(response.care_level);
      } else {
        setCurrentCareLevelState(null);
      }

      // Trigger emergency callback if needed
      if (
        emergencyCallback &&
        (hasEmergencyFlags || response.emergency_detected)
      ) {
        emergencyCallback({
          emergencyDetected: hasEmergencyFlags || response.emergency_detected,
          emergencyFlags: normalizedMemory?.emergencyFlags || [],
          careLevel: response.care_level || 'emergency',
        });
      }
    },
    [
      validateStatefulResponse,
      validateReasoningObject,
      normalizeMemoryObject,
      emergencyCallback,
    ]
  );

  /**
   * Enhance message with reasoning and memory
   */
  const enhanceMessage = useCallback(
    (
      message: any,
      reasoning: ReasoningState,
      memory: SessionMemory
    ): EnhancedMessage => {
      const enhancedMessage: EnhancedMessage = {
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
      };

      // Add reasoning if provided
      if (reasoning && validateReasoningObject(reasoning)) {
        enhancedMessage.reasoning = reasoning;
      }

      // Add memory if provided
      if (memory && validateMemoryObject(memory)) {
        enhancedMessage.memory = memory;
      }

      // Add care level and emergency detection
      if (memory && memory.emergencyFlags.length > 0) {
        enhancedMessage.emergencyDetected = true;
        enhancedMessage.careLevel = currentCareLevel || 'emergency';
      }

      return enhancedMessage;
    },
    [validateReasoningObject, validateMemoryObject, currentCareLevel]
  );

  /**
   * Update messages array
   */
  const updateMessages = useCallback((newMessages: EnhancedMessage[]) => {
    setMessages(newMessages);
  }, []);

  /**
   * Update session memory
   */
  const updateSessionMemory = useCallback(
    (memory: SessionMemory) => {
      const normalizedMemory = normalizeMemoryObject(memory);
      setCurrentSessionMemoryState(normalizedMemory);

      // Update emergency detection based on memory
      if (normalizedMemory && normalizedMemory.emergencyFlags.length > 0) {
        setEmergencyDetectedState(true);
      } else if (
        normalizedMemory &&
        normalizedMemory.emergencyFlags.length === 0
      ) {
        setEmergencyDetectedState(false);
      }
    },
    [normalizeMemoryObject]
  );

  /**
   * Update reasoning
   */
  const updateReasoning = useCallback(
    (reasoning: ReasoningState) => {
      if (reasoning && validateReasoningObject(reasoning)) {
        setCurrentReasoningState(reasoning);
      } else {
        setCurrentReasoningState(null);
      }
    },
    [validateReasoningObject]
  );

  /**
   * Update care level
   */
  const updateCareLevel = useCallback((level: CareLevel) => {
    const validCareLevels = ['emergency', 'urgent', 'primary', 'self_care'];
    if (level && validCareLevels.includes(level)) {
      setCurrentCareLevelState(level);
    } else {
      setCurrentCareLevelState(null);
    }
  }, []);

  /**
   * Set emergency detection state
   */
  const setEmergencyDetected = useCallback((detected: boolean) => {
    setEmergencyDetectedState(detected);
  }, []);

  /**
   * Set current session memory
   */
  const setCurrentSessionMemory = useCallback((memory: SessionMemory) => {
    setCurrentSessionMemoryState(memory);
  }, []);

  /**
   * Set current reasoning
   */
  const setCurrentReasoning = useCallback((reasoning: ReasoningState) => {
    setCurrentReasoningState(reasoning);
  }, []);

  /**
   * Set current care level
   */
  const setCurrentCareLevel = useCallback((level: CareLevel) => {
    setCurrentCareLevelState(level);
  }, []);

  /**
   * Get current session memory
   */
  const getCurrentSessionMemory = useCallback((): SessionMemory => {
    return currentSessionMemory;
  }, [currentSessionMemory]);

  /**
   * Get current reasoning
   */
  const getCurrentReasoning = useCallback((): ReasoningState => {
    return currentReasoning;
  }, [currentReasoning]);

  /**
   * Check if emergency is detected
   */
  const isEmergencyDetected = useCallback((): boolean => {
    return emergencyDetected;
  }, [emergencyDetected]);

  /**
   * Get progressive disclosure data
   */
  const getProgressiveDisclosureData = useCallback(() => {
    return {
      reasoning: currentReasoning,
      memory: currentSessionMemory,
      emergencyDetected: emergencyDetected,
      careLevel: currentCareLevel,
    };
  }, [
    currentReasoning,
    currentSessionMemory,
    emergencyDetected,
    currentCareLevel,
  ]);

  /**
   * Get message context for API
   */
  const getMessageContextForApi = useCallback(() => {
    return {
      recentExchanges: messages.slice(-6).map((msg) => ({
        userMessage: msg.role === 'user' ? msg.content : '',
        assistantReasoning: msg.reasoning || null,
        assistantMemory: msg.memory || null,
        assistantMessage: msg.role === 'assistant' ? msg.content : '',
        timestamp: msg.timestamp.toISOString(),
      })),
      currentMemory: currentSessionMemory,
    };
  }, [messages, currentSessionMemory]);

  /**
   * Initialize state
   */
  const initializeState = useCallback(() => {
    setMessages([]);
    setCurrentSessionMemoryState(null);
    setCurrentReasoningState(null);
    setCurrentCareLevelState(null);
    setEmergencyDetectedState(false);
    setEmergencyCallbackState(null);
  }, []);

  /**
   * Clear all state
   */
  const clearAllState = useCallback(() => {
    setMessages([]);
    setCurrentSessionMemoryState(null);
    setCurrentReasoningState(null);
    setCurrentCareLevelState(null);
    setEmergencyDetectedState(false);
  }, []);

  /**
   * Clear session memory only
   */
  const clearSessionMemory = useCallback(() => {
    setCurrentSessionMemoryState(null);
    setEmergencyDetectedState(false);
  }, []);

  /**
   * Cleanup on unmount
   */
  const cleanup = useCallback(() => {
    setMessages([]);
    setCurrentSessionMemoryState(null);
    setCurrentReasoningState(null);
    setCurrentCareLevelState(null);
    setEmergencyDetectedState(false);
    setEmergencyCallbackState(null);
  }, []);

  /**
   * Save to localStorage
   */
  const saveToLocalStorage = useCallback(() => {
    try {
      if (currentSessionMemory) {
        localStorage.setItem(
          'triage-session-memory',
          JSON.stringify(currentSessionMemory)
        );
      }
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }, [currentSessionMemory]);

  /**
   * Load from localStorage
   */
  const loadFromLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem('triage-session-memory');
      if (stored) {
        const parsedMemory = JSON.parse(stored);
        const normalizedMemory = normalizeMemoryObject(parsedMemory);
        if (normalizedMemory) {
          setCurrentSessionMemoryState(normalizedMemory);
          setEmergencyDetectedState(normalizedMemory.emergencyFlags.length > 0);
        }
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
    }
  }, [normalizeMemoryObject]);

  /**
   * Set emergency callback
   */
  const setEmergencyCallback = useCallback((callback: (data: any) => void) => {
    setEmergencyCallbackState(() => callback);
  }, []);

  /**
   * Handle API error
   */
  const handleApiError = useCallback((status: number, message: string) => {
    console.error('API Error:', status, message);
    // Keep state safe but don't clear existing data
    // This allows graceful degradation
  }, []);

  return {
    // State getters
    messages,
    currentSessionMemory,
    currentReasoning,
    currentCareLevel,
    emergencyDetected,

    // State setters
    updateMessages,
    setCurrentSessionMemory,
    setCurrentReasoning,
    setCurrentCareLevel,
    setEmergencyDetected,

    // Processing functions
    processStatefulResponse,
    enhanceMessage,

    // State management
    updateSessionMemory,
    updateReasoning,
    updateCareLevel,

    // Validation functions
    validateStatefulResponse,
    validateMemoryObject,
    validateReasoningObject,
    validateStateConsistency,

    // Utility functions
    getCurrentSessionMemory,
    getCurrentReasoning,
    isEmergencyDetected,
    getProgressiveDisclosureData,
    getMessageContextForApi,

    // Lifecycle functions
    initializeState,
    clearAllState,
    clearSessionMemory,
    cleanup,

    // Persistence functions
    saveToLocalStorage,
    loadFromLocalStorage,

    // Integration functions
    setEmergencyCallback,
    handleApiError,
  };
}

export default useComponentStateStorage;
