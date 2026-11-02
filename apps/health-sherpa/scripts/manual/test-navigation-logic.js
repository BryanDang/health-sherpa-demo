const { chromium } = require('playwright');

async function testNavigationLogic() {
  console.log('Testing navigation logic fix: skip page 1 when workflow data exists...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Track console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`${msg.type()}: ${text}`);
  });
  
  try {
    console.log('Test 1: Go to insights page WITHOUT workflow data (should show error)');
    await page.goto('http://localhost:3000/insight-action');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    let bodyText = await page.locator('body').textContent();
    const showsWorkflowMissing = bodyText.includes('Workflow Data Missing');
    const showsUploadPrompt = bodyText.includes('Upload your Sherpa session and health document');
    
    console.log(`  - Shows "Workflow Data Missing": ${showsWorkflowMissing}`);
    console.log(`  - Shows upload prompt: ${showsUploadPrompt}`);
    
    if (showsWorkflowMissing) {
      console.log('GOOD: Without workflow data, shows error message as expected');
    } else {
      console.log('Issue: Should show workflow missing error when no data present');
    }
    
    console.log('\nTest 2: Add workflow data and refresh (should skip to insights)');
    
    // Add workflow data
    await page.evaluate(() => {
      // Set conversation context
      const conversationData = {
        labels: ['Primary Concern', 'Health Goals'],
        responses: [
          'I have been experiencing recurring headaches and elevated blood pressure',
          'Understanding my test results and managing daily symptoms'
        ]
      };
      localStorage.setItem('sherpa-conversation-context', JSON.stringify(conversationData));
      
      // Set redacted document
      const redactedDoc = `MEDICAL REPORT - Date: March 15, 2024
Chief Complaint: Recurring headaches for 3 months
History: 44-year-old male with bilateral throbbing headaches.
Assessment: Possible tension headaches related to elevated blood pressure.
Plan: Increase antihypertensive medication, follow-up in 4 weeks.`;
      
      localStorage.setItem('sherpa-redacted-document', redactedDoc);
      localStorage.setItem('sherpa-user-context', 'I have been experiencing recurring headaches and elevated blood pressure | Understanding my test results and managing daily symptoms');
      
      console.log('Workflow data added to localStorage');
    });
    
    // Refresh to trigger the useEffect
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give it time to process
    
    bodyText = await page.locator('body').textContent();
    const stillShowsWorkflowMissing = bodyText.includes('Workflow Data Missing');
    const nowShowsInsightContent = bodyText.includes('Health Summary') || bodyText.includes('Clinical Summary') || bodyText.includes('Analyzing Your Health Context') || bodyText.includes('Brain');
    const showsError = bodyText.includes('Application error') || bodyText.includes('client-side exception');
    const stillLoading = bodyText.includes('Loading your workflow data');
    
    console.log(`  - Still shows "Workflow Data Missing": ${stillShowsWorkflowMissing}`);
    console.log(`  - Shows insight content: ${nowShowsInsightContent}`);
    console.log(`  - Shows error: ${showsError}`);
    console.log(`  - Still loading: ${stillLoading}`);
    
    // Console logs hold the debug messages.
    const hasWorkflowDataLogs = consoleLogs.some(log => log.includes('Workflow data found, skipping to page 2'));
    const hasDataCheckLogs = consoleLogs.some(log => log.includes('Workflow data check'));
    
    console.log(`  - Console shows workflow data found: ${hasWorkflowDataLogs}`);
    console.log(`  - Console shows data check: ${hasDataCheckLogs}`);
    
    if (nowShowsInsightContent && !stillShowsWorkflowMissing) {
      console.log('SUCCESS: The navigation logic fix is working!');
      console.log('   With workflow data present, page skips to insights summary');
      console.log('   No longer shows "Workflow Data Missing" error');
      console.log('   Automatic progression to page 2 successful');
    } else if (stillShowsWorkflowMissing) {
      console.log('ISSUE: Still showing workflow missing despite localStorage data');
      console.log('   The localStorage check logic may not be working correctly');
    } else if (showsError) {
      console.log('The fix may be working, but there\'s an API error preventing full load');
      console.log('   Navigation logic appears correct, but API call is failing');
    } else if (stillLoading) {
      console.log('⏳ Still loading - let\'s wait a bit more...');
      await page.waitForTimeout(5000);
      
      const finalText = await page.locator('body').textContent();
      const finalError = finalText.includes('Workflow Data Missing');
      const finalInsights = finalText.includes('Health Summary') || finalText.includes('Clinical Summary');
      
      if (finalInsights && !finalError) {
        console.log('SUCCESS: After loading, automatic progression worked!');
      } else {
        console.log('Even after waiting, automatic progression not working correctly');
      }
    }
    
    await page.screenshot({ path: '/tmp/navigation-test-result.png' });
    console.log('\nScreenshot saved to /tmp/navigation-test-result.png');
    
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: '/tmp/navigation-test-error.png' });
  } finally {
    await browser.close();
  }
}

testNavigationLogic();