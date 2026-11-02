/**
 * Turquoise Health MCP Integration Test
 *
 * Tests the MCP server working through the actual triage-chat app interface
 * Demonstrates real healthcare pricing queries via the web UI
 */

import { test, expect } from '@playwright/test';

test.describe('Turquoise Health MCP App Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Start the dev server (assuming it's running on localhost:3001)
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
  });

  test('Healthcare Pricing Query Demo', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/01-app-homepage.png',
      fullPage: true,
    });

    // Look for chat interface or main input
    const chatInput = page.locator('textarea, input[type="text"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Test 1: Ask about hospital pricing
    console.log('Test 1: Basic hospital pricing query...');
    await chatInput.fill(
      'What are the average prices for CPT code 99213 (office visit) in California hospitals?'
    );
    await chatInput.press('Enter');

    // Wait for response
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: 'test-results/02-pricing-query.png',
      fullPage: true,
    });

    // Test 2: Provider comparison
    console.log('Test 2: Provider comparison query...');
    await page.waitForTimeout(2000);
    await chatInput.fill(
      'Compare MRI pricing (CPT 70553) between Stanford Health Care and Kaiser Permanente'
    );
    await chatInput.press('Enter');

    await page.waitForTimeout(4000);
    await page.screenshot({
      path: 'test-results/03-provider-comparison.png',
      fullPage: true,
    });

    // Test 3: Market analysis
    console.log('Test 3: Market analysis query...');
    await page.waitForTimeout(2000);
    await chatInput.fill(
      'Show me pricing statistics for emergency room visits in Texas - average, median, and price range'
    );
    await chatInput.press('Enter');

    await page.waitForTimeout(4000);
    await page.screenshot({
      path: 'test-results/04-market-analysis.png',
      fullPage: true,
    });

    // Test 4: Complex healthcare query
    console.log('Test 4: Complex healthcare intelligence query...');
    await page.waitForTimeout(2000);
    await chatInput.fill(
      'Which health systems in California have the most transparent pricing data and lowest costs for common procedures?'
    );
    await chatInput.press('Enter');

    await page.waitForTimeout(5000);
    await page.screenshot({
      path: 'test-results/05-complex-query.png',
      fullPage: true,
    });

    // Test 5: Geographic pricing analysis
    console.log('Test 5: Geographic pricing analysis...');
    await page.waitForTimeout(2000);
    await chatInput.fill(
      'Compare hospital pricing for the same procedure across different states - show me regional variations'
    );
    await chatInput.press('Enter');

    await page.waitForTimeout(5000);
    await page.screenshot({
      path: 'test-results/06-geographic-analysis.png',
      fullPage: true,
    });

    // Final screenshot showing the complete conversation
    await page.screenshot({
      path: 'test-results/07-complete-conversation.png',
      fullPage: true,
    });

    console.log('All healthcare pricing queries completed!');
    console.log('Screenshots saved to test-results/');

    // Verify chat messages exist (indicating the app is working)
    const messages = page.locator(
      '[data-testid="chat-message"], .message, .chat-message'
    );
    const messageCount = await messages.count();
    expect(messageCount).toBeGreaterThan(0);

    console.log(`Found ${messageCount} chat messages in the interface`);
  });

  test('MCP Server Health Check', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:3001');

    // Check if there's a health/status endpoint or way to verify MCP connection
    await page.waitForLoadState('networkidle');

    // Look for any error messages or connection issues
    const errorElements = page.locator(
      '[data-testid="error"], .error, .alert-error'
    );
    const errorCount = await errorElements.count();

    expect(errorCount).toBe(0);
    console.log('No connection errors detected');

    // Take screenshot of healthy app state
    await page.screenshot({
      path: 'test-results/08-app-health-check.png',
      fullPage: true,
    });
  });

  test('Healthcare Data Accessibility Demo', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Create a comprehensive demo of healthcare data access
    const queries = [
      {
        name: 'Pricing Statistics',
        query:
          'Show me pricing statistics for the 9.47 billion hospital records in your database',
        wait: 3000,
      },
      {
        name: 'Provider Network Analysis',
        query:
          'Analyze the 6,260 healthcare providers - which states have the most hospitals?',
        wait: 4000,
      },
      {
        name: 'Transparency Scoring',
        query:
          'Which hospitals have the highest price transparency scores in the Turquoise Health data?',
        wait: 4000,
      },
      {
        name: 'Cost Comparison',
        query:
          'Compare cash prices vs insurance negotiated rates for common procedures',
        wait: 5000,
      },
    ];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`Query ${i + 1}: ${query.name}`);

      const chatInput = page.locator('textarea, input[type="text"]').first();
      await chatInput.fill(query.query);
      await chatInput.press('Enter');

      await page.waitForTimeout(query.wait);

      // Take screenshot for each query
      await page.screenshot({
        path: `test-results/demo-${i + 1}-${query.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        fullPage: true,
      });
    }

    console.log('Healthcare data accessibility demo completed!');
  });
});
