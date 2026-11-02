/**
 * User-Level Rate Limiter for Triage API
 *
 * Limits requests per user ID to prevent abuse and control costs.
 * Uses Supabase for distributed rate limiting in a serverless environment.
 */

import { createClient } from '@supabase/supabase-js';

export class UserRateLimiter {
  private supabase;
  private limits: Map<string, { max: number; windowMs: number }>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Define different rate limits for different user tiers or request types
    this.limits = new Map([
      ['default', { max: 15, windowMs: 60 * 60 * 1000 }], // 15 requests per hour
      ['premium', { max: 100, windowMs: 60 * 60 * 1000 }], // 100 requests per hour
      ['emergency', { max: 50, windowMs: 60 * 60 * 1000 }], // 50 requests per hour for emergency users
    ]);
  }

  /**
   * Check if a user has exceeded their rate limit.
   */
  async check(
    userId: string,
    tier: 'default' | 'premium' | 'emergency' = 'default'
  ): Promise<{
    isRateLimited: boolean;
    remaining: number;
    resetTime: Date;
    requestCount: number;
  }> {
    const limit = this.limits.get(tier)!;
    const now = Date.now();
    const windowStart = new Date(now - limit.windowMs).toISOString();

    try {
      const { count, error } = await this.supabase
        .from('request_logs') // A new table to log requests
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', windowStart);

      if (error) {
        console.error('Rate limit check failed:', error);
        // Fail open: don't rate limit if the check fails
        return {
          isRateLimited: false,
          remaining: limit.max,
          resetTime: new Date(now + limit.windowMs),
          requestCount: 0,
        };
      }

      const requestCount = count || 0;
      const remaining = Math.max(0, limit.max - requestCount);
      const isRateLimited = remaining <= 0;

      // Log the request *after* checking the limit (only if not rate limited)
      if (!isRateLimited) {
        await this.logRequest(userId, tier);
      }

      return {
        isRateLimited,
        remaining,
        resetTime: new Date(now + limit.windowMs),
        requestCount,
      };
    } catch (err) {
      console.error('Supabase query error in rate limiter:', err);
      // Fail open on database errors
      return {
        isRateLimited: false,
        remaining: limit.max,
        resetTime: new Date(now + limit.windowMs),
        requestCount: 0,
      };
    }
  }

  /**
   * Log a request to be counted against the rate limit.
   */
  private async logRequest(userId: string, tier: string): Promise<void> {
    try {
      await this.supabase.from('request_logs').insert({
        user_id: userId,
        tier: tier,
        ip_address: null, // Could be populated from request headers
        user_agent: null, // Could be populated from request headers
      });
    } catch (error) {
      console.error('Failed to log request for rate limiting:', error);
    }
  }

  /**
   * Get current rate limit status for a user without counting as a request
   */
  async getStatus(
    userId: string,
    tier: 'default' | 'premium' | 'emergency' = 'default'
  ): Promise<{
    requestCount: number;
    remaining: number;
    resetTime: Date;
    limit: number;
  }> {
    const limit = this.limits.get(tier)!;
    const now = Date.now();
    const windowStart = new Date(now - limit.windowMs).toISOString();

    try {
      const { count, error } = await this.supabase
        .from('request_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', windowStart);

      if (error) {
        console.error('Rate limit status check failed:', error);
        return {
          requestCount: 0,
          remaining: limit.max,
          resetTime: new Date(now + limit.windowMs),
          limit: limit.max,
        };
      }

      const requestCount = count || 0;
      const remaining = Math.max(0, limit.max - requestCount);

      return {
        requestCount,
        remaining,
        resetTime: new Date(now + limit.windowMs),
        limit: limit.max,
      };
    } catch (err) {
      console.error('Supabase query error in rate limiter status:', err);
      return {
        requestCount: 0,
        remaining: limit.max,
        resetTime: new Date(now + limit.windowMs),
        limit: limit.max,
      };
    }
  }

  /**
   * Clean up old request logs (should be run periodically)
   */
  async cleanup(olderThanHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date(
        Date.now() - olderThanHours * 60 * 60 * 1000
      ).toISOString();

      const { count, error } = await this.supabase
        .from('request_logs')
        .delete()
        .lt('created_at', cutoffTime);

      if (error) {
        console.error('Request logs cleanup failed:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Request logs cleanup failed:', error);
      return 0;
    }
  }
}

let globalUserRateLimiter: UserRateLimiter | null = null;

export function getUserRateLimiter(): UserRateLimiter {
  if (!globalUserRateLimiter) {
    globalUserRateLimiter = new UserRateLimiter();
  }
  return globalUserRateLimiter;
}
