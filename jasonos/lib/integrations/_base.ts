// Shared scaffolding for integration adapters.
// Every adapter follows the same shape: configured boolean, cached fetch,
// graceful failure that returns an explicit empty state. Callers should never
// see an exception from an integration call.

import "server-only";
import { unstable_cache } from "next/cache";

export interface IntegrationResult<T> {
  data: T;
  configured: boolean;
  lastSyncAt: string;
  error?: string;
}

export interface IntegrationDescriptor {
  id: string;
  label: string;
  envKeys: string[];
  pollIntervalMs?: number;
}

export function emptyResult<T>(
  data: T,
  configured: boolean,
  error?: string
): IntegrationResult<T> {
  return { data, configured, lastSyncAt: new Date().toISOString(), error };
}

const HEADER_REDACT = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "proxy-authorization",
]);

export function redactHeaders(
  init?: HeadersInit
): Record<string, string> {
  if (!init) return {};
  const out: Record<string, string> = {};
  const h = new Headers(init);
  h.forEach((v, k) => {
    out[k] = HEADER_REDACT.has(k.toLowerCase()) ? "***" : v;
  });
  return out;
}

export function makeCachedFetcher<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
) {
  return unstable_cache(fetcher, [key], {
    revalidate: ttlSeconds,
    tags: [key],
  });
}

export function envConfigured(...keys: string[]): boolean {
  return keys.every((k) => !!process.env[k]);
}
