/**
 * Simple in-memory cache with TTL support
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data or fetch fresh data if cache is expired/missing
 * @param key - Cache key
 * @param fetcher - Function to fetch fresh data
 * @param ttl - Time to live in milliseconds (default: 30 seconds)
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => T | Promise<T>,
  ttl: number = 30_000
): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && now - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, { data, timestamp: now });
  return data;
}

/**
 * Get cached data synchronously or fetch fresh data if cache is expired/missing
 * @param key - Cache key
 * @param fetcher - Function to fetch fresh data (sync)
 * @param ttl - Time to live in milliseconds (default: 30 seconds)
 */
export function getCachedOrFetchSync<T>(
  key: string,
  fetcher: () => T,
  ttl: number = 30_000
): T {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && now - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = fetcher();
  cache.set(key, { data, timestamp: now });
  return data;
}

/**
 * Invalidate cache entry
 * @param key - Cache key to invalidate
 */
export function invalidateCache(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate all cache entries matching a prefix
 * @param prefix - Key prefix to match
 */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
