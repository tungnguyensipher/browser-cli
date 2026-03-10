import {
  isLoopbackHost,
  loadRuntimeConfig,
  resolveBrowserConfig,
  resolveBrowserControlAuth,
  type BrowserControlAuth,
} from "@aibrowser/browser-shared";
import type { BrowserRequestTarget } from "./client-actions-url.js";

export type BrowserFetchInit = RequestInit & {
  timeoutMs?: number;
  baseUrl?: string;
  auth?: BrowserControlAuth;
  fetchFn?: typeof fetch;
  suppressLoopbackAuthFallback?: boolean;
};

class BrowserServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserServiceError";
  }
}

function isAbsoluteHttp(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function resolveStandaloneBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim();
  if (trimmed) {
    return trimTrailingSlash(trimmed);
  }
  const runtimeConfig = loadRuntimeConfig();
  const browserConfig = resolveBrowserConfig(runtimeConfig.browser, runtimeConfig);
  return `http://127.0.0.1:${browserConfig.controlPort}`;
}

function resolveRequestUrl(url: string, baseUrl?: string): string {
  if (isAbsoluteHttp(url)) {
    return url.trim();
  }
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${resolveStandaloneBaseUrl(baseUrl)}${normalizedPath}`;
}

function isLoopbackHttpUrl(url: string): boolean {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function withLoopbackBrowserAuth(
  url: string,
  init: BrowserFetchInit | undefined,
): RequestInit & { timeoutMs?: number; fetchFn?: typeof fetch } {
  const headers = new Headers(init?.headers ?? {});
  if (headers.has("authorization") || headers.has("x-openclaw-password")) {
    return { ...init, headers };
  }
  const auth = init?.auth;
  if (auth?.token) {
    headers.set("Authorization", `Bearer ${auth.token}`);
    return { ...init, headers };
  } else if (auth?.password) {
    headers.set("x-openclaw-password", auth.password);
    return { ...init, headers };
  }

  if (!isLoopbackHttpUrl(url)) {
    return { ...init, headers };
  }

  const loopbackAuth = resolveBrowserControlAuth(
    init?.suppressLoopbackAuthFallback ? {} : undefined,
    process.env,
    {
      allowLegacyGatewayTokenFallback: !init?.suppressLoopbackAuthFallback,
    },
  );
  if (loopbackAuth.token) {
    headers.set("Authorization", `Bearer ${loopbackAuth.token}`);
  } else if (loopbackAuth.password) {
    headers.set("x-openclaw-password", loopbackAuth.password);
  }

  return { ...init, headers };
}

function normalizeErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message.trim();
  }
  return String(err);
}

function enhanceBrowserFetchError(url: string, err: unknown, timeoutMs: number): Error {
  const msg = normalizeErrorMessage(err);
  const msgLower = msg.toLowerCase();
  const looksLikeTimeout =
    msgLower.includes("timed out") ||
    msgLower.includes("timeout") ||
    msgLower.includes("aborted") ||
    msgLower.includes("abort");

  if (looksLikeTimeout) {
    return new Error(`Can't reach the browser control service at ${url} (timed out after ${timeoutMs}ms).`);
  }

  return new Error(`Can't reach the browser control service at ${url}. (${msg})`);
}

async function fetchHttpJson<T>(url: string, init: BrowserFetchInit): Promise<T> {
  const timeoutMs = init.timeoutMs ?? 5000;
  const ctrl = new AbortController();
  const upstreamSignal = init.signal;
  const fetchFn = init.fetchFn ?? globalThis.fetch;
  let upstreamAbortListener: (() => void) | undefined;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      ctrl.abort(upstreamSignal.reason);
    } else {
      upstreamAbortListener = () => ctrl.abort(upstreamSignal.reason);
      upstreamSignal.addEventListener("abort", upstreamAbortListener, { once: true });
    }
  }

  const timer = setTimeout(() => ctrl.abort(new Error("timed out")), timeoutMs);
  try {
    const res = await fetchFn(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new BrowserServiceError(text || `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    if (upstreamSignal && upstreamAbortListener) {
      upstreamSignal.removeEventListener("abort", upstreamAbortListener);
    }
  }
}

export async function fetchBrowserJson<T>(
  target: BrowserRequestTarget,
  init?: BrowserFetchInit,
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 5000;
  const auth =
    typeof target === "string"
      ? init?.auth
      : (target.auth ?? init?.auth);
  const rawUrl = typeof target === "string" ? target : target.url;
  const requestUrl = resolveRequestUrl(rawUrl, init?.baseUrl);
  try {
    const requestInit = withLoopbackBrowserAuth(requestUrl, { ...init, auth });
    return await fetchHttpJson<T>(requestUrl, { ...requestInit, timeoutMs });
  } catch (err) {
    if (err instanceof BrowserServiceError) {
      throw err;
    }
    throw enhanceBrowserFetchError(requestUrl, err, timeoutMs);
  }
}

export const __test = {
  resolveRequestUrl,
  resolveStandaloneBaseUrl,
  withLoopbackBrowserAuth,
};
