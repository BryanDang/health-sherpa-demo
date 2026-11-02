// modules/state-manager.js - Optimized State Management
export class StateManager {
  constructor() {
    this.state = {
      currentStep: 0,
      userResponses: [],
      isProcessing: false,
      errors: new Map()
    };

    this.subscribers = new Set();
    this.stateHistory = [];
    this.maxHistorySize = 10; // Limit memory usage
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Optimized state updates
  setState(updates) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // Limit history size for memory optimization
    this.stateHistory.push(prevState);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    // Batch notifications using requestAnimationFrame
    if (!this.pendingNotification) {
      this.pendingNotification = requestAnimationFrame(() => {
        this.notifySubscribers();
        this.pendingNotification = null;
      });
    }
  }

  notifySubscribers() {
    for (const callback of this.subscribers) {
      try {
        callback(this.state);
      } catch (error) {
        console.error('State subscriber error:', error);
      }
    }
  }

  // Healthcare-specific methods
  addResponse(response) {
    this.setState({
      userResponses: [...this.state.userResponses, {
        id: Date.now(),
        content: response,
        timestamp: new Date().toISOString(),
        step: this.state.currentStep
      }]
    });
  }

  setError(field, message) {
    const newErrors = new Map(this.state.errors);
    if (message) {
      newErrors.set(field, message);
    } else {
      newErrors.delete(field);
    }
    this.setState({ errors: newErrors });
  }

  nextStep() {
    this.setState({ 
      currentStep: this.state.currentStep + 1,
      isProcessing: false 
    });
  }
}

export const stateManager = new StateManager();