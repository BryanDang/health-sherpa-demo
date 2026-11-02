/**
 * Response Cache System
 * Minimal implementation for medical triage response caching
 * Medical Safety: Emergency responses are never cached
 */

import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export interface CacheEntry {
  inputHash: string;
  cachedResponse: any;
  urgencyLevel: 'emergency' | 'urgent' | 'routine' | 'self-care';
  modelUsed: string;
  expiresAt: Date;
}

export interface CacheHitResult {
  hit: boolean;
  response?: any;
  hitCount?: number;
}

export class ResponseCache {
  private supabase;

  // Cache TTL strategy - medical safety first
  private static readonly TTL_SECONDS = {
    emergency: 0, // Never cache emergency responses
    urgent: 300, // 5 minutes for urgent
    routine: 1800, // 30 minutes for routine
    'self-care': 3600, // 1 hour for self-care
  };

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Generate cache key from user input (privacy-safe)
   * Removes PII and creates consistent hash
   */
  private generateCacheKey(userInput: string): string {
    // Sanitize input - remove potential PII patterns
    const sanitized = userInput
      .toLowerCase()
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]') // SSN
      .replace(/\b\d{4}-\d{4}-\d{4}-\d{4}\b/g, '[CARD]') // Credit card
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[EMAIL]'
      ) // Email
      .trim();

    return createHash('sha256').update(sanitized).digest('hex');
  }

  /**
   * Attempt to retrieve cached response
   */
  async get(userInput: string): Promise<CacheHitResult> {
    try {
      const cacheKey = this.generateCacheKey(userInput);

      const { data, error } = await this.supabase
        .from('response_cache')
        .select('cached_response, hit_count')
        .eq('input_hash', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        return { hit: false };
      }

      // Update hit count and last accessed
      await this.supabase
        .from('response_cache')
        .update({
          hit_count: (data.hit_count || 0) + 1,
          last_accessed: new Date().toISOString(),
        })
        .eq('input_hash', cacheKey);

      return {
        hit: true,
        response: data.cached_response,
        hitCount: data.hit_count + 1,
      };
    } catch (error) {
      console.warn('Cache get failed:', error);
      return { hit: false }; // Graceful degradation
    }
  }

  /**
   * Store response in cache (if appropriate)
   */
  async set(
    userInput: string,
    response: any,
    urgencyLevel: keyof typeof ResponseCache.TTL_SECONDS,
    modelUsed: string
  ): Promise<void> {
    try {
      // Medical safety: Never cache emergency responses
      if (urgencyLevel === 'emergency') {
        return;
      }

      const cacheKey = this.generateCacheKey(userInput);
      const ttlSeconds = ResponseCache.TTL_SECONDS[urgencyLevel];
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const { error } = await this.supabase.from('response_cache').upsert({
        input_hash: cacheKey,
        cached_response: response,
        urgency_level: urgencyLevel,
        model_used: modelUsed,
        expires_at: expiresAt.toISOString(),
        hit_count: 0,
      });

      if (error) {
        console.warn('Cache set failed:', error);
        // Continue without caching - don't break the response
      }
    } catch (error) {
      console.warn('Cache set failed:', error);
      // Graceful degradation - don't break the response
    }
  }

  /**
   * Get cache analytics for monitoring
   */
  async getAnalytics(hours: number = 24): Promise<{
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    byUrgency: Record<string, number>;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from('response_cache')
        .select('hit_count, urgency_level')
        .gte('created_at', since);

      if (error || !data) {
        return { totalHits: 0, totalMisses: 0, hitRate: 0, byUrgency: {} };
      }

      const totalHits = data.reduce(
        (sum, entry) => sum + (entry.hit_count || 0),
        0
      );
      const byUrgency = data.reduce(
        (acc, entry) => {
          acc[entry.urgency_level] =
            (acc[entry.urgency_level] || 0) + (entry.hit_count || 0);
          return acc;
        },
        {} as Record<string, number>
      );

      // Estimate misses based on total requests (simplified)
      const totalRequests = totalHits + data.length; // Approximate
      const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

      return {
        totalHits,
        totalMisses: data.length,
        hitRate: Math.round(hitRate * 100) / 100,
        byUrgency,
      };
    } catch (error) {
      console.warn('Cache analytics failed:', error);
      return { totalHits: 0, totalMisses: 0, hitRate: 0, byUrgency: {} };
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('response_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.warn('Cache cleanup failed:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
      return 0;
    }
  }
}
