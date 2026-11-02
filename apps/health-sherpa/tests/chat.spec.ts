import { test, expect } from '@playwright/test';

test.describe('AI Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await expect(
      page.locator('h3:text("Welcome to Health Sherpa AI")')
    ).toBeVisible();
  });

  test('displays welcome message and chat interface', async ({ page }) => {
    // Check welcome message
    await expect(
      page.locator('text=Welcome to Health Sherpa AI')
    ).toBeVisible();
    await expect(
      page.locator("text=I'm powered by Gemini 1.5 Flash")
    ).toBeVisible();

    // Check chat input is present
    await expect(
      page.locator('textarea[placeholder*="Upload a document first"]')
    ).toBeVisible();

    // Check send button is present (using test data attribute)
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  });

  test('shows phase information', async ({ page }) => {
    // Should show current phase (Phase 0: Trust Building)
    await expect(page.locator('text=Phase 0: Trust Building')).toBeVisible();
  });

  test('AI chat input validation', async ({ page }) => {
    const textarea = page.locator('textarea');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Send button should be disabled with empty input
    await expect(sendButton).toBeDisabled();

    // Type a message
    await textarea.fill('Hello, can you help me?');

    // Send button should be enabled
    await expect(sendButton).toBeEnabled();
  });

  test('handles AI response (if API key is configured)', async ({ page }) => {
    const textarea = page.locator('textarea');
    const sendButton = page.locator('[data-testid="send-button"]');

    // Type a test message
    await textarea.fill('What does blood pressure mean?');
    await sendButton.click();

    // Should see user message
    await expect(
      page.locator('text=What does blood pressure mean?')
    ).toBeVisible();

    // Should see loading indicator
    await expect(
      page.locator('text=Health Sherpa is thinking...')
    ).toBeVisible();

    // Wait for AI response (or error message)
    await page.waitForTimeout(5000);

    // Should have either AI response or error message
    const hasResponse = (await page.locator('.bg-gray-100').count()) > 0;
    expect(hasResponse).toBeTruthy();
  });
});

test.describe('Document Upload', () => {
  test('shows document upload interface', async ({ page }) => {
    await page.goto('/');

    // Should have document upload area - use test data attribute
    const uploadTrigger = page.locator('[data-testid="upload-trigger"]');

    // Check if upload interface appears when no document is loaded
    await expect(uploadTrigger).toBeVisible();
  });

  test('upload area expands when clicked', async ({ page }) => {
    await page.goto('/');

    // Click on upload trigger
    const uploadTrigger = page.locator('[data-testid="upload-trigger"]');
    await uploadTrigger.click();

    // Should see expanded upload interface
    await expect(page.locator('[data-testid="upload-dropzone"]')).toBeVisible();
    await expect(page.locator('text=Try Demo Lab Results')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto('/');

    // Should still show welcome message
    await expect(
      page.locator('text=Welcome to Health Sherpa AI')
    ).toBeVisible();

    // Chat interface should be responsive
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('works on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto('/');

    // Should show all elements
    await expect(
      page.locator('text=Welcome to Health Sherpa AI')
    ).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('handles network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/chat', (route) => route.abort());

    await page.goto('/');

    const textarea = page.locator('textarea');
    const sendButton = page.locator('[data-testid="send-button"]');

    await textarea.fill('Test message');
    await sendButton.click();

    // Should show error message
    await expect(
      page.locator('text=I apologize, but I encountered an error')
    ).toBeVisible({ timeout: 10000 });
  });
});
