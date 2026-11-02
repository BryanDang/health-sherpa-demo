// Sherpa AI Healthcare Application
// Simplified JavaScript with core functionality

document.addEventListener('DOMContentLoaded', function() {
  // Health questions data
  const healthQuestions = [
    {
      id: 1,
      question: "What's been on your mind about your health lately?",
      type: "textarea",
      placeholder: "Share any health concerns, symptoms, or questions you've been thinking about..."
    },
    {
      id: 2,
      question: "How would you rate your overall energy levels?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "Good", "Excellent"]
    },
    {
      id: 3,
      question: "Are you currently taking any medications?",
      type: "radio",
      options: ["Yes", "No", "Prefer not to say"]
    },
    {
      id: 4,
      question: "What health goals are most important to you?",
      type: "checkbox",
      options: ["Better sleep", "Weight management", "Stress reduction", "More energy", "Preventive care", "Managing chronic conditions"]
    }
  ];

  // Application state
  const state = {
    currentStep: 0,
    totalSteps: healthQuestions.length + 1, // +1 for welcome
    currentScreen: 'welcome',
    answers: {},
    isProcessing: false
  };

  // DOM cache for frequently accessed elements
  const elements = {
    app: document.getElementById('sherpa-app'),
    logoRing: document.getElementById('sherpa-logo-ring'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    welcomeScreen: document.getElementById('welcome-screen'),
    questionScreen: document.getElementById('question-screen'),
    processingScreen: document.getElementById('processing-screen'),
    completionScreen: document.getElementById('completion-screen'),
    startButton: document.getElementById('start-assessment'),
    currentQuestion: document.getElementById('current-question'),
    prevButton: document.getElementById('prev-question'),
    nextButton: document.getElementById('next-question'),
    processingRing: document.getElementById('processing-ring'),
    processingText: document.getElementById('processing-text'),
    errorDisplay: document.getElementById('error-display'),
    errorMessage: document.getElementById('error-message'),
    errorClose: document.getElementById('error-close'),
    viewResultsButton: document.getElementById('view-results'),
    restartButton: document.getElementById('restart-assessment')
  };

  // Initialize application
  function init() {
    setupEventListeners();
    updateProgress();
    logEvent('app_initialized');
  }

  // Set up event listeners
  function setupEventListeners() {
    // Start assessment button
    elements.startButton.addEventListener('click', startAssessment);

    // Navigation buttons
    elements.prevButton.addEventListener('click', previousQuestion);
    elements.nextButton.addEventListener('click', nextQuestion);

    // Completion buttons
    elements.viewResultsButton.addEventListener('click', viewResults);
    elements.restartButton.addEventListener('click', restartAssessment);

    // Error close button
    elements.errorClose.addEventListener('click', hideError);
  }

  // Screen management
  function switchScreen(newScreen) {
    // Hide all screens
    [elements.welcomeScreen, elements.questionScreen, elements.processingScreen, elements.completionScreen].forEach(screen => {
      screen.classList.remove('sherpa-screen--active');
    });

    // Show the new screen
    switch (newScreen) {
      case 'welcome':
        elements.welcomeScreen.classList.add('sherpa-screen--active');
        break;
      case 'question':
        elements.questionScreen.classList.add('sherpa-screen--active');
        break;
      case 'processing':
        elements.processingScreen.classList.add('sherpa-screen--active');
        startProcessing();
        break;
      case 'completion':
        elements.completionScreen.classList.add('sherpa-screen--active');
        break;
    }

    // Update state
    state.currentScreen = newScreen;
    logEvent('screen_changed', { screen: newScreen });
  }

  // Start the assessment
  function startAssessment() {
    state.currentStep = 1;
    updateProgress();
    renderCurrentQuestion();
    switchScreen('question');
    logEvent('assessment_started');
  }

  // Render the current question
  function renderCurrentQuestion() {
    const currentQuestionIndex = state.currentStep - 1;
    const question = healthQuestions[currentQuestionIndex];
    
    if (!question) return;

    let html = `<h2 class="sherpa-question__title">${question.question}</h2>`;

    switch (question.type) {
      case 'textarea':
        html += `
          <textarea 
            class="sherpa-question__input form-control" 
            id="question-${question.id}"
            placeholder="${question.placeholder}"
            rows="5"
            aria-label="${question.question}"
          ></textarea>
        `;
        break;

      case 'scale':
      case 'radio':
        html += '<div class="sherpa-question__options">';
        question.options.forEach((option, index) => {
          html += `
            <label class="sherpa-question__option">
              <input 
                type="radio" 
                name="question-${question.id}" 
                value="${option}"
                id="q${question.id}-opt${index}"
              />
              <span>${option}</span>
            </label>
          `;
        });
        html += '</div>';
        break;

      case 'checkbox':
        html += '<div class="sherpa-question__options">';
        question.options.forEach((option, index) => {
          html += `
            <label class="sherpa-question__option">
              <input 
                type="checkbox" 
                name="question-${question.id}" 
                value="${option}"
                id="q${question.id}-opt${index}"
              />
              <span>${option}</span>
            </label>
          `;
        });
        html += '</div>';
        break;
    }

    elements.currentQuestion.innerHTML = html;

    // Set up input event listeners
    setupQuestionListeners(question);

    // Restore previous answer if exists
    restoreAnswer(question);

    // Update navigation buttons
    updateNavigationButtons();
    
    logEvent('question_viewed', { questionId: question.id });
  }

  // Set up question-specific event listeners
  function setupQuestionListeners(question) {
    const inputs = elements.currentQuestion.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
      if (input.type === 'text' || input.type === 'textarea') {
        input.addEventListener('input', () => {
          saveAnswer(question);
          updateNavigationButtons();
        });
      } else {
        input.addEventListener('change', () => {
          saveAnswer(question);
          updateNavigationButtons();
        });
      }
    });
  }

  // Save answer for current question
  function saveAnswer(question) {
    let answer;
    
    switch (question.type) {
      case 'textarea':
        const textarea = document.getElementById(`question-${question.id}`);
        answer = textarea ? textarea.value : '';
        break;

      case 'scale':
      case 'radio':
        const radioInput = document.querySelector(`input[name="question-${question.id}"]:checked`);
        answer = radioInput ? radioInput.value : null;
        break;

      case 'checkbox':
        const checkboxes = document.querySelectorAll(`input[name="question-${question.id}"]:checked`);
        answer = Array.from(checkboxes).map(cb => cb.value);
        break;
    }

    state.answers[question.id] = answer;
    logEvent('question_answered', { questionId: question.id });
  }

  // Restore previously saved answer
  function restoreAnswer(question) {
    const savedAnswer = state.answers[question.id];
    if (!savedAnswer) return;

    switch (question.type) {
      case 'textarea':
        const textarea = document.getElementById(`question-${question.id}`);
        if (textarea) textarea.value = savedAnswer;
        break;

      case 'scale':
      case 'radio':
        const radioInput = document.querySelector(`input[name="question-${question.id}"][value="${savedAnswer}"]`);
        if (radioInput) radioInput.checked = true;
        break;

      case 'checkbox':
        if (Array.isArray(savedAnswer)) {
          savedAnswer.forEach(value => {
            const checkbox = document.querySelector(`input[name="question-${question.id}"][value="${value}"]`);
            if (checkbox) checkbox.checked = true;
          });
        }
        break;
    }
  }

  // Go to previous question
  function previousQuestion() {
    if (state.currentStep > 1) {
      state.currentStep--;
      updateProgress();
      renderCurrentQuestion();
    }
  }

  // Go to next question
  function nextQuestion() {
    if (!canProceed()) {
      showError('Please answer the current question before proceeding.');
      return;
    }

    if (state.currentStep < healthQuestions.length) {
      state.currentStep++;
      updateProgress();
      renderCurrentQuestion();
    } else {
      // All questions answered, go to processing
      state.currentStep++;
      updateProgress();
      switchScreen('processing');
    }
  }

  // Check if user can proceed to next question
  function canProceed() {
    const currentQuestionIndex = state.currentStep - 1;
    const question = healthQuestions[currentQuestionIndex];
    if (!question) return true;
    
    const answer = state.answers[question.id];
    
    if (question.type === 'textarea') {
      return answer && answer.trim() !== '';
    } else if (question.type === 'checkbox') {
      return Array.isArray(answer) && answer.length > 0;
    } else {
      return answer !== undefined && answer !== null;
    }
  }

  // Update progress bar and text
  function updateProgress() {
    const progress = (state.currentStep / state.totalSteps) * 100;
    elements.progressFill.style.width = `${progress}%`;
    elements.progressText.textContent = `Step ${state.currentStep} of ${state.totalSteps}`;
  }

  // Update navigation buttons state
  function updateNavigationButtons() {
    elements.prevButton.disabled = state.currentStep <= 1;
    elements.nextButton.disabled = !canProceed();
    elements.nextButton.textContent = state.currentStep >= healthQuestions.length ? 'Complete Assessment' : 'Next Question';
  }

  // Process user responses
  function startProcessing() {
    const steps = [
      { element: document.getElementById('step-encrypt'), text: 'Encrypting your data securely...' },
      { element: document.getElementById('step-analyze'), text: 'Analyzing your responses...' },
      { element: document.getElementById('step-generate'), text: 'Generating personalized insights...' }
    ];

    // Reset step status
    steps.forEach(step => {
      if (step.element && step.element !== steps[0].element) {
        step.element.classList.remove('sherpa-processing__step--active');
      }
    });

    let currentStep = 1; // Start with step 1 since step 0 is already active

    const processNextStep = () => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        
        if (elements.processingText) {
          elements.processingText.textContent = step.text;
        }
        
        if (step.element) {
          step.element.classList.add('sherpa-processing__step--active');
        }
        
        currentStep++;
        setTimeout(processNextStep, 2000);
      } else {
        // All processing steps complete
        setTimeout(completeAssessment, 1000);
      }
    };

    // Start processing after a short delay
    setTimeout(processNextStep, 2000);
  }

  // Complete the assessment
  function completeAssessment() {
    switchScreen('completion');
    logEvent('assessment_completed');
  }

  // View results action
  function viewResults() {
    alert('Thank you! In a full implementation, this would show your personalized health insights.');
    logEvent('results_viewed');
  }

  // Restart assessment
  function restartAssessment() {
    state.currentStep = 0;
    state.answers = {};
    updateProgress();
    switchScreen('welcome');
    logEvent('assessment_restarted');
  }

  // Show error message
  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorDisplay.style.display = 'block';
    elements.errorDisplay.classList.add('sherpa-error--visible');
    
    // Auto-hide after 5 seconds
    setTimeout(hideError, 5000);
  }

  // Hide error message
  function hideError() {
    elements.errorDisplay.classList.remove('sherpa-error--visible');
    setTimeout(() => {
      elements.errorDisplay.style.display = 'none';
    }, 300);
  }

  // Log events for analytics
  function logEvent(eventName, data = {}) {
    const event = {
      name: eventName,
      timestamp: new Date().toISOString(),
      data: data
    };
    
    console.log('Event:', event);
    
    // In a real application, this would send data to an analytics service
    if (window.sherpaAnalytics) {
      window.sherpaAnalytics.events.push(event);
    }
  }

  // Track web vitals
  function trackWebVitals() {
    if ('PerformanceObserver' in window) {
      try {
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          logEvent('web_vital', { 
            name: 'LCP', 
            value: lastEntry.startTime,
            target: state.performanceTargets?.LCP || '< 1.2s'
          });
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // FID (First Input Delay)
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry) => {
            logEvent('web_vital', { 
              name: 'FID', 
              value: entry.processingStart - entry.startTime,
              target: state.performanceTargets?.FID || '< 100ms'
            });
          });
        }).observe({ entryTypes: ['first-input'] });

        // CLS (Cumulative Layout Shift)
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach((entry) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              logEvent('web_vital', { 
                name: 'CLS', 
                value: clsValue,
                target: state.performanceTargets?.CLS || '< 0.1'
              });
            }
          });
        }).observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.error('Error setting up performance observers:', e);
      }
    }
  }

  // Initialize the application
  init();
  trackWebVitals();
});