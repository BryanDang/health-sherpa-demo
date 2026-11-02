import { test, expect } from '@playwright/test';

test.describe('Pricing MCP Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForSelector('textarea');
  });

  test('end-to-end pricing with symptom-based procedures', async ({ page }) => {
    // Step 1: Enter symptoms that would trigger specific procedures
    await page.fill('textarea', 'I have severe chest pain and difficulty breathing');
    await page.press('textarea', 'Enter');
    
    // Wait for AI response
    await page.waitForTimeout(3000);
    
    // Step 2: Continue conversation
    await page.fill('textarea', 'The pain started 2 hours ago and feels crushing');
    await page.press('textarea', 'Enter');
    
    // Wait for care level assessment
    await page.waitForTimeout(3000);
    
    // Step 3: Check if pricing prompt appears
    await page.waitForSelector('text=/Would you like to see pricing information/', { timeout: 10000 });
    
    // Step 4: Enter zip code - look for the actual input
    const zipInput = page.locator('input[placeholder="12345"]');
    await zipInput.waitFor({ state: 'visible', timeout: 5000 });
    await zipInput.fill('10001');
    
    // Step 5: Select insurance
    await page.click('text=Select insurance or pay cash');
    await page.click('text=Cash/No Insurance');
    
    // Step 6: Click compare prices
    await page.click('text=Compare Prices');
    
    // Step 7: Wait for pricing results
    await page.waitForTimeout(5000);
    
    // Step 8: Verify pricing results show
    const pricingResults = await page.locator('text=/Found.*facilities within/').count();
    expect(pricingResults).toBeGreaterThan(0);
    
    // Step 9: Verify potential procedures are shown
    const proceduresSection = await page.locator('text=/Based on your symptoms, treatment may include/').count();
    expect(proceduresSection).toBeGreaterThan(0);
    
    // Step 10: Verify specific procedures based on symptoms
    const ekgTest = await page.locator('text=/EKG.*heart rhythm test/').count();
    expect(ekgTest).toBeGreaterThan(0);
    
    const chestXray = await page.locator('text=/Chest X-ray/').count();
    expect(chestXray).toBeGreaterThan(0);
    
    // Step 11: Verify both cash and insurance prices if applicable
    const cashPrice = await page.locator('text=Cash price').count();
    expect(cashPrice).toBeGreaterThan(0);
    
    // Step 12: Test debug mode
    await page.click('button[title="Toggle debug mode"]');
    
    // Verify debug panel appears
    const debugPanel = await page.locator('text=Debug Console').count();
    expect(debugPanel).toBe(1);
    
    // Check for debug logs
    const debugLogs = await page.locator('text=/Sending triage request/').count();
    expect(debugLogs).toBeGreaterThan(0);
    
    // Step 13: Test export with unanswered questions
    await page.fill('textarea', 'What specific medication dosage should I take for the pain?');
    await page.press('textarea', 'Enter');
    
    await page.waitForTimeout(3000);
    
    // Click export button
    await page.click('button[title="Export conversation"]');
    
    // Verify export modal shows
    const exportModal = await page.locator('text=Export Conversation').count();
    expect(exportModal).toBe(1);
    
    // Verify unanswered questions section appears
    const unansweredSection = await page.locator('text=Questions for Your Provider').count();
    expect(unansweredSection).toBe(1);
    
    // Take screenshot for documentation
    await page.screenshot({ path: 'pricing-mcp-test-results.png', fullPage: true });
  });

  test('pricing comparison with insurance options', async ({ page }) => {
    // Quick test for insurance pricing comparison
    await page.fill('textarea', 'I have a sore throat and fever');
    await page.press('textarea', 'Enter');
    
    await page.waitForTimeout(3000);
    
    // Wait for pricing prompt
    await page.waitForSelector('text=/Would you like to see pricing information/', { timeout: 10000 });
    
    // Enter zip code when prompted
    const zipInput = page.locator('input[placeholder="12345"]');
    await zipInput.waitFor({ state: 'visible', timeout: 5000 });
    await zipInput.fill('90210');
    
    // Select insurance
    await page.click('text=Select insurance or pay cash');
    await page.click('text=Blue Cross Blue Shield');
    
    // Compare prices
    await page.click('text=Compare Prices');
    
    await page.waitForTimeout(5000);
    
    // Verify both cash and insurance prices are shown
    const withInsurance = await page.locator('text=With insurance').count();
    expect(withInsurance).toBeGreaterThan(0);
    
    // Verify strep test is suggested based on symptoms
    const strepTest = await page.locator('text=/Rapid strep test/').count();
    expect(strepTest).toBeGreaterThan(0);
  });
});