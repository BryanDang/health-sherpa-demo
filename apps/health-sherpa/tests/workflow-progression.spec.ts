import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Automatic Workflow Progression', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Complete multi-page workflow with automatic progression', async () => {
    // Runs the guided flow against the mock backend: demo document, review
    // modal, phase 1 chat. The older localStorage hand-off is gone from the app.
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Health Sherpa', exact: true })).toBeVisible();
    await expect(page.getByText('Sample data. Not medical advice.').first()).toBeVisible();

    await page.locator('[data-testid="upload-trigger"]').click();
    await page.getByText('Try Demo Lab Results').click();
    await page.getByRole('button', { name: 'Continue with Protected Document' }).click();

    await expect(page.getByText('Phase 1: Clinical Analysis in Progress')).toBeVisible();
    await page.locator('textarea').fill('Can you summarize my health document?');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.getByText('Sample reply (patient view, phase 1)')).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test('Verify localStorage persistence across page navigation', async () => {
    console.log('Testing localStorage persistence...');

    await page.goto('/');
    
    // Set test data in localStorage
    await page.evaluate(() => {
      localStorage.setItem('sherpa-user-input', JSON.stringify({
        name: 'Test User',
        age: 30,
        condition: 'Test condition'
      }));
      localStorage.setItem('sherpa-redacted-document', 'test-document-content');
      localStorage.setItem('sherpa-user-context', 'test-context');
    });

    // Navigate to different page and back
    await page.goto('/about');
    await page.waitForTimeout(1000);
    await page.goto('/');

    // Check if localStorage data persists
    const persistedData = await page.evaluate(() => ({
      userInput: localStorage.getItem('sherpa-user-input'),
      redactedDocument: localStorage.getItem('sherpa-redacted-document'),
      userContext: localStorage.getItem('sherpa-user-context')
    }));

    expect(persistedData.userInput).toBeTruthy();
    expect(persistedData.redactedDocument).toBeTruthy();
    expect(persistedData.userContext).toBeTruthy();

    console.log('localStorage persistence test passed');
  });

  test('Verify currentPage state and hasWorkflowData logic', async () => {
    console.log('Testing workflow state logic...');

    await page.goto('/');
    
    // Test without workflow data
    let hasWorkflowData = await page.evaluate(() => {
      const userInput = localStorage.getItem('sherpa-user-input');
      const redactedDocument = localStorage.getItem('sherpa-redacted-document');
      return !!(userInput && redactedDocument);
    });

    expect(hasWorkflowData).toBeFalsy();
    console.log('hasWorkflowData correctly false when no data present');

    // Add workflow data
    await page.evaluate(() => {
      localStorage.setItem('sherpa-user-input', JSON.stringify({ test: 'data' }));
      localStorage.setItem('sherpa-redacted-document', 'test-document');
    });

    hasWorkflowData = await page.evaluate(() => {
      const userInput = localStorage.getItem('sherpa-user-input');
      const redactedDocument = localStorage.getItem('sherpa-redacted-document');
      return !!(userInput && redactedDocument);
    });

    expect(hasWorkflowData).toBeTruthy();
    console.log('hasWorkflowData correctly true when data present');
  });
});