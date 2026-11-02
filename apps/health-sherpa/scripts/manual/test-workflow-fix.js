const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testCompleteWorkflow() {
  console.log('Testing complete workflow after automatic progression fix...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to front door and complete health questionnaire
    console.log('Step 1: Going to front door...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Wait for the front door to load and fill out some basic info
    console.log('Filling out health questionnaire...');
    
    // Input fields may be missing: the front door can be dynamic.
    await page.waitForTimeout(2000); // Give it time to load
    
    // Look for any input fields and fill them out
    const inputs = await page.locator('input[type="text"], textarea').all();
    console.log(`Found ${inputs.length} input fields`);
    
    if (inputs.length > 0) {
      // Fill out first few inputs with sample health data
      await inputs[0].fill('I have been experiencing recurring headaches and elevated blood pressure');
      if (inputs.length > 1) {
        await inputs[1].fill('Understanding my test results and managing daily symptoms');
      }
      if (inputs.length > 2) {
        await inputs[2].fill('Getting better at communicating with my healthcare team');
      }
    }
    
    // Try to find and click a submit or continue button
    const continueButton = page.locator('button:has-text("Continue"), button:has-text("Submit"), button:has-text("Next"), button:has-text("Start")').first();
    if (await continueButton.isVisible()) {
      await continueButton.click();
      console.log('Clicked continue button');
    }
    
    await page.waitForTimeout(1000);
    
    // Step 2: Navigate to HIPAA redaction
    console.log('Step 2: Going to HIPAA redaction tool...');
    await page.goto('http://localhost:3000/pii-redaction');
    await page.waitForLoadState('networkidle');
    
    // Create and upload a test medical document
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
    
    console.log('Uploading medical document...');
    
    // Find the file input or text area
    const fileInput = page.locator('input[type="file"]').first();
    const textArea = page.locator('textarea').first();
    
    if (await textArea.isVisible()) {
      console.log('Using textarea for document input');
      await textArea.fill(testDocument);
    } else if (await fileInput.isVisible()) {
      console.log('Using file input for document upload');
      // Create temporary file
      const tempFile = '/tmp/test-medical-doc.txt';
      fs.writeFileSync(tempFile, testDocument);
      await fileInput.setInputFiles(tempFile);
    }
    
    // Start PII analysis
    const analyzeButton = page.locator('button:has-text("Start PII Analysis"), button:has-text("Process")').first();
    if (await analyzeButton.isVisible()) {
      await analyzeButton.click();
      console.log('Started PII analysis');
      await page.waitForTimeout(3000); // Wait for analysis
    }
    
    // Continue to insights
    const continueToInsights = page.locator('button:has-text("Continue to Insights"), button:has-text("Proceed")').first();
    if (await continueToInsights.isVisible()) {
      await continueToInsights.click();
      console.log('Continuing to insights');
    }
    
    // Step 3: Verify automatic progression to insights page
    console.log('Step 3: Checking if we automatically skip to insights summary...');
    await page.waitForTimeout(3000); // Give it time to load and process
    
    // Check current URL and page content
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Signs of the insights page.
    const hasInsightContent = await page.locator('text=Health Summary, text=Clinical Summary, text=Insights, text=Brain').count() > 0;
    const hasUploadPrompt = await page.locator('text=Upload your Sherpa session and health document').count() > 0;
    
    console.log(`Page analysis:`);
    console.log(`  - Has insight content: ${hasInsightContent}`);
    console.log(`  - Still shows upload prompt: ${hasUploadPrompt}`);
    console.log(`  - URL contains insight-action: ${currentUrl.includes('insight-action')}`);
    
    // Log browser console for debugging
    page.on('console', msg => console.log(`Browser console: ${msg.text()}`));
    
    // Check localStorage data
    const localStorageData = await page.evaluate(() => {
      return {
        redactedDocument: localStorage.getItem('sherpa-redacted-document') ? 'YES' : 'NO',
        userContext: localStorage.getItem('sherpa-user-context') ? 'YES' : 'NO',
        conversationContext: localStorage.getItem('sherpa-conversation-context') ? 'YES' : 'NO',
        originalDocument: localStorage.getItem('sherpa-original-document') ? 'YES' : 'NO'
      };
    });
    
    console.log('LocalStorage status:', localStorageData);
    
    // Final verification
    if (hasInsightContent && !hasUploadPrompt) {
      console.log('SUCCESS: Automatic workflow progression is working!');
      console.log('   - Data flows from front-door → redaction → insights');
      console.log('   - No manual upload required on insights page');
      console.log('   - User sees AI summary directly');
    } else if (hasUploadPrompt) {
      console.log('ISSUE: Still showing upload prompt on insights page');
      console.log('   - Automatic progression is not working correctly');
      console.log('   - User still needs to manually upload files');
    } else {
      console.log('UNCLEAR: Page state is ambiguous');
      console.log('   - Need to investigate further');
    }
    
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testCompleteWorkflow();