import { hc } from "hono/client";
import type { ApiType } from "../../../src/server/api";

// Create RPC client with type inference from server
const client = hc<ApiType>("/api");

// Export typed RPC client
export const rpc = client;

// Helper to unwrap response and handle errors
export async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || `HTTP error: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
