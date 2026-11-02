// sherpa-app-optimized.js - Main Application Entry Point
import { domManager } from './modules/dom-manager.js';
import { stateManager } from './modules/state-manager.js';
import { animator } from './modules/animator.js';

class SherpaApp {
  constructor() {
    this.initialized = false;
    this.analyticsEndpoint = null; // Will be set based on environment

    // Bind methods to preserve context
    this.handleUserInput = this.handleUserInput.bind(this);
    this.handleStepProgress = this.handleStepProgress.bind(this);
  }

  async init() {
    if (this.initialized) return;

    try {
      // Initialize modules
      domManager.init();

      // Subscribe to state changes
      stateManager.subscribe(this.handleStateChange.bind(this));

      // Setup event listeners
      this.setupEventListeners();

      // Initialize UI
      await this.initializeUI();

      this.initialized = true;
      this.trackEvent('app_initialized');

    } catch (error) {
      console.error('Sherpa app initialization failed:', error);
      this.trackError('initialization_error', error);
    }
  }

  setupEventListeners() {
    // Use cached DOM elements
    const chatInput = domManager.get('#sherpa-chat-input');
    const submitBtn = domManager.get('#sherpa-submit-btn');

    if (chatInput) {
      chatInput.addEventListener('input', this.handleUserInput);
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSubmit();
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', this.handleSubmit.bind(this));
    }
  }

  async initializeUI() {
    const logoElement = domManager.get('.sherpa-logo__ring');
    if (logoElement && !animator.shouldReduceMotion) {
      await animator.animateLogoAnalyzing(logoElement);
    }
  }

  handleUserInput(event) {
    const value = event.target.value;

    // Debounced input tracking for analytics
    clearTimeout(this.inputTimer);
    this.inputTimer = setTimeout(() => {
      this.trackEvent('user_typing', {
        inputLength: value.length,
        step: stateManager.state.currentStep
      });
    }, 1000);
  }

  async handleSubmit() {
    const chatInput = domManager.get('#sherpa-chat-input');
    const submitBtn = domManager.get('#sherpa-submit-btn');

    if (!chatInput || !chatInput.value.trim()) return;

    const userMessage = chatInput.value.trim();

    try {
      // Update UI state
      stateManager.setState({ isProcessing: true });

      // Add user message
      await this.addMessage(userMessage, 'user');

      // Clear input
      chatInput.value = '';

      // Disable submit button during processing
      if (submitBtn) {
        submitBtn.disabled = true;
      }

      // Process the message
      await this.processUserMessage(userMessage);

      // Track successful interaction
      this.trackEvent('message_submitted', {
        messageLength: userMessage.length,
        step: stateManager.state.currentStep
      });

    } catch (error) {
      console.error('Error handling submit:', error);
      this.trackError('submit_error', error);
      stateManager.setError('submit', 'Something went wrong. Please try again.');
    } finally {
      stateManager.setState({ isProcessing: false });
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  }

  async addMessage(content, type) {
    const chatContainer = domManager.get('.sherpa-chat');
    if (!chatContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `sherpa-chat__message sherpa-chat__message--${type}`;
    messageElement.textContent = content;

    chatContainer.appendChild(messageElement);

    // Animate message entry if animations are enabled
    if (!animator.shouldReduceMotion) {
      await animator.animateMessageEntry(messageElement);
    }

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  async processUserMessage(message) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add AI response
    const response = this.generateAIResponse(message);
    await this.addMessage(response, 'ai');

    // Progress to next step
    stateManager.nextStep();
    stateManager.addResponse(message);
  }

  generateAIResponse(userMessage) {
    // Simplified response generation
    const responses = [
      "Thank you for sharing that. Can you tell me more about when this started?",
      "I understand. How has this been affecting your daily life?",
      "That's helpful information. Are there any other symptoms you've noticed?",
      "Based on what you've shared, I'd like to ask a few more questions to better understand your situation."
    ];

    const step = stateManager.state.currentStep;
    return responses[step % responses.length];
  }

  handleStateChange(newState) {
    // Update UI based on state changes
    this.updateProgressIndicator(newState.currentStep);
    this.updateErrorDisplay(newState.errors);
  }

  updateProgressIndicator(step) {
    const indicator = domManager.get('.sherpa-progress');
    if (indicator) {
      indicator.style.width = `${(step / 5) * 100}%`;
    }
  }

  updateErrorDisplay(errors) {
    for (const [field, message] of errors) {
      const errorElement = domManager.get(`#error-${field}`);
      if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = message ? 'block' : 'none';
      }
    }
  }

  // HIPAA-Compliant Analytics
  trackEvent(eventName, metadata = {}) {
    if (!this.analyticsEndpoint) return;

    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(),
      step: stateManager.state.currentStep,
      ...metadata
    };

    // Remove any potential PHI
    delete payload.userMessage;
    delete payload.personalInfo;

    // Send via beacon for reliability
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.analyticsEndpoint, JSON.stringify(payload));
    }
  }

  trackError(errorType, error) {
    this.trackEvent('error_occurred', {
      errorType,
      errorMessage: error.message,
      stack: error.stack?.substring(0, 200) // Truncate stack trace
    });
  }

  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = `sherpa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.sessionId;
  }

  // Cleanup on page unload
  destroy() {
    animator.stopAll();
    domManager.destroy();

    this.trackEvent('session_ended', {
      duration: Date.now() - this.sessionStart,
      stepsCompleted: stateManager.state.currentStep
    });
  }
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.sherpaApp = new SherpaApp();
    window.sherpaApp.init();
  });
} else {
  window.sherpaApp = new SherpaApp();
  window.sherpaApp.init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.sherpaApp) {
    window.sherpaApp.destroy();
  }
});

export default SherpaApp;