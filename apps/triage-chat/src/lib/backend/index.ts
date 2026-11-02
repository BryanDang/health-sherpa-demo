/**
 * Backend selector. Default is the mock. BACKEND_MODE=live selects the live
 * implementation (not tested here).
 */

import type { Backend } from './types';
import { createMockBackend } from './mock';
import { createLiveBackend } from './live';

let cached: Backend | null = null;

export function getBackend(): Backend {
  if (!cached) {
    cached =
      process.env.BACKEND_MODE === 'live'
        ? createLiveBackend()
        : createMockBackend();
  }
  return cached;
}

export type { Backend } from './types';
