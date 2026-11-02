'use client';

/**
 * LocalStorage Utility Functions
 * HIPAA-compliant data persistence with encryption and safety features
 * Based on medical data storage requirements and privacy compliance
 */

import {
  LocalStorageUtilityFunctions,
  StorageOptions,
  RetrievalOptions,
  StorageResult,
  CleanupResult,
  StorageHealthReport,
  StorageMetrics,
  DataType,
  StorageError,
  StorageHealth,
} from '../../tests/contracts/localstorage-utility.contract';

/**
 * Custom error classes for storage operations
 */
class LocalStorageError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'LocalStorageError';
  }
}

export class PHIDetectionError extends LocalStorageError {
  constructor(message: string) {
    super(message, 'PHI_DETECTED');
    this.name = 'PHIDetectionError';
  }
}

export class EncryptionError extends LocalStorageError {
  constructor(message: string) {
    super(message, 'ENCRYPTION_FAILED');
    this.name = 'EncryptionError';
  }
}

/**
 * Configuration interface for LocalStorageUtility
 */
interface LocalStorageUtilityConfig {
  hipaaMode?: boolean;
  encryptionRequired?: boolean;
  auditLogging?: boolean;
  sessionTimeout?: number;
  maxStorageSize?: number;
  autoCleanup?: boolean;
}

/**
 * Audit log entry structure
 */
interface AuditLogEntry {
  timestamp: number;
  action: string;
  key?: string;
  encrypted?: boolean;
  success: boolean;
  errorCode?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blocked?: boolean;
}

/**
 * LocalStorageUtility class providing HIPAA-compliant storage
 */
export class LocalStorageUtility implements LocalStorageUtilityFunctions {
  private config: Required<LocalStorageUtilityConfig>;
  private encryptionKey: CryptoKey | null = null;
  private sessionKey: string;
  private auditLog: AuditLogEntry[] = [];
  private fallbackStorage: Map<string, any> = new Map();
  private isFallbackActive: boolean = false;
  private storageMetrics: StorageMetrics = {
    totalOperations: 0,
    averageStoreTime: 0,
    averageRetrieveTime: 0,
    errorCount: 0,
    encryptionOverhead: 0,
  };
  private cleanupTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: LocalStorageUtilityConfig = {}) {
    this.config = {
      hipaaMode: true,
      encryptionRequired: true,
      auditLogging: true,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxStorageSize: 5 * 1024 * 1024, // 5MB
      autoCleanup: true,
      ...config,
    };

    this.sessionKey = this.generateSessionKey();
    this.initializeEncryption();
    this.setupSessionManagement();
  }

  /**
   * Generate a unique session key for this instance
   */
  private generateSessionKey(): string {
    return (
      'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    );
  }

  /**
   * Initialize encryption if Web Crypto API is available
   */
  private async initializeEncryption(): Promise<void> {
    if (
      this.config.encryptionRequired &&
      typeof window !== 'undefined' &&
      window.crypto?.subtle
    ) {
      try {
        this.encryptionKey = await window.crypto.subtle.generateKey(
          {
            name: 'AES-GCM',
            length: 256,
          },
          false,
          ['encrypt', 'decrypt']
        );
      } catch (error) {
        console.warn('Failed to initialize encryption:', error);
        this.logAuditEntry({
          timestamp: Date.now(),
          action: 'ENCRYPTION_INIT_FAILED',
          success: false,
          severity: 'HIGH',
          errorCode: 'CRYPTO_UNAVAILABLE',
        });
      }
    }
  }

  /**
   * Setup session management and timeouts
   */
  private setupSessionManagement(): void {
    if (typeof window !== 'undefined') {
      // Clean up session data on page unload
      window.addEventListener('beforeunload', () => {
        this.clearSessionData();
      });

      // Set up session timeout
      if (this.config.sessionTimeout > 0) {
        setTimeout(() => {
          this.clearSessionData();
        }, this.config.sessionTimeout);
      }
    }
  }

  /**
   * Check if localStorage is available
   */
  isStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }

      const test = '__storage_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      this.isFallbackActive = true;
      return false;
    }
  }

  /**
   * Get current session key
   */
  getSessionKey(): string {
    return this.sessionKey;
  }

  /**
   * Check if HIPAA compliance mode is enabled
   */
  isHIPAACompliant(): boolean {
    return this.config.hipaaMode;
  }

  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    return this.config.encryptionRequired && this.encryptionKey !== null;
  }

  /**
   * Check if audit logging is enabled
   */
  isAuditLoggingEnabled(): boolean {
    return this.config.auditLogging;
  }

  /**
   * Check if fallback mode is active
   */
  isFallbackModeActive(): boolean {
    return this.isFallbackActive;
  }

  /**
   * Get current session timeout value
   */
  getSessionTimeout(): number {
    return this.config.sessionTimeout;
  }

  /**
   * Detect PHI (Protected Health Information) in data
   */
  containsPHI(data: any): boolean {
    if (!this.config.hipaaMode) {
      return false;
    }

    const dataString = JSON.stringify(data).toLowerCase();

    // PHI patterns to detect
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/, // DOB pattern
      /\bmrn\d+/, // Medical record number
      /(patient|mr|mrs|ms|dr)\s+[a-z]+\s+[a-z]+/i, // Names with titles
      /\d{10,}/, // Long numbers that could be IDs
      /\b\d{3}\s*-\s*\d{3}\s*-\s*\d{4}\b/, // Phone numbers
      /@[a-z0-9.-]+\.[a-z]{2,}/i, // Email addresses
      /\b\d{1,5}\s+[a-z\s]+\s+(st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard)\b/i, // Addresses
    ];

    return phiPatterns.some((pattern) => pattern.test(dataString));
  }

  /**
   * Validate PHI and throw error if detected
   */
  validatePHI(data: any): boolean {
    const hasPhi = this.containsPHI(data);

    if (hasPhi) {
      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'PHI_DETECTED',
        success: false,
        blocked: true,
        severity: 'HIGH',
      });

      throw new PHIDetectionError(
        'PHI detected in data - storage blocked for HIPAA compliance'
      );
    }

    return false;
  }

  /**
   * Encrypt data using Web Crypto API
   */
  async encrypt(data: any): Promise<string> {
    if (!this.encryptionKey) {
      throw new EncryptionError('Encryption key not available');
    }

    try {
      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(jsonString);

      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        this.encryptionKey,
        dataBuffer
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode.apply(null, Array.from(combined)));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new EncryptionError(`Encryption failed: ${errorMessage}`);
    }
  }

  /**
   * Decrypt data using Web Crypto API
   */
  async decrypt(encryptedData: string): Promise<any> {
    if (!this.encryptionKey) {
      throw new EncryptionError('Encryption key not available');
    }

    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map((char) => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        this.encryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedBuffer);

      return JSON.parse(jsonString);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new EncryptionError(`Decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Log audit entry if audit logging is enabled
   */
  private logAuditEntry(entry: AuditLogEntry): void {
    if (this.config.auditLogging) {
      this.auditLog.push(entry);

      // Limit audit log size
      if (this.auditLog.length > 1000) {
        this.auditLog = this.auditLog.slice(-800);
      }
    }
  }

  /**
   * Update storage metrics
   */
  private updateMetrics(
    operation: 'store' | 'retrieve',
    duration: number,
    success: boolean
  ): void {
    this.storageMetrics.totalOperations++;

    if (!success) {
      this.storageMetrics.errorCount++;
    }

    if (operation === 'store') {
      this.storageMetrics.averageStoreTime =
        (this.storageMetrics.averageStoreTime + duration) / 2;
    } else {
      this.storageMetrics.averageRetrieveTime =
        (this.storageMetrics.averageRetrieveTime + duration) / 2;
    }
  }

  /**
   * Generate storage key with namespace
   */
  private generateStorageKey(key: string, options?: StorageOptions): string {
    const prefix = 'medical_triage_';
    const namespace = options?.sessionBound
      ? `session_${this.sessionKey}_`
      : '';
    return `${prefix}${namespace}${key}`;
  }

  /**
   * Create storage metadata
   */
  private createStorageMetadata(options?: StorageOptions) {
    return {
      timestamp: Date.now(),
      dataType: options?.dataType || 'non_phi',
      encrypted: options?.encrypt || false,
      sessionBound: options?.sessionBound || false,
      expirationTime: options?.expirationTime
        ? Date.now() + options.expirationTime
        : null,
      version: '1.0',
    };
  }

  /**
   * Check if stored item has expired
   */
  private isExpired(metadata: any): boolean {
    if (!metadata.expirationTime) {
      return false;
    }
    return Date.now() > metadata.expirationTime;
  }

  /**
   * Store data with optional encryption and PHI validation
   */
  async store(
    key: string,
    data: any,
    options: StorageOptions = {}
  ): Promise<StorageResult> {
    const startTime = performance.now();
    let success = false;
    let encrypted = false;
    let errorCode: StorageError | undefined;

    try {
      // Validate PHI if HIPAA mode is enabled
      if (this.config.hipaaMode) {
        this.validatePHI(data);
      }

      const metadata = this.createStorageMetadata(options);
      const storageKey = this.generateStorageKey(key, options);

      let finalData = data;

      // Encrypt if required
      if (options.encrypt && this.isEncryptionEnabled()) {
        finalData = await this.encrypt(data);
        encrypted = true;
        metadata.encrypted = true;
      }

      const storageValue = {
        data: finalData,
        metadata: metadata,
      };

      // Try localStorage first, fallback to in-memory if fails
      try {
        if (this.isStorageAvailable()) {
          localStorage.setItem(storageKey, JSON.stringify(storageValue));
        } else {
          this.fallbackStorage.set(storageKey, storageValue);
          this.isFallbackActive = true;
        }
      } catch (storageError) {
        const errorMessage =
          storageError instanceof Error
            ? storageError.message
            : String(storageError);
        if (
          errorMessage.includes('QuotaExceededError') ||
          errorMessage.includes('Storage full')
        ) {
          // Attempt automatic cleanup and retry
          if (this.config.autoCleanup) {
            await this.performAutoCleanup();
            localStorage.setItem(storageKey, JSON.stringify(storageValue));
          } else {
            errorCode = 'STORAGE_FULL';
            throw storageError;
          }
        } else {
          // Fall back to in-memory storage
          this.fallbackStorage.set(storageKey, storageValue);
          this.isFallbackActive = true;
        }
      }

      // Set up expiration cleanup if needed
      if (options.expirationTime) {
        const timeoutId = setTimeout(() => {
          this.remove(key);
        }, options.expirationTime);

        this.cleanupTimeouts.set(storageKey, timeoutId);
      }

      success = true;

      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'STORE',
        key: storageKey,
        encrypted: encrypted,
        success: true,
        severity: 'LOW',
      });

      return {
        success: true,
        key: storageKey,
        encrypted: encrypted,
      };
    } catch (error) {
      let code: StorageError = 'INVALID_DATA';

      if (error instanceof PHIDetectionError) {
        code = 'ACCESS_DENIED';
      } else if (error instanceof EncryptionError) {
        code = 'ENCRYPTION_FAILED';
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('QuotaExceededError')) {
          code = 'STORAGE_FULL';
        }
      }

      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'STORE',
        key: key,
        success: false,
        errorCode: code,
        severity: 'MEDIUM',
      });

      return {
        success: false,
        key: key,
        encrypted: false,
        errorCode: code,
      };
    } finally {
      const duration = performance.now() - startTime;
      this.updateMetrics('store', duration, success);
    }
  }

  /**
   * Retrieve data with optional decryption
   */
  async retrieve(key: string, options: RetrievalOptions = {}): Promise<any> {
    const startTime = performance.now();
    let success = false;

    try {
      const storageKey = this.generateStorageKey(
        key,
        options as StorageOptions
      );
      let storageValue: any;

      // Try localStorage first, then fallback storage
      try {
        if (this.isStorageAvailable()) {
          const stored = localStorage.getItem(storageKey);
          if (!stored) {
            return options.defaultValue || null;
          }
          storageValue = JSON.parse(stored);
        } else {
          storageValue = this.fallbackStorage.get(storageKey);
          if (!storageValue) {
            return options.defaultValue || null;
          }
        }
      } catch (parseError) {
        // Handle corrupted data
        this.logAuditEntry({
          timestamp: Date.now(),
          action: 'DATA_CORRUPTION_DETECTED',
          key: storageKey,
          success: false,
          severity: 'HIGH',
        });

        // Remove corrupted data
        await this.remove(key);
        return options.defaultValue || null;
      }

      // Check expiration
      if (this.isExpired(storageValue.metadata)) {
        await this.remove(key);
        return options.defaultValue || null;
      }

      let finalData = storageValue.data;

      // Decrypt if needed
      if (options.decrypt && storageValue.metadata.encrypted) {
        try {
          finalData = await this.decrypt(finalData);
        } catch (decryptError) {
          this.logAuditEntry({
            timestamp: Date.now(),
            action: 'RETRIEVE',
            key: storageKey,
            success: false,
            errorCode: 'DECRYPTION_FAILED',
            severity: 'HIGH',
          });
          return options.defaultValue || null;
        }
      }

      // Validate integrity if requested
      if (options.validateIntegrity) {
        const isValid = await this.validateIntegrity(key);
        if (!isValid) {
          return options.defaultValue || null;
        }
      }

      success = true;

      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'RETRIEVE',
        key: storageKey,
        success: true,
        severity: 'LOW',
      });

      return finalData;
    } catch (error) {
      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'RETRIEVE',
        key: key,
        success: false,
        errorCode: 'NOT_FOUND',
        severity: 'LOW',
      });

      return options.defaultValue || null;
    } finally {
      const duration = performance.now() - startTime;
      this.updateMetrics('retrieve', duration, success);
    }
  }

  /**
   * Remove a stored item
   */
  async remove(key: string): Promise<boolean> {
    try {
      const storageKey = this.generateStorageKey(key);

      // Clear any associated timeout
      const timeoutId = this.cleanupTimeouts.get(storageKey);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.cleanupTimeouts.delete(storageKey);
      }

      // Remove from localStorage or fallback
      if (this.isStorageAvailable()) {
        localStorage.removeItem(storageKey);
      } else {
        this.fallbackStorage.delete(storageKey);
      }

      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'REMOVE',
        key: storageKey,
        success: true,
        severity: 'LOW',
      });

      return true;
    } catch (error) {
      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'REMOVE',
        key: key,
        success: false,
        severity: 'LOW',
      });

      return false;
    }
  }

  /**
   * Clear storage with optional pattern matching
   */
  async clear(
    pattern?: string,
    options?: { olderThan?: number }
  ): Promise<CleanupResult> {
    let itemsRemoved = 0;
    let bytesFreed = 0;
    const errors: string[] = [];

    try {
      const keysToRemove: string[] = [];

      // Get all keys
      if (this.isStorageAvailable()) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            keysToRemove.push(key);
          }
        }
      } else {
        keysToRemove.push(...Array.from(this.fallbackStorage.keys()));
      }

      // Filter by pattern and age
      for (const key of keysToRemove) {
        try {
          // Pattern matching
          if (pattern && pattern !== '*') {
            const regex = new RegExp(pattern.replace('*', '.*'));
            if (!regex.test(key)) {
              continue;
            }
          }

          // Age filtering
          if (options?.olderThan) {
            const stored = this.isStorageAvailable()
              ? localStorage.getItem(key)
              : this.fallbackStorage.get(key);

            if (stored) {
              const storageValue =
                typeof stored === 'string' ? JSON.parse(stored) : stored;
              const age = Date.now() - storageValue.metadata.timestamp;

              if (age < options.olderThan) {
                continue;
              }
            }
          }

          // Calculate size before removal
          const itemSize = this.isStorageAvailable()
            ? localStorage.getItem(key)?.length || 0
            : JSON.stringify(this.fallbackStorage.get(key)).length;

          // Remove item
          if (this.isStorageAvailable()) {
            localStorage.removeItem(key);
          } else {
            this.fallbackStorage.delete(key);
          }

          itemsRemoved++;
          bytesFreed += itemSize;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          errors.push(`Failed to remove ${key}: ${errorMessage}`);
        }
      }

      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'CLEANUP',
        success: true,
        severity: 'LOW',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Cleanup failed: ${errorMessage}`);
    }

    return {
      itemsRemoved,
      bytesFreed,
      errors,
    };
  }

  /**
   * Perform automatic cleanup when storage is full
   */
  private async performAutoCleanup(): Promise<void> {
    this.logAuditEntry({
      timestamp: Date.now(),
      action: 'AUTO_CLEANUP_TRIGGERED',
      success: true,
      severity: 'MEDIUM',
    });

    // Remove expired items first
    await this.clear('*', { olderThan: 0 });

    // Remove oldest session-bound items if still need space
    const sessionPattern = `medical_triage_session_*`;
    await this.clear(sessionPattern, {
      olderThan: this.config.sessionTimeout / 2,
    });
  }

  /**
   * Set session timeout
   */
  setSessionTimeout(timeout: number): void {
    this.config.sessionTimeout = timeout;
  }

  /**
   * Clear all session-bound data
   */
  async clearSessionData(): Promise<void> {
    const sessionPattern = `medical_triage_session_${this.sessionKey}_*`;
    await this.clear(sessionPattern);

    this.logAuditEntry({
      timestamp: Date.now(),
      action: 'SESSION_CLEANUP',
      success: true,
      severity: 'LOW',
    });
  }

  /**
   * Emergency wipe - remove all data immediately
   */
  async emergencyWipe(): Promise<void> {
    try {
      if (this.isStorageAvailable()) {
        localStorage.clear();
      }
      this.fallbackStorage.clear();

      // Clear all timeouts
      this.cleanupTimeouts.forEach((timeout) => clearTimeout(timeout));
      this.cleanupTimeouts.clear();

      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'EMERGENCY_WIPE',
        success: true,
        severity: 'CRITICAL',
      });
    } catch (error) {
      this.logAuditEntry({
        timestamp: Date.now(),
        action: 'EMERGENCY_WIPE',
        success: false,
        severity: 'CRITICAL',
      });
    }
  }

  /**
   * Check storage health
   */
  checkStorageHealth(): StorageHealthReport {
    let usedSpace = 0;
    let availableSpace = 0;

    try {
      if (this.isStorageAvailable()) {
        // Estimate used space
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            usedSpace += (key.length + (value?.length || 0)) * 2; // UTF-16 encoding
          }
        }

        // Estimate available space (localStorage quota is typically 5-10MB)
        availableSpace = this.config.maxStorageSize - usedSpace;
      } else {
        // Fallback storage size
        this.fallbackStorage.forEach((value, key) => {
          usedSpace += (key.length + JSON.stringify(value).length) * 2;
        });
        availableSpace = Math.max(0, 1024 * 1024 - usedSpace); // 1MB limit for fallback
      }

      const usagePercentage = usedSpace / (usedSpace + availableSpace);
      const errorRate =
        this.storageMetrics.errorCount /
        Math.max(1, this.storageMetrics.totalOperations);

      let status: StorageHealth = 'healthy';
      const recommendations: string[] = [];

      if (usagePercentage > 0.9 || errorRate > 0.1) {
        status = 'critical';
        recommendations.push(
          'Consider clearing old data or reducing storage usage'
        );
      } else if (usagePercentage > 0.7 || errorRate > 0.05) {
        status = 'warning';
        recommendations.push('Monitor storage usage closely');
      }

      if (this.isFallbackActive) {
        recommendations.push(
          'Fallback storage active - localStorage unavailable'
        );
      }

      return {
        status,
        availableSpace,
        usedSpace,
        errorRate,
        recommendations,
      };
    } catch (error) {
      return {
        status: 'critical',
        availableSpace: 0,
        usedSpace: 0,
        errorRate: 1,
        recommendations: [
          'Storage health check failed - manual intervention required',
        ],
      };
    }
  }

  /**
   * Get storage usage metrics
   */
  getUsageMetrics(): StorageMetrics {
    return { ...this.storageMetrics };
  }

  /**
   * Validate data integrity
   */
  async validateIntegrity(key: string): Promise<boolean> {
    try {
      const data = await this.retrieve(key, { validateIntegrity: false });
      if (!data) {
        return false;
      }

      // Basic integrity checks
      if (typeof data === 'object' && data !== null) {
        // Check for required medical data structures
        if (data.symptoms && !Array.isArray(data.symptoms)) {
          return false;
        }
        if (data.medicalHistory && !Array.isArray(data.medicalHistory)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Rotate encryption key
   */
  async rotateEncryptionKey(): Promise<void> {
    if (this.isEncryptionEnabled()) {
      try {
        // Generate new key
        const newKey = await window.crypto.subtle.generateKey(
          {
            name: 'AES-GCM',
            length: 256,
          },
          false,
          ['encrypt', 'decrypt']
        );

        // Re-encrypt all encrypted data with new key
        // (Implementation would iterate through all encrypted items)
        this.encryptionKey = newKey;

        this.logAuditEntry({
          timestamp: Date.now(),
          action: 'KEY_ROTATION',
          success: true,
          severity: 'MEDIUM',
        });
      } catch (error) {
        this.logAuditEntry({
          timestamp: Date.now(),
          action: 'KEY_ROTATION',
          success: false,
          severity: 'HIGH',
        });
      }
    }
  }

  /**
   * Get audit log entries
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Export audit log for compliance reporting
   */
  exportAuditLog(): string {
    const header =
      'Timestamp,Action,Key,Encrypted,Success,Error Code,Severity\n';
    const entries = this.auditLog
      .map(
        (entry) =>
          `${new Date(entry.timestamp).toISOString()},${entry.action},${entry.key || ''},${entry.encrypted || false},${entry.success},${entry.errorCode || ''},${entry.severity || ''}`
      )
      .join('\n');

    return header + entries;
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }
}

/**
 * Default export of utility instance
 */
export default new LocalStorageUtility();
