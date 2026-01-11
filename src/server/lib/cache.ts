/**
 * Simple in-memory cache with TTL support and automatic garbage collection
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // TTL in milliseconds for this entry
  lastAccessed: number; // For LRU eviction
}

const cache = new Map<string, CacheEntry<unknown>>();

// Configuration
const MAX_CACHE_SIZE = 1000;
const GC_INTERVAL = 5 * 60 * 1000; // 5 minutes

let gcTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Get cached data or fetch fresh data if cache is expired/missing
 * @param key - Cache key
 * @param fetcher - Function to fetch fresh data
 * @param ttl - Time to live in milliseconds (default: 30 seconds)
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => T | Promise<T>,
  ttl: number = 30_000,
): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && now - cached.timestamp < cached.ttl) {
    cached.lastAccessed = now;
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, { data, timestamp: now, ttl, lastAccessed: now });
  evictIfNeeded();
  return data;
}

/**
 * Get cached data synchronously or fetch fresh data if cache is expired/missing
 * @param key - Cache key
 * @param fetcher - Function to fetch fresh data (sync)
 * @param ttl - Time to live in milliseconds (default: 30 seconds)
 */
export function getCachedOrFetchSync<T>(key: string, fetcher: () => T, ttl: number = 30_000): T {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && now - cached.timestamp < cached.ttl) {
    cached.lastAccessed = now;
    return cached.data;
  }

  const data = fetcher();
  cache.set(key, { data, timestamp: now, ttl, lastAccessed: now });
  evictIfNeeded();
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

/**
 * Get data from cache if not expired
 * @param key - Cache key
 * @param ttl - Time to live in milliseconds
 * @returns Cached data or undefined if expired/missing
 */
export function getCache<T>(key: string, ttl: number): T | undefined {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();
  if (cached && now - cached.timestamp < ttl) {
    cached.lastAccessed = now;
    return cached.data;
  }
  return undefined;
}

/**
 * Set data in cache
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttl - Time to live in milliseconds (default: 30 seconds)
 */
export function setCache<T>(key: string, data: T, ttl: number = 30_000): void {
  const now = Date.now();
  cache.set(key, { data, timestamp: now, ttl, lastAccessed: now });
  evictIfNeeded();
}

/**
 * Evict entries if cache size exceeds maximum
 * Uses LRU (Least Recently Used) strategy
 */
function evictIfNeeded(): void {
  if (cache.size <= MAX_CACHE_SIZE) {
    return;
  }

  // Find and remove the least recently used entry
  let oldestKey: string | null = null;
  let oldestAccess = Infinity;

  for (const [key, entry] of cache.entries()) {
    if (entry.lastAccessed < oldestAccess) {
      oldestAccess = entry.lastAccessed;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
  }
}

/**
 * Clean expired entries from cache
 * @returns Number of entries removed
 */
export function cleanExpiredEntries(): number {
  const now = Date.now();
  let removed = 0;

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp >= entry.ttl) {
      cache.delete(key);
      removed++;
    }
  }

  return removed;
}

/**
 * Start the cache garbage collector
 * Should be called once at application startup
 */
export function startCacheGC(): void {
  if (gcTimer) {
    return; // Already running
  }

  gcTimer = setInterval(() => {
    const removed = cleanExpiredEntries();
    if (removed > 0) {
      console.log(`[Cache GC] Cleaned ${removed} expired entries. Current size: ${cache.size}`);
    }
  }, GC_INTERVAL);

  // Don't prevent the process from exiting
  if (typeof gcTimer.unref === "function") {
    gcTimer.unref();
  }
}

/**
 * Stop the cache garbage collector
 */
export function stopCacheGC(): void {
  if (gcTimer) {
    clearInterval(gcTimer);
    gcTimer = null;
  }
}
