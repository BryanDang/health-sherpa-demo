import { test, expect } from '@playwright/test';
import * as path from 'path';

const dataDir = path.join(__dirname, '..', 'data');

test.describe('End-to-End Insight Interaction', () => {
  test('Complete insight exploration workflow', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Intake: both sample files from data/.
    await page.goto('/insight-action');
    const inputs = page.locator('input[type="file"]');
    await inputs.nth(0).setInputFiles(path.join(dataDir, 'sample-sherpa-session.txt'));
    await inputs.nth(1).setInputFiles(path.join(dataDir, 'sample-redacted-document.txt'));
    await page.getByRole('button', { name: /Generate Insights/ }).click();

    // Summary: the mock sends no structured reply, so the built-in sample insights show.
    await expect(page.getByRole('heading', { name: 'Your Health Summary & Insights' })).toBeVisible({ timeout: 15000 });
    await page.getByText('Understanding Your Lab Results').click();
    const explore = page.getByRole('button', { name: 'Explore Selected Insight' });
    await expect(explore).toBeEnabled();
    await explore.click();

    // Gathering: one question, one mock reply.
    await expect(page.getByRole('heading', { name: /Exploring:/ })).toBeVisible();
    await page.locator('textarea[placeholder*="Ask a question"]').fill('What does my LDL mean?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Sample reply (patient view, phase 0)').first()).toBeVisible({ timeout: 10000 });

    // Action: proposed step is shown.
    await page.getByRole('button', { name: 'Ready for Action' }).click();
    await expect(page.getByRole('heading', { name: 'Your Action Step' })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
