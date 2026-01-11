import type { Context, Next } from "hono";
import { PERF_ENABLED } from "../lib/perf";

/**
 * Performance logging middleware
 * Logs request/response times and adds X-Response-Time header
 */
export async function perfLoggerMiddleware(
  c: Context,
  next: Next
): Promise<void | Response> {
  if (!PERF_ENABLED) {
    await next();
    return;
  }

  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = performance.now() - start;
  const status = c.res.status;

  // Highlight slow requests (500ms+)
  const slow = duration > 500 ? " [SLOW]" : "";

  console.log(
    `[PERF] ${method} ${path} -> ${status} in ${duration.toFixed(2)}ms${slow}`
  );

  // Add response time header for browser DevTools
  c.res.headers.set("X-Response-Time", `${duration.toFixed(2)}ms`);
}
