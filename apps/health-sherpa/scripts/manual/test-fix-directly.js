const { chromium } = require('playwright');

async function testFixDirectly() {
  console.log('Testing the fix directly by going to insights page with localStorage data...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Log browser console
  page.on('console', msg => console.log(`${msg.type()}: ${msg.text()}`));
  
  try {
    // Go to insights page first
    await page.goto('http://localhost:3000/insight-action');
    
    // Set up localStorage data as if user completed workflow
    await page.evaluate(() => {
      // Set conversation context (front door data)
      const conversationData = {
        labels: ['Primary Concern', 'Health Goals', 'Communication Style'],
        responses: [
          'I have been experiencing recurring headaches and elevated blood pressure',
          'Understanding my test results and managing daily symptoms', 
          'I prefer clear, simple explanations with actionable steps'
        ]
      };
      localStorage.setItem('sherpa-conversation-context', JSON.stringify(conversationData));
      
      // Set redacted document data (HIPAA processing result)
      const redactedDoc = `Patient: [NAMES_REDACTED]
DOB: [DATES_REDACTED]
MRN: [MEDICAL_RECORD_NUMBERS_REDACTED]
Phone: [TELEPHONE_NUMBERS_REDACTED]
Email: [EMAIL_ADDRESSES_REDACTED]

MEDICAL REPORT - Date: March 15, 2024

Chief Complaint: Recurring headaches for 3 months
History: 44-year-old male with bilateral throbbing headaches 2-3 times weekly.
Assessment: Possible tension headaches related to elevated blood pressure (145/90 mmHg).
Plan: Increase antihypertensive medication, follow-up in 4 weeks.

Provider: Dr. [NAMES_REDACTED], MD`;
      
      localStorage.setItem('sherpa-redacted-document', redactedDoc);
      localStorage.setItem('sherpa-user-context', 'I have been experiencing recurring headaches and elevated blood pressure | Understanding my test results and managing daily symptoms | I prefer clear, simple explanations with actionable steps');
      
      console.log('LocalStorage data set up completely');
      console.log('Simulating completed workflow: front-door → HIPAA redaction → insights');
    });
    
    // Refresh the page to trigger the useEffect with the localStorage data
    console.log('Refreshing page to trigger automatic progression logic...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Give it time to process and skip to page 2
    await page.waitForTimeout(3000);
    
    console.log('Analyzing page behavior with workflow data present...');
    
    const bodyText = await page.locator('body').textContent();
    const showsUploadPrompt = bodyText.includes('Upload your Sherpa session and health document');
    const showsInsightContent = bodyText.includes('Health Summary') || bodyText.includes('Clinical Summary') || bodyText.includes('Your Health Summary & Insights') || bodyText.includes('Analyzing Your Health Context');
    const showsWorkflowMissing = bodyText.includes('Workflow Data Missing');
    const showsLoading = bodyText.includes('Loading your workflow data') || bodyText.includes('Processing');
    
    console.log('Page content analysis:');
    console.log(`  - Shows upload prompt: ${showsUploadPrompt}`);
    console.log(`  - Shows insight content: ${showsInsightContent}`);
    console.log(`  - Shows workflow missing: ${showsWorkflowMissing}`);
    console.log(`  - Shows loading: ${showsLoading}`);
    
    const currentUrl = page.url();
    console.log(`  - Current URL: ${currentUrl}`);
    
    // Check localStorage to confirm data is there
    const storageCheck = await page.evaluate(() => {
      return {
        hasConversation: !!localStorage.getItem('sherpa-conversation-context'),
        hasRedacted: !!localStorage.getItem('sherpa-redacted-document'),
        hasUserContext: !!localStorage.getItem('sherpa-user-context')
      };
    });
    
    console.log('LocalStorage verification:', storageCheck);
    
    if (showsLoading) {
      console.log('⏳ Still loading, waiting more...');
      await page.waitForTimeout(5000);
      
      const newBodyText = await page.locator('body').textContent();
      const finalUpload = newBodyText.includes('Upload your Sherpa session and health document');
      const finalInsights = newBodyText.includes('Health Summary') || newBodyText.includes('Clinical Summary') || newBodyText.includes('Your Health Summary & Insights');
      
      console.log('Final state after loading:');
      console.log(`  - Upload prompt: ${finalUpload}`);
      console.log(`  - Insight content: ${finalInsights}`);
      
      if (finalInsights && !finalUpload) {
        console.log('SUCCESS: The fix is working correctly!');
        console.log('   With workflow data present, user is automatically taken to insights');
        console.log('   No manual upload required');
        console.log('   Skips page 1 (intake) entirely');
      } else if (finalUpload) {
        console.log('ISSUE: Fix is not working - still shows upload prompt');
        console.log('   The logic to skip page 1 when workflow data exists needs debugging');
      } else {
        console.log('AMBIGUOUS: Page state is unclear after full loading');
      }
    } else if (showsInsightContent && !showsUploadPrompt && !showsWorkflowMissing) {
      console.log('SUCCESS: Fix working immediately!');
      console.log('   Page automatically skipped to insights summary');
      console.log('   No upload prompt shown');
      console.log('   User sees AI processing/summary directly');
    } else if (showsUploadPrompt) {
      console.log('ISSUE: Fix not working - still showing upload prompt');
    } else if (showsWorkflowMissing) {
      console.log('ISSUE: Logic error - showing workflow missing despite localStorage data');
    }
    
    await page.screenshot({ path: '/tmp/fix-test-result.png' });
    console.log('Screenshot saved to /tmp/fix-test-result.png');
    
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: '/tmp/fix-test-error.png' });
  } finally {
    await browser.close();
  }
}

testFixDirectly();