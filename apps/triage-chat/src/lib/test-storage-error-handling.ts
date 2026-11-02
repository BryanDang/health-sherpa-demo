/**
 * Test suite for storage error handling validation
 * 
 * This file provides utilities to test edge cases in localStorage handling
 * for the visit summary system.
 */

import { 
  safeLocalStorage, 
  storageErrorHandler,
  type StorageResult 
} from './storage-error-handler';
import {
  saveVisitSummary,
  loadVisitSummaries,
  getVisitSummaryStats,
  performStorageHealthCheck,
  clearOldestVisitSummaries,
  createVisitSummary,
  type VisitSummary,
  type VisitSummaryResult
} from './visit-summary';
import type { EnhancedMessage } from '../../tests/contracts/component-state-storage.contract';

/**
 * Test scenarios for localStorage edge cases
 */
export class StorageErrorTester {
  
  /**
   * Test storage quota exceeded scenario
   */
  static async testQuotaExceeded(): Promise<void> {
    console.log('Testing storage quota exceeded scenario...');
    
    try {
      // Create a large dummy summary to trigger quota issues
      const largeSummary = StorageErrorTester.createLargeDummySummary();
      
      // Attempt to save and observe behavior
      const saveResult = await saveVisitSummary(largeSummary);
      
      console.log('Quota test result:', {
        success: saveResult.success,
        errorType: saveResult.error?.type,
        fallbackUsed: saveResult.error?.fallbackUsed,
        storageMethod: saveResult.metadata?.storageMethod,
      });
      
    } catch (error) {
      console.error('Quota test failed:', error);
    }
  }

  /**
   * Test corrupted data recovery
   */
  static async testCorruptedDataRecovery(): Promise<void> {
    console.log('Testing corrupted data recovery...');
    
    try {
      // Inject corrupted data into localStorage
      localStorage.setItem('triage_visit_summaries', '{"invalid": json}');
      
      // Attempt to load and observe recovery behavior
      const loadResult = await loadVisitSummaries();
      
      console.log('Corruption recovery result:', {
        success: loadResult.success,
        errorType: loadResult.error?.type,
        dataRecovered: loadResult.data?.summaries.length || 0,
        fallbackUsed: loadResult.error?.fallbackUsed,
      });
      
    } catch (error) {
      console.error('Corruption test failed:', error);
    }
  }

  /**
   * Test browser compatibility (localStorage unavailable)
   */
  static async testBrowserCompatibility(): Promise<void> {
    console.log('Testing browser compatibility (localStorage unavailable)...');
    
    try {
      // Temporarily disable localStorage to simulate incompatible browser
      const originalLocalStorage = window.localStorage;
      
      // @ts-ignore - Simulating unavailable localStorage
      delete window.localStorage;
      
      const testSummary = StorageErrorTester.createTestSummary();
      const saveResult = await saveVisitSummary(testSummary);
      
      console.log('Compatibility test result:', {
        success: saveResult.success,
        errorType: saveResult.error?.type,
        fallbackUsed: saveResult.error?.fallbackUsed,
        storageMethod: saveResult.metadata?.storageMethod,
      });
      
      // Restore localStorage
      window.localStorage = originalLocalStorage;
      
    } catch (error) {
      console.error('Compatibility test failed:', error);
    }
  }

  /**
   * Test concurrent access protection
   */
  static async testConcurrentAccess(): Promise<void> {
    console.log('Testing concurrent access protection...');
    
    try {
      const testSummary1 = StorageErrorTester.createTestSummary('concurrent-1');
      const testSummary2 = StorageErrorTester.createTestSummary('concurrent-2');
      
      // Simulate concurrent saves
      const [result1, result2] = await Promise.all([
        saveVisitSummary(testSummary1),
        saveVisitSummary(testSummary2),
      ]);
      
      console.log('Concurrent access results:', {
        save1: { success: result1.success, retries: result1.metadata?.retryCount },
        save2: { success: result2.success, retries: result2.metadata?.retryCount },
      });
      
    } catch (error) {
      console.error('Concurrent access test failed:', error);
    }
  }

  /**
   * Test data migration scenario
   */
  static async testDataMigration(): Promise<void> {
    console.log('Testing data migration...');
    
    try {
      // Create old format data (missing new fields)
      const oldFormatData = {
        summaries: [{
          id: 'old-format-summary',
          timestamp: new Date().toISOString(),
          topics: ['test'],
          duration: 5,
          // Missing: metadata, emergencyFlags, etc.
        }],
        lastUpdated: new Date().toISOString(),
        totalVisits: 1,
        // Missing: version, metadata
      };
      
      localStorage.setItem('triage_visit_summaries', JSON.stringify(oldFormatData));
      
      // Load and observe migration
      const loadResult = await loadVisitSummaries();
      
      console.log('Migration test result:', {
        success: loadResult.success,
        migratedSummaries: loadResult.data?.summaries.length || 0,
        hasMetadata: !!loadResult.data?.summaries[0]?.metadata,
        schemaVersion: loadResult.data?.version,
      });
      
    } catch (error) {
      console.error('Migration test failed:', error);
    }
  }

  /**
   * Test storage health check and repair
   */
  static async testStorageHealthCheck(): Promise<void> {
    console.log('Testing storage health check and repair...');
    
    try {
      const healthResult = await performStorageHealthCheck();
      
      console.log('Health check result:', {
        success: healthResult.success,
        healthStatus: healthResult.data?.healthStatus,
        issuesFound: healthResult.data?.issues.length || 0,
        repairsPerformed: healthResult.data?.repairsPerformed.length || 0,
        recommendations: healthResult.data?.recommendations.length || 0,
      });
      
      if (healthResult.success && healthResult.data) {
        console.log('Issues found:', healthResult.data.issues);
        console.log('Repairs performed:', healthResult.data.repairsPerformed);
        console.log('Recommendations:', healthResult.data.recommendations);
      }
      
    } catch (error) {
      console.error('Health check test failed:', error);
    }
  }

  /**
   * Test exponential backoff retry mechanism
   */
  static async testRetryMechanism(): Promise<void> {
    console.log('Testing retry mechanism...');
    
    try {
      // Force a temporary error condition
      const originalSetItem = localStorage.setItem;
      let attemptCount = 0;
      
      localStorage.setItem = function(key: string, value: string) {
        attemptCount++;
        if (attemptCount < 3) {
          throw new DOMException('Mock storage error', 'QuotaExceededError');
        }
        return originalSetItem.call(this, key, value);
      };
      
      const testSummary = StorageErrorTester.createTestSummary();
      const saveResult = await saveVisitSummary(testSummary);
      
      console.log('Retry mechanism result:', {
        success: saveResult.success,
        attempts: attemptCount,
        retryCount: saveResult.metadata?.retryCount,
      });
      
      // Restore original function
      localStorage.setItem = originalSetItem;
      
    } catch (error) {
      console.error('Retry test failed:', error);
    }
  }

  /**
   * Run comprehensive test suite
   */
  static async runAllTests(): Promise<void> {
    console.log('Starting comprehensive storage error handling tests...\n');
    
    const tests = [
      StorageErrorTester.testCorruptedDataRecovery,
      StorageErrorTester.testDataMigration,
      StorageErrorTester.testConcurrentAccess,
      StorageErrorTester.testStorageHealthCheck,
      StorageErrorTester.testRetryMechanism,
      // Quota and compatibility tests may disrupt the browser. Run manually.
    ];
    
    for (const test of tests) {
      try {
        await test();
        console.log('Test completed\n');
      } catch (error) {
        console.error('Test failed:', error, '\n');
      }
    }
    
    console.log('All tests completed!');
  }

  /**
   * Create a test visit summary
   */
  private static createTestSummary(id?: string): VisitSummary {
    const messages: EnhancedMessage[] = [
      {
        id: 'test-1',
        role: 'user',
        content: 'I have a headache',
        timestamp: new Date(),
      },
      {
        id: 'test-2',
        role: 'assistant',
        content: 'I understand you have a headache. Can you describe the severity?',
        timestamp: new Date(),
        reasoning: {
          careLevel: 'primary',
          careLevelJustification: 'Mild symptom assessment needed',
          redFlags: [],
          observations: ['Patient reports headache'],
          nextSteps: ['Assess severity and duration'],
        },
      },
    ];
    
    return createVisitSummary(messages, id);
  }

  /**
   * Create a large dummy summary to test quota limits
   */
  private static createLargeDummySummary(): VisitSummary {
    const baseSummary = StorageErrorTester.createTestSummary('large-test');
    
    // Add large amounts of data to trigger quota issues
    baseSummary.topics = Array(1000).fill('large-topic-data-'.repeat(10));
    baseSummary.emergencyFlags = Array(500).fill('large-emergency-flag-data-'.repeat(10));
    baseSummary.keyFindings = Array(500).fill('large-finding-data-'.repeat(10));
    baseSummary.recommendations = Array(500).fill('large-recommendation-data-'.repeat(10));
    
    return baseSummary;
  }

  /**
   * Get current storage health status
   */
  static getStorageHealthStatus(): any {
    return safeLocalStorage.getHealthStatus();
  }

  /**
   * Clear test data from storage
   */
  static async clearTestData(): Promise<void> {
    try {
      await safeLocalStorage.removeItem('triage_visit_summaries');
      console.log('Test data cleared');
    } catch (error) {
      console.error('Failed to clear test data:', error);
    }
  }
}

/**
 * Browser console utilities for manual testing
 */
declare global {
  interface Window {
    testStorageErrorHandling: {
      runAllTests: () => Promise<void>;
      testQuotaExceeded: () => Promise<void>;
      testCorruptedData: () => Promise<void>;
      testBrowserCompatibility: () => Promise<void>;
      testConcurrentAccess: () => Promise<void>;
      testDataMigration: () => Promise<void>;
      testHealthCheck: () => Promise<void>;
      testRetryMechanism: () => Promise<void>;
      getHealthStatus: () => any;
      clearTestData: () => Promise<void>;
    };
  }
}

// Export test utilities to browser console for manual testing
if (typeof window !== 'undefined') {
  window.testStorageErrorHandling = {
    runAllTests: StorageErrorTester.runAllTests,
    testQuotaExceeded: StorageErrorTester.testQuotaExceeded,
    testCorruptedData: StorageErrorTester.testCorruptedDataRecovery,
    testBrowserCompatibility: StorageErrorTester.testBrowserCompatibility,
    testConcurrentAccess: StorageErrorTester.testConcurrentAccess,
    testDataMigration: StorageErrorTester.testDataMigration,
    testHealthCheck: StorageErrorTester.testStorageHealthCheck,
    testRetryMechanism: StorageErrorTester.testRetryMechanism,
    getHealthStatus: StorageErrorTester.getStorageHealthStatus,
    clearTestData: StorageErrorTester.clearTestData,
  };
}