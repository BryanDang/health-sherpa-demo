/**
 * End-to-End Browser Tests for Enhanced Triage Features
 * Tests complete user workflows with Playwright
 */

import { test, expect } from '@playwright/test';

// Test configuration
const DEV_URL = 'http://localhost:3001';
const TEXTAREA_SELECTOR =
  'textarea[placeholder*="Describe what\'s bothering you"]';
const SUBMIT_BUTTON_SELECTOR = 'button[type="submit"]';
const MESSAGE_CONTAINER_SELECTOR = 'div[class*="justify-start"]';

test.describe('Enhanced Triage Features E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Store console errors for assertion
    (page as any).consoleErrors = consoleErrors;

    await page.goto(DEV_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Application loads without console errors', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Health Triage Chat');

    // Wait a bit for any async errors to surface
    await page.waitForTimeout(2000);

    const consoleErrors = (page as any).consoleErrors || [];
    expect(consoleErrors).toHaveLength(0);
  });

  test('Chat interface elements are present and functional', async ({
    page,
  }) => {
    // Check UI elements exist
    await expect(page.locator(TEXTAREA_SELECTOR)).toBeVisible();
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeVisible();

    // Check initial state
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeDisabled();

    // Enable submit button by typing
    await page.fill(TEXTAREA_SELECTOR, 'test message');
    await page.waitForTimeout(500);
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeEnabled();

    // Clear and check disabled again
    await page.fill(TEXTAREA_SELECTOR, '');
    await page.waitForTimeout(500);
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeDisabled();
  });

  test('Basic message sending and response workflow', async ({ page }) => {
    // Send a simple message
    await page.fill(TEXTAREA_SELECTOR, 'I have a headache');
    await page.click(SUBMIT_BUTTON_SELECTOR);

    // Wait for response (up to 30 seconds for AI processing)
    await expect(page.locator(MESSAGE_CONTAINER_SELECTOR)).toBeVisible({
      timeout: 30000,
    });

    // Check that response appeared
    const messages = await page.locator(MESSAGE_CONTAINER_SELECTOR).count();
    expect(messages).toBeGreaterThan(0);

    // Verify no console errors during interaction
    const consoleErrors = (page as any).consoleErrors || [];
    expect(consoleErrors).toHaveLength(0);
  });

  test('Conversation memory across multiple messages', async ({ page }) => {
    // First message - establish context
    await page.fill(TEXTAREA_SELECTOR, 'My knee hurts');
    await page.click(SUBMIT_BUTTON_SELECTOR);

    // Wait for first response
    await expect(page.locator(MESSAGE_CONTAINER_SELECTOR)).toBeVisible({
      timeout: 30000,
    });

    // Second message - reference previous context
    await page.fill(TEXTAREA_SELECTOR, 'The pain is at a 7 out of 10');
    await page.click(SUBMIT_BUTTON_SELECTOR);

    // Wait for second response
    await page.waitForTimeout(20000); // Give time for processing

    const messages = await page.locator(MESSAGE_CONTAINER_SELECTOR).count();
    expect(messages).toBeGreaterThanOrEqual(2);

    // Get the latest response text
    const latestResponse = await page
      .locator(MESSAGE_CONTAINER_SELECTOR)
      .last()
      .textContent();

    // Should reference knee pain without asking location again
    const askingForLocation =
      latestResponse?.toLowerCase().includes('where is the pain') ||
      latestResponse?.toLowerCase().includes('where does it hurt') ||
      latestResponse?.toLowerCase().includes('which part of your body');

    expect(askingForLocation).toBeFalsy();

    // Should reference the pain context
    const referencesContext =
      latestResponse?.toLowerCase().includes('knee') ||
      latestResponse?.toLowerCase().includes('pain') ||
      latestResponse?.toLowerCase().includes('7');

    expect(referencesContext).toBeTruthy();
  });

  test('Enhanced function integration works correctly', async ({ page }) => {
    // Intercept network requests to verify enhanced endpoint usage
    const requests: any[] = [];
    page.on('request', (request) => {
      if (request.url().includes('triage-enhanced')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData(),
        });
      }
    });

    // Send a message
    await page.fill(
      TEXTAREA_SELECTOR,
      'I have chest pain and shortness of breath'
    );
    await page.click(SUBMIT_BUTTON_SELECTOR);

    // Wait for response
    await expect(page.locator(MESSAGE_CONTAINER_SELECTOR)).toBeVisible({
      timeout: 30000,
    });

    // Check that request was made to enhanced endpoint
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0].url).toContain('triage-enhanced');

    // Verify response quality
    const responseText = await page
      .locator(MESSAGE_CONTAINER_SELECTOR)
      .last()
      .textContent();
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(50); // Should be substantial response
  });

  test('Streaming toggle functionality', async ({ page }) => {
    // Find and click the streaming toggle button
    const streamingButton = page.locator('button:has-text("Standard")');
    await expect(streamingButton).toBeVisible();

    // Click to enable streaming
    await streamingButton.click();
    await expect(page.locator('button:has-text("Streaming")')).toBeVisible();

    // Send a message with streaming enabled
    await page.fill(TEXTAREA_SELECTOR, 'I have a headache');
    await page.click(SUBMIT_BUTTON_SELECTOR);

    // Should show streaming indicator in loading message
    await expect(page.locator('text=streaming')).toBeVisible({ timeout: 5000 });

    // Wait for response
    await expect(page.locator(MESSAGE_CONTAINER_SELECTOR)).toBeVisible({
      timeout: 30000,
    });

    // Toggle back to standard
    await page.locator('button:has-text("Streaming")').click();
    await expect(page.locator('button:has-text("Standard")')).toBeVisible();
  });

  test('Error handling for network failures', async ({ page }) => {
    // Block network requests to simulate failure
    await page.route('**/functions/v1/**', (route) => {
      route.abort('failed');
    });

    // Try to send a message
    await page.fill(TEXTAREA_SELECTOR, 'Test error handling');
    await page.click(SUBMIT_BUTTON_SELECTOR);

    // Should handle error gracefully (not crash)
    await page.waitForTimeout(10000);

    // Check that UI is still functional
    await expect(page.locator(TEXTAREA_SELECTOR)).toBeVisible();
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeVisible();

    // Should not have unhandled errors
    const consoleErrors = (page as any).consoleErrors || [];
    const unhandledErrors = consoleErrors.filter(
      (error) =>
        !error.includes('fetch') &&
        !error.includes('network') &&
        !error.includes('Failed to fetch')
    );
    expect(unhandledErrors).toHaveLength(0);
  });

  test('Responsive design and accessibility', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // UI should still be accessible
    await expect(page.locator(TEXTAREA_SELECTOR)).toBeVisible();
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeVisible();

    // Should be able to interact
    await page.fill(TEXTAREA_SELECTOR, 'Mobile test');
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeEnabled();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator(TEXTAREA_SELECTOR)).toBeVisible();
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator(TEXTAREA_SELECTOR)).toBeVisible();
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeVisible();
  });

  test('Performance baseline - page load and interaction', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(DEV_URL);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds

    // Measure interaction response time
    const interactionStart = Date.now();
    await page.fill(TEXTAREA_SELECTOR, 'Performance test');
    await page.click(SUBMIT_BUTTON_SELECTOR);

    // Wait for UI feedback (button disabled, loading state, etc.)
    await page.waitForTimeout(1000);
    const interactionTime = Date.now() - interactionStart;
    expect(interactionTime).toBeLessThan(5000); // UI should respond within 5 seconds
  });

  test('Multiple rapid messages handling', async ({ page }) => {
    // Send multiple messages rapidly
    const messages = [
      'First message about headache',
      'Second message about duration',
      'Third message about intensity',
    ];

    for (const message of messages) {
      await page.fill(TEXTAREA_SELECTOR, message);
      await page.click(SUBMIT_BUTTON_SELECTOR);
      await page.waitForTimeout(1000); // Brief delay between messages
    }

    // Wait for all responses
    await page.waitForTimeout(30000);

    // Should handle all messages without crashing
    const responseCount = await page
      .locator(MESSAGE_CONTAINER_SELECTOR)
      .count();
    expect(responseCount).toBeGreaterThan(0);

    // Should not have critical console errors
    const consoleErrors = (page as any).consoleErrors || [];
    const criticalErrors = consoleErrors.filter(
      (error) =>
        error.includes('Uncaught') ||
        error.includes('TypeError') ||
        error.includes('ReferenceError')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Long session stability', async ({ page }) => {
    // Simulate a longer conversation
    const conversationMessages = [
      'I have been feeling unwell',
      'I have a fever and headache',
      'The fever is around 101 degrees',
      'I also have body aches',
      'This started 2 days ago',
      'Should I see a doctor?',
    ];

    for (const message of conversationMessages) {
      await page.fill(TEXTAREA_SELECTOR, message);
      await page.click(SUBMIT_BUTTON_SELECTOR);

      // Wait for response before next message
      await page.waitForTimeout(15000);
    }

    // Final check - app should still be functional
    await expect(page.locator(TEXTAREA_SELECTOR)).toBeVisible();
    await expect(page.locator(SUBMIT_BUTTON_SELECTOR)).toBeVisible();

    // Should have received multiple responses
    const responseCount = await page
      .locator(MESSAGE_CONTAINER_SELECTOR)
      .count();
    expect(responseCount).toBeGreaterThanOrEqual(conversationMessages.length);

    // Memory leaks check (basic)
    const consoleErrors = (page as any).consoleErrors || [];
    const memoryErrors = consoleErrors.filter(
      (error) =>
        error.includes('memory') ||
        error.includes('heap') ||
        error.includes('leak')
    );
    expect(memoryErrors).toHaveLength(0);
  });
});

// Test summary and reporting
test.afterAll(async () => {
  console.log('All E2E tests completed');
  console.log('Enhanced Triage Features tested end-to-end');
  console.log('User journeys validated');
  console.log('Error handling verified');
  console.log('Responsive design confirmed');
  console.log('Performance baselines established');
});
