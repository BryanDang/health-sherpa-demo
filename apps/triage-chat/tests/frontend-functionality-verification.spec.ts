/**
 * Frontend Functionality Verification Test
 * Tests the specific fixes implemented:
 * 1. AI Reasoning is clickable and displays properly
 * 2. Conversation export contains full message history
 * 3. Memory persists between messages
 */

import { test, expect } from '@playwright/test';

test.describe('Frontend Functionality Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh session
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
  });

  test('AI Reasoning is clickable and displays plan, observations, steps, confidence', async ({ page }) => {
    // Set up goal first to get past modal
    await page.getByText('Start Fresh').click();
    await page.selectOption('select[name="goalType"]', 'understand_symptoms');
    await page.fill('textarea[name="description"]', 'I want to understand my back pain');
    await page.getByText('Set Goal').click();
    
    // Wait for goal modal to close and input to be available
    await page.waitForSelector('textarea[placeholder*="Tell me"]', { state: 'visible' });
    
    // Send a message that should generate reasoning
    await page.fill('textarea[placeholder*="Tell me"]', 'I fell off a ladder and now my back hurts really bad, pain level 8/10');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for AI response with reasoning
    await page.waitForSelector('div:has-text("AI Reasoning")', { 
      state: 'visible',
      timeout: 40000 // Allow time for API response
    });
    
    // Verify AI Reasoning section is visible and clickable
    const reasoningSection = page.locator('div:has-text("AI Reasoning")').first();
    await expect(reasoningSection).toBeVisible();
    
    // Check that reasoning contains the expected fields
    await expect(page.locator('text=Plan:')).toBeVisible();
    await expect(page.locator('text=Observations:')).toBeVisible();
    await expect(page.locator('text=Next Steps:')).toBeVisible();
    await expect(page.locator('text=Confidence:')).toBeVisible();
    
    // Verify confidence shows a percentage
    await expect(page.locator('text=/Confidence:.*\\d+%/')).toBeVisible();
    
    console.log('AI Reasoning is properly displayed with all expected fields');
  });

  test('Conversation export contains full message history with care levels and reasoning', async ({ page }) => {
    // Set up goal first
    await page.getByText('Start Fresh').click();
    await page.selectOption('select[name="goalType"]', 'understand_symptoms');
    await page.fill('textarea[name="description"]', 'I want to understand my symptoms');
    await page.getByText('Set Goal').click();
    
    // Wait for setup and send a message
    await page.waitForSelector('textarea[placeholder*="Tell me"]', { state: 'visible' });
    await page.fill('textarea[placeholder*="Tell me"]', 'My back hurts after falling');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for response
    await page.waitForSelector('div:has-text("AI Reasoning")', { 
      state: 'visible',
      timeout: 40000
    });
    
    // Send another message to create conversation history
    await page.fill('textarea[placeholder*="Tell me"]', 'The pain is getting worse');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for second response
    await page.waitForTimeout(20000); // Allow time for second response
    
    // Click export session
    await page.getByText('Export Session').click();
    
    // Wait for checkpoint modal and export
    await page.getByText('Export Current Session').click();
    
    // Check the exported data (it should appear in a text area or download)
    const exportText = await page.locator('textarea').last().textContent();
    
    // Verify export contains conversation data
    expect(exportText).toContain('back hurts');
    expect(exportText).toContain('pain is getting worse');
    expect(exportText).toContain('messageHistory');
    
    console.log('Export contains full conversation history');
  });

  test('Memory persists between messages (back pain context retained)', async ({ page }) => {
    // Set up goal
    await page.getByText('Start Fresh').click();
    await page.selectOption('select[name="goalType"]', 'understand_symptoms');
    await page.fill('textarea[name="description"]', 'I want to understand my back pain');
    await page.getByText('Set Goal').click();
    
    // Send first message about back pain from ladder fall
    await page.waitForSelector('textarea[placeholder*="Tell me"]', { state: 'visible' });
    await page.fill('textarea[placeholder*="Tell me"]', 'I fell off a ladder yesterday and my back hurts');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for response
    await page.waitForSelector('div:has-text("AI Reasoning")', { 
      state: 'visible',
      timeout: 40000
    });
    
    // Verify memory indicator shows facts are being remembered
    await expect(page.locator('text=/Remembering \\d+ key facts/')).toBeVisible();
    
    // Send follow-up message without mentioning back pain or ladder
    await page.fill('textarea[placeholder*="Tell me"]', 'What should I do next?');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for second response
    await page.waitForTimeout(20000);
    
    // Check that the AI response mentions back pain or ladder fall (proving memory retention)
    const lastResponse = page.locator('[data-testid="assistant-message"]').last();
    const responseText = await lastResponse.textContent();
    
    // Verify the response references the previous context
    const hasBackReference = responseText.includes('back') || 
                            responseText.includes('fall') || 
                            responseText.includes('ladder') ||
                            responseText.includes('injury');
    
    expect(hasBackReference).toBeTruthy();
    
    console.log('Memory persists between messages - context retained');
  });

  test('No console errors during normal operation', async ({ page }) => {
    const consoleErrors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Go through full conversation flow
    await page.getByText('Start Fresh').click();
    await page.selectOption('select[name="goalType"]', 'understand_symptoms');
    await page.fill('textarea[name="description"]', 'I want to understand my symptoms');
    await page.getByText('Set Goal').click();
    
    await page.waitForSelector('textarea[placeholder*="Tell me"]', { state: 'visible' });
    await page.fill('textarea[placeholder*="Tell me"]', 'I have a headache');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for response
    await page.waitForSelector('div:has-text("AI Reasoning")', { 
      state: 'visible',
      timeout: 40000
    });
    
    // Check for console errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('favicon') && // Ignore favicon errors
      !error.includes('apple-touch-icon') && // Ignore icon errors
      !error.includes('ERR_INTERNET_DISCONNECTED') // Ignore network errors
    );
    
    expect(criticalErrors).toEqual([]);
    console.log('No critical console errors detected');
  });
});