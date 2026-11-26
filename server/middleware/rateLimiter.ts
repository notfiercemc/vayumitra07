import type { NextFunction, Request, Response } from 'express';

interface WindowBucket {
  count: number;
  resetAt: number;
}

export interface ApiQuotaStats {
  totalRequests: number;
  cacheHits: number;
  upstreamCalls: {
    openaq: number;
    openMeteo: number;
    openWeather: number;
    news: number;
    gemini: number;
  };
  rateLimitedCount: number;
  startedAt: string;
}

class QuotaTracker {
  private stats: ApiQuotaStats = {
    totalRequests: 0,
    cacheHits: 0,
    upstreamCalls: {
      openaq: 0,
      openMeteo: 0,
      openWeather: 0,
      news: 0,
      gemini: 0,
    },
    rateLimitedCount: 0,
    startedAt: new Date().toISOString(),
  };

  recordRequest(): void {
    this.stats.totalRequests += 1;
  }

  recordCacheHit(): void {
    this.stats.cacheHits += 1;
  }

  recordUpstream(service: keyof ApiQuotaStats['upstreamCalls']): void {
    this.stats.upstreamCalls[service] += 1;
  }

  recordRateLimit(): void {
    this.stats.rateLimitedCount += 1;
  }

  getSnapshot(): ApiQuotaStats {
    return {
      ...this.stats,
      upstreamCalls: { ...this.stats.upstreamCalls },
    };
  }
}

export const quotaTracker = new QuotaTracker();

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}) {
  const buckets = new Map<string, WindowBucket>();
  const { windowMs, maxRequests, keyPrefix = 'global' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const clientIp =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const key = `${keyPrefix}:${clientIp}`;

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));

    // Opportunistic cleanup to keep memory bounded
    if (buckets.size > 2000) {
      for (const [entryKey, entry] of buckets.entries()) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
    }

    if (bucket.count > maxRequests) {
      quotaTracker.recordRateLimit();
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait briefly before sending more requests.',
        retryAfterSeconds: resetSeconds,
      });
      return;
    }

    next();
  };
}

export class MemoryCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    quotaTracker.recordCacheHit();
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.store.size > 500) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}
