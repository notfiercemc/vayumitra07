import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../server/middleware/rateLimiter.ts';

describe('MemoryCache TTL and Rate Limiter Utility', () => {
  it('stores and retrieves cached values before TTL expires', () => {
    const cache = new MemoryCache<string>();
    cache.set('delhi', 'aqi:142', 1000);
    expect(cache.get('delhi')).toBe('aqi:142');
  });

  it('evicts expired entries cleanly', () => {
    const cache = new MemoryCache<string>();
    cache.set('london', 'aqi:28', -10);
    expect(cache.get('london')).toBeNull();
  });
});
