const { chromium } = require('playwright');
const fs = require('fs');

async function debugWorkflow() {
  console.log('Debugging workflow step by step...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Log all console messages
  page.on('console', msg => console.log(`${msg.type()}: ${msg.text()}`));
  
  try {
    // Step 1: Set up sample front door data directly in localStorage
    console.log('Step 1: Setting up front door data in localStorage...');
    await page.goto('http://localhost:3000');
    
    await page.evaluate(() => {
      const conversationData = {
        labels: ['Primary Concern', 'Health Goals', 'Communication Style'],
        responses: [
          'I have been experiencing recurring headaches and elevated blood pressure',
          'Understanding my test results and managing daily symptoms',
          'I prefer clear, simple explanations with actionable steps'
        ]
      };
      localStorage.setItem('sherpa-conversation-context', JSON.stringify(conversationData));
      console.log('Front door data set in localStorage');
    });
    
    // Step 2: Navigate to HIPAA redaction and complete the workflow
    console.log('Step 2: Going to HIPAA redaction...');
    await page.goto('http://localhost:3000/pii-redaction');
    await page.waitForLoadState('networkidle');
    
    const testDocument = `Patient: John Smith
DOB: 01/15/1980
MRN: 123456789
Phone: (555) 123-4567
Email: john.smith@email.com
Address: 123 Main Street, Anytown, NY 12345

MEDICAL REPORT - Date: March 15, 2024

Chief Complaint: Recurring headaches for 3 months

History: The patient is a 44-year-old male presenting with bilateral throbbing headaches occurring 2-3 times weekly, associated with mild nausea.

Assessment: Possible tension headaches related to elevated blood pressure (145/90 mmHg).

Plan: Increase antihypertensive medication, follow-up in 4 weeks.

Provider: Dr. Sarah Johnson, MD
License: MD456789
Phone: (555) 987-6543`;
    
    console.log('Filling textarea with medical document...');
    const textArea = page.locator('textarea').first();
    await textArea.fill(testDocument);
    
    console.log('Looking for process button...');
    await page.screenshot({ path: '/tmp/before-process.png' });
    
    // Find and click the process button
    const processButton = page.locator('button:has-text("Start PII Analysis"), button:has-text("Process Document")').first();
    await processButton.click();
    console.log('Clicked process button');
    
    // Wait for processing to complete
    console.log('⏳ Waiting for PII analysis to complete...');
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: '/tmp/after-process.png' });
    
    // Look for continue button
    console.log('Looking for continue to insights button...');
    const continueButton = page.locator('button:has-text("Continue to Insights"), button:has-text("Proceed")').first();
    
    if (await continueButton.isVisible()) {
      await continueButton.click();
      console.log('Clicked continue to insights');
      
      // Wait for navigation
      await page.waitForTimeout(3000);
      
      // Step 3: Check the insights page
      console.log('Step 3: Analyzing insights page...');
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
      
      await page.screenshot({ path: '/tmp/insights-page.png' });
      
      // Check localStorage
      const localStorage = await page.evaluate(() => {
        return {
          redactedDocument: localStorage.getItem('sherpa-redacted-document'),
          userContext: localStorage.getItem('sherpa-user-context'),
          conversationContext: localStorage.getItem('sherpa-conversation-context'),
          originalDocument: localStorage.getItem('sherpa-original-document')
        };
      });
      
      console.log('LocalStorage contents:');
      Object.entries(localStorage).forEach(([key, value]) => {
        console.log(`  ${key}: ${value ? value.substring(0, 50) + '...' : 'NULL'}`);
      });
      
      // Check page content
      const pageContent = await page.locator('body').textContent();
      const hasUploadPrompt = pageContent.includes('Upload your Sherpa session and health document');
      const hasInsightContent = pageContent.includes('Health Summary') || pageContent.includes('Clinical Summary') || pageContent.includes('Analyzing Your Health Context');
      const isLoading = pageContent.includes('Loading') || pageContent.includes('Processing');
      
      console.log('Page content analysis:');
      console.log(`  - Has upload prompt: ${hasUploadPrompt}`);
      console.log(`  - Has insight content: ${hasInsightContent}`);
      console.log(`  - Is loading: ${isLoading}`);
      
      if (hasInsightContent && !hasUploadPrompt) {
        console.log('SUCCESS: Fix is working! Automatic progression successful.');
      } else if (hasUploadPrompt) {
        console.log('ISSUE: Still seeing upload prompt - fix needs more work.');
      } else if (isLoading) {
        console.log('⏳ LOADING: Page is still processing - let\'s wait longer...');
        await page.waitForTimeout(5000);
        
        // Recheck after waiting
        const newContent = await page.locator('body').textContent();
        const stillUpload = newContent.includes('Upload your Sherpa session and health document');
        const nowInsight = newContent.includes('Health Summary') || newContent.includes('Clinical Summary');
        
        if (nowInsight && !stillUpload) {
          console.log('SUCCESS: After loading, automatic progression worked!');
        } else {
          console.log('ISSUE: Even after loading, still showing upload prompt.');
        }
      }
      
    } else {
      console.log('Could not find continue to insights button');
    }
    
    console.log('Screenshots saved to /tmp/ for debugging');
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('Debug failed:', error.message);
    await page.screenshot({ path: '/tmp/error-state.png' });
  } finally {
    await browser.close();
  }
}

debugWorkflow();