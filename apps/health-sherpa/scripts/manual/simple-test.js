const { chromium } = require('playwright');

async function simpleTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('Going to HIPAA redaction page...');
    await page.goto('http://localhost:3000/pii-redaction');
    await page.waitForLoadState('networkidle');
    
    // List all buttons on the page
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons:`);
    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].textContent();
      console.log(`  ${i + 1}. "${text}"`);
    }
    
    // Fill textarea if it exists
    const textArea = page.locator('textarea');
    if (await textArea.count() > 0) {
      console.log('Filling textarea...');
      await textArea.fill('Sample medical text for testing');
      
      // List buttons again after filling
      console.log('Buttons after filling textarea:');
      const newButtons = await page.locator('button').all();
      for (let i = 0; i < newButtons.length; i++) {
        const text = await newButtons[i].textContent();
        const isEnabled = await newButtons[i].isEnabled();
        console.log(`  ${i + 1}. "${text}" (${isEnabled ? 'enabled' : 'disabled'})`);
      }
    }
    
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

simpleTest();