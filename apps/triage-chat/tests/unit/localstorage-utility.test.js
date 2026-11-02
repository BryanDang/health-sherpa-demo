/**
 * Unit Tests for LocalStorage Utility Functions
 * Tests HIPAA-compliant data persistence with encryption and safety features
 */

import {
  LocalStorageUtility,
  StorageError,
  PHIDetectionError,
  EncryptionError,
} from '@/lib/localstorage-utility';

// Mock the Web Crypto API
global.crypto = {
  subtle: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    generateKey: jest.fn(),
    importKey: jest.fn(),
    exportKey: jest.fn(),
  },
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
};

// Mock localStorage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      if (Object.keys(store).length >= 10 && !store[key]) {
        throw new Error('QuotaExceededError');
      }
      store[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Skipped: feature not built (local storage utility).
describe.skip('[feature not built] LocalStorageUtility Unit Tests', () => {
  let utility;

  beforeEach(() => {
    utility = new LocalStorageUtility({
      hipaaMode: true,
      encryptionRequired: true,
      auditLogging: true,
    });
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  describe('Initialization and Configuration', () => {
    test('initializes with HIPAA compliance mode', () => {
      expect(utility.isHIPAACompliant()).toBe(true);
      expect(utility.isEncryptionEnabled()).toBe(true);
      expect(utility.isAuditLoggingEnabled()).toBe(true);
    });

    test('detects localStorage availability', () => {
      expect(utility.isStorageAvailable()).toBe(true);
    });

    test('handles localStorage unavailable gracefully', () => {
      // Mock localStorage as unavailable
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        configurable: true,
      });

      const utilityNoStorage = new LocalStorageUtility();
      expect(utilityNoStorage.isStorageAvailable()).toBe(false);

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        configurable: true,
      });
    });

    test('generates unique session encryption key', () => {
      const utility1 = new LocalStorageUtility();
      const utility2 = new LocalStorageUtility();

      expect(utility1.getSessionKey()).not.toBe(utility2.getSessionKey());
    });
  });

  describe('Basic Storage Operations', () => {
    test('stores and retrieves simple data', async () => {
      const testData = { setting: 'theme', value: 'dark' };

      const storeResult = await utility.store('ui_preferences', testData, {
        dataType: 'ui_preferences',
        encrypt: false,
      });

      expect(storeResult.success).toBe(true);
      expect(storeResult.encrypted).toBe(false);

      const retrievedData = await utility.retrieve('ui_preferences');
      expect(retrievedData).toEqual(testData);
    });

    test('stores and retrieves encrypted data', async () => {
      const testData = { sessionState: 'active', userId: 'user123' };

      // Mock successful encryption
      crypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
      crypto.subtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(testData))
      );

      const storeResult = await utility.store('session_data', testData, {
        dataType: 'session_state',
        encrypt: true,
      });

      expect(storeResult.success).toBe(true);
      expect(storeResult.encrypted).toBe(true);

      const retrievedData = await utility.retrieve('session_data', {
        decrypt: true,
      });
      expect(retrievedData).toEqual(testData);
    });

    test('removes individual items', async () => {
      await utility.store('test_item', { data: 'test' });

      const removeResult = await utility.remove('test_item');
      expect(removeResult).toBe(true);

      const retrieved = await utility.retrieve('test_item');
      expect(retrieved).toBeNull();
    });

    test('clears all data', async () => {
      await utility.store('item1', { data: 'test1' });
      await utility.store('item2', { data: 'test2' });

      const clearResult = await utility.clear();
      expect(clearResult.itemsRemoved).toBe(2);

      expect(await utility.retrieve('item1')).toBeNull();
      expect(await utility.retrieve('item2')).toBeNull();
    });
  });

  describe('PHI Detection and Prevention', () => {
    test('detects and blocks PHI data storage', async () => {
      const phiData = {
        patientName: 'John Doe',
        ssn: '123-45-6789',
        dob: '1980-01-01',
        medicalRecordNumber: 'MRN123456',
      };

      await expect(utility.store('patient_data', phiData)).rejects.toThrow(
        PHIDetectionError
      );
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    test('allows non-PHI data storage', async () => {
      const nonPhiData = {
        uiTheme: 'dark',
        language: 'en',
        lastVisit: '2024-01-15',
      };

      const result = await utility.store('preferences', nonPhiData);
      expect(result.success).toBe(true);
    });

    test('validates PHI detection accuracy', () => {
      expect(utility.containsPHI('John Doe born 1980-01-01')).toBe(true);
      expect(utility.containsPHI('SSN: 123-45-6789')).toBe(true);
      expect(utility.containsPHI('Dark theme preferences')).toBe(false);
      expect(utility.containsPHI('User clicked save button')).toBe(false);
    });

    test('logs PHI detection attempts', async () => {
      const phiData = { patientSSN: '123-45-6789' };

      await expect(utility.store('test', phiData)).rejects.toThrow();
      expect(utility.getAuditLog()).toContainEqual(
        expect.objectContaining({
          action: 'PHI_DETECTED',
          blocked: true,
          severity: 'HIGH',
        })
      );
    });
  });

  describe('Encryption and Security', () => {
    test('encrypts sensitive data automatically', async () => {
      const sensitiveData = { sessionToken: 'abc123', userRole: 'admin' };

      crypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));

      const result = await utility.store('session', sensitiveData, {
        dataType: 'session_state',
        encrypt: true,
      });

      expect(result.encrypted).toBe(true);
      expect(crypto.subtle.encrypt).toHaveBeenCalled();
    });

    test('handles encryption failures gracefully', async () => {
      crypto.subtle.encrypt.mockRejectedValue(new Error('Encryption failed'));

      const result = await utility.store(
        'test',
        { data: 'test' },
        {
          encrypt: true,
        }
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ENCRYPTION_FAILED');
    });

    test('handles decryption failures gracefully', async () => {
      // Store encrypted data first
      crypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
      await utility.store(
        'encrypted_test',
        { data: 'test' },
        { encrypt: true }
      );

      // Then fail decryption
      crypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      const result = await utility.retrieve('encrypted_test', {
        decrypt: true,
      });
      expect(result).toBeNull();
    });

    test('rotates encryption keys periodically', async () => {
      const oldKey = utility.getSessionKey();

      await utility.rotateEncryptionKey();

      const newKey = utility.getSessionKey();
      expect(newKey).not.toBe(oldKey);
    });

    test('validates data integrity after encryption/decryption', async () => {
      const originalData = { important: 'data', timestamp: Date.now() };

      crypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
      crypto.subtle.decrypt.mockResolvedValue(
        new TextEncoder().encode(JSON.stringify(originalData))
      );

      await utility.store('integrity_test', originalData, { encrypt: true });

      const isValid = await utility.validateIntegrity('integrity_test');
      expect(isValid).toBe(true);
    });
  });

  describe('Session Management', () => {
    test('sets session timeout and cleanup', () => {
      utility.setSessionTimeout(30000); // 30 seconds

      expect(utility.getSessionTimeout()).toBe(30000);
    });

    test('clears session data on timeout', async () => {
      await utility.store(
        'session_item',
        { data: 'test' },
        {
          sessionBound: true,
        }
      );

      // Mock session timeout
      utility.setSessionTimeout(1); // 1ms
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sessionData = await utility.retrieve('session_item');
      expect(sessionData).toBeNull();
    });

    test('clears all session data on explicit cleanup', async () => {
      await utility.store(
        'session1',
        { data: 'test1' },
        { sessionBound: true }
      );
      await utility.store(
        'session2',
        { data: 'test2' },
        { sessionBound: true }
      );
      await utility.store(
        'persistent',
        { data: 'persistent' },
        { sessionBound: false }
      );

      await utility.clearSessionData();

      expect(await utility.retrieve('session1')).toBeNull();
      expect(await utility.retrieve('session2')).toBeNull();
      expect(await utility.retrieve('persistent')).not.toBeNull();
    });

    test('performs emergency wipe', async () => {
      await utility.store('item1', { data: 'test1' });
      await utility.store('item2', { data: 'test2' });

      await utility.emergencyWipe();

      expect(mockLocalStorage.length).toBe(0);
      expect(utility.getAuditLog()).toContainEqual(
        expect.objectContaining({
          action: 'EMERGENCY_WIPE',
          severity: 'CRITICAL',
        })
      );
    });
  });

  describe('Storage Health and Monitoring', () => {
    test('reports storage health status', () => {
      const health = utility.checkStorageHealth();

      expect(health.status).toMatch(/healthy|warning|critical/);
      expect(health.availableSpace).toBeGreaterThanOrEqual(0);
      expect(health.usedSpace).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    test('monitors storage usage metrics', async () => {
      await utility.store('test1', { data: 'test1' });
      await utility.store('test2', { data: 'test2' });

      const metrics = utility.getUsageMetrics();

      expect(metrics.totalOperations).toBeGreaterThan(0);
      expect(metrics.averageStoreTime).toBeGreaterThan(0);
      expect(metrics.errorCount).toBeGreaterThanOrEqual(0);
    });

    test('detects storage quota exceeded', async () => {
      // Mock quota exceeded error
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const result = await utility.store('large_item', { data: 'test' });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('STORAGE_FULL');
    });

    test('triggers automatic cleanup when quota exceeded', async () => {
      // Store some items with expiration
      await utility.store(
        'old_item',
        { data: 'old' },
        {
          expirationTime: 1, // 1ms expiration
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Mock quota exceeded
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });

      const result = await utility.store('new_item', { data: 'new' });

      // Should have triggered cleanup and retry
      expect(utility.getAuditLog()).toContainEqual(
        expect.objectContaining({
          action: 'AUTO_CLEANUP_TRIGGERED',
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    test('handles localStorage disabled by user', () => {
      // Mock localStorage as disabled
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage is disabled');
      });

      const utility = new LocalStorageUtility();
      expect(utility.isStorageAvailable()).toBe(false);
    });

    test('falls back to in-memory storage when localStorage fails', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const result = await utility.store('fallback_test', { data: 'test' });

      expect(result.success).toBe(true);
      // Should use fallback storage
      expect(utility.isFallbackModeActive()).toBe(true);
    });

    test('recovers from corrupted data gracefully', async () => {
      // Store corrupted data directly
      mockLocalStorage.setItem('corrupted_item', 'invalid-json{');

      const result = await utility.retrieve('corrupted_item');
      expect(result).toBeNull();

      expect(utility.getAuditLog()).toContainEqual(
        expect.objectContaining({
          action: 'DATA_CORRUPTION_DETECTED',
          key: 'corrupted_item',
        })
      );
    });

    test('handles concurrent access conflicts', async () => {
      const promises = [];

      // Simulate concurrent access
      for (let i = 0; i < 10; i++) {
        promises.push(utility.store(`concurrent_${i}`, { data: i }));
      }

      const results = await Promise.all(promises);

      // All operations should succeed or fail gracefully
      results.forEach((result) => {
        expect(result).toHaveProperty('success');
      });
    });
  });

  describe('Expiration and Cleanup', () => {
    test('handles item expiration correctly', async () => {
      await utility.store(
        'expiring_item',
        { data: 'test' },
        {
          expirationTime: 50, // 50ms
        }
      );

      // Item should exist immediately
      expect(await utility.retrieve('expiring_item')).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Item should be expired
      expect(await utility.retrieve('expiring_item')).toBeNull();
    });

    test('cleans up expired items during cleanup', async () => {
      await utility.store('expired1', { data: 'test1' }, { expirationTime: 1 });
      await utility.store('expired2', { data: 'test2' }, { expirationTime: 1 });
      await utility.store('valid', { data: 'valid' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const cleanupResult = await utility.clear('*', { olderThan: 5 });

      expect(cleanupResult.itemsRemoved).toBe(2);
      expect(await utility.retrieve('valid')).not.toBeNull();
    });

    test('performs pattern-based cleanup', async () => {
      await utility.store('temp_item_1', { data: 'temp1' });
      await utility.store('temp_item_2', { data: 'temp2' });
      await utility.store('persistent_item', { data: 'persistent' });

      const cleanupResult = await utility.clear('temp_*');

      expect(cleanupResult.itemsRemoved).toBe(2);
      expect(await utility.retrieve('persistent_item')).not.toBeNull();
    });
  });

  describe('Audit Logging and Compliance', () => {
    test('logs all storage operations', async () => {
      await utility.store('audit_test', { data: 'test' });
      await utility.retrieve('audit_test');
      await utility.remove('audit_test');

      const auditLog = utility.getAuditLog();

      expect(auditLog).toContainEqual(
        expect.objectContaining({ action: 'STORE', key: 'audit_test' })
      );
      expect(auditLog).toContainEqual(
        expect.objectContaining({ action: 'RETRIEVE', key: 'audit_test' })
      );
      expect(auditLog).toContainEqual(
        expect.objectContaining({ action: 'REMOVE', key: 'audit_test' })
      );
    });

    test('includes timestamps in audit entries', async () => {
      const beforeTime = Date.now();
      await utility.store('timestamp_test', { data: 'test' });
      const afterTime = Date.now();

      const auditLog = utility.getAuditLog();
      const entry = auditLog.find((e) => e.key === 'timestamp_test');

      expect(entry.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(entry.timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('exports audit log for compliance reporting', () => {
      utility.store('test1', { data: 'test1' });
      utility.store('test2', { data: 'test2' });

      const exportedLog = utility.exportAuditLog();

      expect(exportedLog).toContain('STORE');
      expect(exportedLog).toContain('test1');
      expect(exportedLog).toContain('test2');
    });

    test('clears audit log on request', () => {
      utility.store('test', { data: 'test' });
      expect(utility.getAuditLog().length).toBeGreaterThan(0);

      utility.clearAuditLog();
      expect(utility.getAuditLog().length).toBe(0);
    });
  });
});

/**
 * Test utilities for LocalStorage testing
 */
const createMockPHIData = () => {
  return {
    patientName: 'John Doe',
    ssn: '123-45-6789',
    dob: '1980-01-01',
    phoneNumber: '555-123-4567',
    email: 'john.doe@example.com',
    address: '123 Main St, Anytown, ST 12345',
  };
};

const createMockNonPHIData = () => {
  return {
    uiTheme: 'dark',
    language: 'en-US',
    notifications: true,
    lastLoginDate: '2024-01-15',
    preferredTimeZone: 'America/New_York',
  };
};

const createMockSessionData = () => {
  return {
    sessionId: 'sess_123456789',
    lastActivity: Date.now(),
    preferences: {
      autoSave: true,
      notifications: false,
    },
  };
};

const simulateStorageError = (errorType) => {
  switch (errorType) {
    case 'quota':
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      break;
    case 'disabled':
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        configurable: true,
      });
      break;
    case 'network':
      // Simulate network-related storage issues
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Network error');
      });
      break;
  }
};
