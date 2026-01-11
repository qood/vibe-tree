import { hc } from "hono/client";
import type { ApiType } from "../../../src/server/api";
import { ApiError } from "./api";

// Create RPC client with type inference from server
const client = hc<ApiType>("/api");

// Export typed RPC client
export const rpc = client;

// Helper to unwrap response and handle errors with ApiError
export async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = errorData as { error?: string; code?: string; details?: Record<string, unknown> };
    throw new ApiError(
      err.error || `HTTP error: ${response.status}`,
      response.status,
      err.code,
      err.details,
    );
  }
  return response.json() as Promise<T>;
}

// =============================================================================
// RPC-based API functions (compatible with existing api.ts interface)
// =============================================================================

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface RepoInfo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  isPrivate: boolean;
  defaultBranch: string;
}

// Health check via RPC
export async function healthRpc(): Promise<HealthResponse> {
  const res = await rpc.health.$get();
  return unwrap<HealthResponse>(res);
}

// Get repos list via RPC
export async function getReposRpc(): Promise<RepoInfo[]> {
  const res = await rpc.repos.$get();
  return unwrap<RepoInfo[]>(res);
}

// Get single repo via RPC
export async function getRepoRpc(owner: string, name: string): Promise<RepoInfo> {
  // Dynamic route access requires type assertion for Hono RPC client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc.repos as any)[owner][name].$get();
  return unwrap<RepoInfo>(res);
}
