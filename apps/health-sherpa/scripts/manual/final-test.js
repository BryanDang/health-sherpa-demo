const { chromium } = require('playwright');

async function finalWorkflowTest() {
  console.log('Final test of automatic workflow progression...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Log browser console
  page.on('console', msg => console.log(`${msg.type()}: ${msg.text()}`));
  
  try {
    // Step 1: Set up conversation context (front door data)
    console.log('Step 1: Setting up conversation context...');
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
      console.log('Front door conversation data set');
    });
    
    // Step 2: Go to HIPAA redaction and process document
    console.log('Step 2: Processing document through HIPAA redaction...');
    await page.goto('http://localhost:3000/pii-redaction');
    await page.waitForLoadState('networkidle');
    
    const testDocument = `Patient: John Smith
DOB: 01/15/1980
MRN: 123456789
Phone: (555) 123-4567
Email: john.smith@email.com

MEDICAL REPORT - Date: March 15, 2024

Chief Complaint: Recurring headaches for 3 months
History: 44-year-old male with bilateral throbbing headaches 2-3 times weekly.
Assessment: Possible tension headaches related to elevated blood pressure (145/90 mmHg).
Plan: Increase antihypertensive medication, follow-up in 4 weeks.

Provider: Dr. Sarah Johnson, MD`;
    
    // Fill the textarea
    await page.locator('textarea').fill(testDocument);
    console.log('Document filled in textarea');
    
    // Click the PII analysis button
    await page.locator('button:has-text("Identify PII & Get AI Validation")').click();
    console.log('Clicked PII analysis button');
    
    // Wait for processing
    await page.waitForTimeout(8000);
    console.log('⏳ Waited for PII processing...');
    
    // On the review screen: click continue.
    const continueButton = page.locator('button:has-text("Continue to Insights")');
    if (await continueButton.isVisible()) {
      await continueButton.click();
      console.log('Clicked Continue to Insights');
    } else {
      console.log('Continue to Insights button not found');
      // Take screenshot for debugging
      await page.screenshot({ path: '/tmp/no-continue-button.png' });
    }
    
    // Step 3: Check insights page for automatic progression
    console.log('Step 3: Checking insights page behavior...');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Check localStorage data
    const storageData = await page.evaluate(() => {
      return {
        redactedDocument: localStorage.getItem('sherpa-redacted-document') ? 'YES' : 'NO',
        userContext: localStorage.getItem('sherpa-user-context') ? 'YES' : 'NO',
        conversationContext: localStorage.getItem('sherpa-conversation-context') ? 'YES' : 'NO',
        originalDocument: localStorage.getItem('sherpa-original-document') ? 'YES' : 'NO'
      };
    });
    
    console.log('LocalStorage check:', storageData);
    
    // Check page content
    const bodyText = await page.locator('body').textContent();
    const showsUpload = bodyText.includes('Upload your Sherpa session and health document');
    const showsInsights = bodyText.includes('Health Summary') || bodyText.includes('Clinical Summary') || bodyText.includes('Analyzing Your Health Context');
    const showsLoading = bodyText.includes('Loading') || bodyText.includes('Processing');
    
    console.log('Page content analysis:');
    console.log(`  - Shows upload prompt: ${showsUpload}`);
    console.log(`  - Shows insight content: ${showsInsights}`);
    console.log(`  - Shows loading state: ${showsLoading}`);
    
    if (showsLoading) {
      console.log('⏳ Page is loading, waiting longer...');
      await page.waitForTimeout(5000);
      
      const newBodyText = await page.locator('body').textContent();
      const stillUpload = newBodyText.includes('Upload your Sherpa session and health document');
      const nowInsights = newBodyText.includes('Health Summary') || newBodyText.includes('Clinical Summary') || newBodyText.includes('Your Health Summary & Insights');
      
      console.log('After loading:');
      console.log(`  - Still shows upload: ${stillUpload}`);
      console.log(`  - Now shows insights: ${nowInsights}`);
      
      if (nowInsights && !stillUpload) {
        console.log('SUCCESS: Automatic workflow progression is working correctly!');
        console.log('   Data flows from front-door → HIPAA redaction → insights');
        console.log('   Skip manual upload page when workflow data exists');
        console.log('   User sees AI-generated summary automatically');
      } else if (stillUpload) {
        console.log('ISSUE: Still showing upload prompt after workflow completion');
        console.log('   The automatic progression fix is not working correctly');
      } else {
        console.log('UNCLEAR: Page state is ambiguous after loading');
      }
    } else if (showsInsights && !showsUpload) {
      console.log('SUCCESS: Automatic workflow progression working immediately!');
    } else if (showsUpload) {
      console.log('ISSUE: Showing upload prompt instead of automatic progression');
    }
    
    await page.screenshot({ path: '/tmp/final-insights-page.png' });
    console.log('Screenshot saved to /tmp/final-insights-page.png');
    
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: '/tmp/test-error.png' });
  } finally {
    await browser.close();
  }
}

finalWorkflowTest();