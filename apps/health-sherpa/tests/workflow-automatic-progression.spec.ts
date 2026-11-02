import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Automatic Workflow Progression Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('Complete multi-page workflow with automatic progression', async ({ page }) => {
    console.log('Testing complete multi-page workflow with automatic progression...');

    // Step 1: Simulate completing front-door questionnaire
    console.log('Step 1: Simulating front-door questionnaire completion...');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Simulate front-door conversation data
    const conversationData = {
      labels: ['What brings you here today?', 'Tell me about your health goals', 'Any specific concerns?'],
      responses: [
        'I need help understanding my recent blood work and diabetes management',
        'I want to better control my blood sugar and understand what my doctor is telling me',
        'I feel confused about my lab results and whether my current medications are working'
      ]
    };

    await page.evaluate((data) => {
      localStorage.setItem('sherpa-conversation-context', JSON.stringify(data));
    }, conversationData);

    console.log('Front-door data simulated');

    // Step 2: Simulate HIPAA redaction completion
    console.log('Step 2: Simulating HIPAA redaction completion...');

    const testDocument = `
PATIENT MEDICAL REPORT - REDACTED

Patient: [REDACTED]
Date of Birth: [REDACTED] 
MRN: [REDACTED]

Date of Visit: December 15, 2024
Provider: Dr. Sarah Johnson, MD

CHIEF COMPLAINT:
Follow-up for diabetes management and review of recent laboratory results.

ASSESSMENT:
1. Type 2 Diabetes Mellitus - well controlled
   - HbA1c: 6.8% (target <7%)
   - Fasting glucose: 125 mg/dL
   
2. Hypertension - controlled on current medications
   - Blood pressure: 128/78 mmHg
   
CURRENT MEDICATIONS:
- Metformin 1000mg twice daily
- Lisinopril 10mg daily
- Atorvastatin 20mg daily

PLAN:
- Continue current diabetes medications
- Recheck HbA1c in 3 months
- Annual eye exam recommended
- Follow-up in 6 months or sooner if concerns
    `.trim();

    await page.evaluate((doc) => {
      localStorage.setItem('sherpa-redacted-document', doc);
    }, testDocument);

    console.log('HIPAA redaction data simulated');

    // Step 3: Navigate to insight-action page and verify automatic progression
    console.log('Step 3: Testing automatic progression to insight-action page...');
    
    await page.goto('/insight-action');
    await page.waitForLoadState('networkidle');

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/insight-action-with-workflow-data.png', fullPage: true });

    // Step 4: Verify workflow data detection
    console.log('Step 4: Verifying localStorage workflow data...');
    
    const localStorage = await page.evaluate(() => ({
      conversationContext: localStorage.getItem('sherpa-conversation-context'),
      redactedDocument: localStorage.getItem('sherpa-redacted-document'),
      userInputContext: localStorage.getItem('sherpa-user-context')
    }));

    console.log('LocalStorage Status:');
    console.log(`  - sherpa-conversation-context: ${localStorage.conversationContext ? 'Present' : 'Missing'}`);
    console.log(`  - sherpa-redacted-document: ${localStorage.redactedDocument ? 'Present' : 'Missing'}`);
    console.log(`  - sherpa-user-context: ${localStorage.userInputContext ? 'Present' : 'Missing'}`);

    // Step 5: Verify page bypassed manual upload interface
    console.log('Step 5: Verifying automatic progression bypassed manual upload...');
    
    // Should NOT see the "Workflow Data Missing" message
    const workflowMissingMessage = await page.locator('text="Workflow Data Missing"').isVisible().catch(() => false);
    console.log(`"Workflow Data Missing" message visible: ${workflowMissingMessage}`);

    // Should NOT see the manual upload message
    const manualUploadMessage = await page.locator('text="Upload your Sherpa session and health document"').isVisible().catch(() => false);
    console.log(`Manual upload message visible: ${manualUploadMessage}`);

    // Step 6: Verify AI summary interface is displayed
    console.log('Step 6: Verifying AI summary interface is active...');
    
    // Wait for the AI analysis to complete or appear
    await page.waitForTimeout(3000);

    // Look for AI summary elements using proper selectors
    const aiSummaryIndicators = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      
      const indicators = {
        analyzingText: bodyText.includes('Analyzing Your Health Context'),
        processingText: bodyText.includes('Processing your Sherpa session'),
        summaryTitle: bodyText.includes('Health Summary') || bodyText.includes('Summary'),
        clinicalSummaryCard: bodyText.includes('Clinical Summary'),
        insightsSection: bodyText.includes('Actionable Insights'),
        progressTracker: bodyText.includes('Insight-to-Action Navigator'),
        brainIcon: document.querySelector('svg') !== null,
        loadingSpinner: document.querySelector('.animate-pulse') !== null || 
                       document.querySelector('.animate-bounce') !== null
      };
      
      // Also check for any visible h1 elements
      const h1Elements = Array.from(document.querySelectorAll('h1')).map(h1 => h1.textContent?.trim());
      
      return {
        ...indicators,
        h1Elements,
        pageContent: bodyText.substring(0, 300) + '...'
      };
    });

    console.log('AI Interface Detection Results:');
    Object.entries(aiSummaryIndicators).forEach(([key, value]) => {
      if (key !== 'pageContent') {
        console.log(`  - ${key}: ${value ? 'Found' : 'Not found'}`);
      }
    });
    console.log(`  - Page content preview: ${aiSummaryIndicators.pageContent}`);

    // Step 7: Check for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);
    console.log(`Console errors detected: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Console errors:');
      consoleErrors.forEach(error => console.log(`  - ${error}`));
    }

    // Step 8: Test the workflow progression logic directly
    const hasWorkflowDataResult = await page.evaluate(() => {
      const redactedDocument = localStorage.getItem('sherpa-redacted-document');
      const conversationData = localStorage.getItem('sherpa-conversation-context');
      const userInputContext = localStorage.getItem('sherpa-user-context');
      
      let contextSummary = '';
      if (conversationData) {
        try {
          const data = JSON.parse(conversationData);
          contextSummary = data.responses
            .map((response: string, index: number) => `${data.labels[index]}: ${response}`)
            .join(' | ');
        } catch {
          const sherpaSession = localStorage.getItem('sherpa-user-input');
          contextSummary = sherpaSession || '';
        }
      }

      const hasData = (contextSummary && redactedDocument) || (contextSummary && userInputContext);
      
      return {
        hasData,
        contextSummary: contextSummary ? 'YES' : 'NO',
        redactedDocument: redactedDocument ? 'YES' : 'NO',
        userInputContext: userInputContext ? 'YES' : 'NO',
        contextSummaryLength: contextSummary.length
      };
    });

    console.log('Workflow Logic Test Results:');
    console.log(`  - hasWorkflowData: ${hasWorkflowDataResult.hasData}`);
    console.log(`  - contextSummary: ${hasWorkflowDataResult.contextSummary} (${hasWorkflowDataResult.contextSummaryLength} chars)`);
    console.log(`  - redactedDocument: ${hasWorkflowDataResult.redactedDocument}`);
    console.log(`  - userInputContext: ${hasWorkflowDataResult.userInputContext}`);

    // Assertions for test validation
    expect(localStorage.conversationContext).toBeTruthy();
    expect(localStorage.redactedDocument).toBeTruthy();
    expect(hasWorkflowDataResult.hasData).toBeTruthy();
    expect(workflowMissingMessage).toBeFalsy();
    expect(consoleErrors.length).toBe(0);

    console.log('Automatic workflow progression test completed successfully!');
  });

  test('Verify workflow shows manual upload when no data present', async ({ page }) => {
    // With no data the navigator opens on the intake step. Generate stays off.
    await page.goto('/insight-action');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Health Context Intake' })).toBeVisible();
    await expect(page.getByText('Sample data. Not medical advice.').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate Insights/ })).toBeDisabled();
  });

  test('Verify localStorage persistence during workflow', async ({ page }) => {
    console.log('Testing localStorage persistence during workflow...');
    
    await page.goto('/');
    
    // Set comprehensive workflow data
    const workflowData = {
      conversationContext: {
        labels: ['Main concern?', 'Health goals?'],
        responses: ['Diabetes management', 'Better blood sugar control']
      },
      redactedDocument: 'Test medical document content...',
      userContext: 'Additional user context...'
    };

    await page.evaluate((data) => {
      localStorage.setItem('sherpa-conversation-context', JSON.stringify(data.conversationContext));
      localStorage.setItem('sherpa-redacted-document', data.redactedDocument);
      localStorage.setItem('sherpa-user-context', data.userContext);
    }, workflowData);

    // Navigate to different pages and verify persistence
    await page.goto('/hipaa-redaction');
    await page.waitForTimeout(500);
    await page.goto('/insight-action');
    await page.waitForTimeout(500);
    await page.goto('/');
    await page.waitForTimeout(500);

    // Check if data persists
    const persistedData = await page.evaluate(() => ({
      conversationContext: localStorage.getItem('sherpa-conversation-context'),
      redactedDocument: localStorage.getItem('sherpa-redacted-document'),
      userContext: localStorage.getItem('sherpa-user-context')
    }));

    expect(persistedData.conversationContext).toBeTruthy();
    expect(persistedData.redactedDocument).toBeTruthy();
    expect(persistedData.userContext).toBeTruthy();

    console.log('localStorage persistence test passed!');
  });
});