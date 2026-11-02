import { test } from '@playwright/test';

test('Live MCP Demo', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('networkidle');

  // Input a healthcare pricing query
  const input = page.locator('textarea, input[type="text"]').first();
  await input.fill(
    'I need to find affordable MRI pricing in California. Can you show me the cheapest options using your Turquoise Health database?'
  );
  await input.press('Enter');

  // Wait for response
  await page.waitForTimeout(8000);

  // Take screenshot showing the interaction
  await page.screenshot({
    path: 'test-results/live-mcp-demo.png',
    fullPage: true,
  });

  console.log('Live MCP demo completed - check live-mcp-demo.png');
});
