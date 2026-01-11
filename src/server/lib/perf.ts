/**
 * Performance measurement utilities for development debugging
 */

export interface PerfMetrics {
  total: number;
  db: number;
  github: number;
  cache: { hits: number; misses: number };
  operations: Array<{ name: string; duration: number }>;
}

interface Operation {
  name: string;
  start: number;
  end?: number;
}

export class PerfTimer {
  private startTime: number;
  private operations: Operation[] = [];
  private dbTime = 0;
  private githubTime = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Start measuring an operation
   * @returns A function to call when the operation is complete
   */
  startOperation(name: string): () => void {
    const start = performance.now();
    const op: Operation = { name, start };
    this.operations.push(op);

    return () => {
      op.end = performance.now();
    };
  }

  /**
   * Measure a database query
   */
  async measureDb<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.dbTime += duration;
      this.operations.push({ name: `db:${name}`, start, end: performance.now() });
    }
  }

  /**
   * Measure a synchronous database query
   */
  measureDbSync<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.dbTime += duration;
      this.operations.push({ name: `db:${name}`, start, end: performance.now() });
    }
  }

  /**
   * Measure a GitHub API call (synchronous, as it uses execSync)
   */
  measureGitHub<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.githubTime += duration;
      this.operations.push({
        name: `github:${name}`,
        start,
        end: performance.now(),
      });
    }
  }

  /**
   * Measure an async GitHub API call (for GraphQL fetch)
   */
  async measureGitHubAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.githubTime += duration;
      this.operations.push({
        name: `github:${name}`,
        start,
        end: performance.now(),
      });
    }
  }

  /**
   * Record a cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerfMetrics {
    const total = performance.now() - this.startTime;
    return {
      total,
      db: this.dbTime,
      github: this.githubTime,
      cache: { hits: this.cacheHits, misses: this.cacheMisses },
      operations: this.operations.map((op) => ({
        name: op.name,
        duration: (op.end ?? performance.now()) - op.start,
      })),
    };
  }

  /**
   * Log metrics to console
   */
  log(prefix: string): void {
    if (!PERF_ENABLED) return;

    const metrics = this.getMetrics();
    const slow = metrics.total > 500 ? " [SLOW]" : "";

    console.log(`[PERF] ${prefix}${slow}`);
    console.log(`  Total: ${metrics.total.toFixed(2)}ms`);
    console.log(`  DB: ${metrics.db.toFixed(2)}ms`);
    console.log(`  GitHub: ${metrics.github.toFixed(2)}ms`);
    console.log(
      `  Cache: ${metrics.cache.hits} hits, ${metrics.cache.misses} misses`
    );

    if (metrics.operations.length > 0) {
      console.log(`  Operations:`);
      for (const op of metrics.operations) {
        console.log(`    - ${op.name}: ${op.duration.toFixed(2)}ms`);
      }
    }
  }
}

/**
 * Global flag to enable/disable performance measurement
 * Enable with PERF_DEBUG=true environment variable
 */
export const PERF_ENABLED =
  process.env.PERF_DEBUG === "true" || process.env.NODE_ENV === "development";
