import { test, expect } from '@playwright/test';

test.describe('Fever Detection Bug Fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');

    // Wait for the page to load
    await page.waitForSelector('h1', { timeout: 10000 });
  });

  test('100.2°F fever should NOT trigger emergency', async ({ page }) => {
    // Type the fever message
    await page.fill(
      'input[placeholder*="describe"]',
      'I have a fever of 100.2°F'
    );
    await page.click('button[type="submit"]');

    // Wait for response
    await page.waitForSelector('[data-testid="care-level-badge"]', {
      timeout: 10000,
    });

    // Check that it's NOT emergency
    const careLevel = await page.textContent(
      '[data-testid="care-level-badge"]'
    );
    expect(careLevel?.toLowerCase()).not.toContain('emergency');

    // Should suggest urgent care or primary care instead
    expect(careLevel?.toLowerCase()).toMatch(/(urgent|primary)/);
  });

  test('103°F fever should trigger emergency', async ({ page }) => {
    // Clear any existing content
    await page.fill('input[placeholder*="describe"]', '');

    // Type the high fever message
    await page.fill(
      'input[placeholder*="describe"]',
      'I have a fever of 103°F'
    );
    await page.click('button[type="submit"]');

    // Wait for response
    await page.waitForSelector('[data-testid="care-level-badge"]', {
      timeout: 10000,
    });

    // Check that it IS emergency
    const careLevel = await page.textContent(
      '[data-testid="care-level-badge"]'
    );
    expect(careLevel?.toLowerCase()).toContain('emergency');

    // Should mention 911 or emergency room
    const responseText = await page.textContent(
      '[data-testid="chat-response"]'
    );
    expect(responseText?.toLowerCase()).toMatch(
      /(911|emergency room|emergency|call|immediate)/
    );
  });

  test('104.5°F fever should definitely trigger emergency', async ({
    page,
  }) => {
    // Clear any existing content
    await page.fill('input[placeholder*="describe"]', '');

    // Type the very high fever message
    await page.fill(
      'input[placeholder*="describe"]',
      'My temperature is 104.5 degrees'
    );
    await page.click('button[type="submit"]');

    // Wait for response
    await page.waitForSelector('[data-testid="care-level-badge"]', {
      timeout: 10000,
    });

    // Check that it IS emergency
    const careLevel = await page.textContent(
      '[data-testid="care-level-badge"]'
    );
    expect(careLevel?.toLowerCase()).toContain('emergency');
  });

  test('Mild fever without specific temperature should not trigger emergency', async ({
    page,
  }) => {
    // Clear any existing content
    await page.fill('input[placeholder*="describe"]', '');

    // Type the general fever message
    await page.fill(
      'input[placeholder*="describe"]',
      'I feel feverish and have body aches'
    );
    await page.click('button[type="submit"]');

    // Wait for response
    await page.waitForSelector('[data-testid="care-level-badge"]', {
      timeout: 10000,
    });

    // Check that it's NOT emergency
    const careLevel = await page.textContent(
      '[data-testid="care-level-badge"]'
    );
    expect(careLevel?.toLowerCase()).not.toContain('emergency');
  });
});
