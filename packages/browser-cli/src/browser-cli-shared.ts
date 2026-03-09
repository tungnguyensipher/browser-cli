import { fetchBrowserJson, type BrowserFetchInit } from "@aibrowser/browser-client";

export type BrowserParentOpts = {
  json?: boolean;
  browserProfile?: string;
  baseUrl?: string;
  authToken?: string;
  timeout?: string;
};

type BrowserRequestParams = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

function normalizeQuery(query: BrowserRequestParams["query"]): string {
  if (!query) {
    return "";
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function resolveTimeoutMs(
  opts: BrowserParentOpts,
  explicit?: { timeoutMs?: number; progress?: boolean },
): number | undefined {
  if (typeof explicit?.timeoutMs === "number" && Number.isFinite(explicit.timeoutMs)) {
    return Math.max(1, Math.floor(explicit.timeoutMs));
  }
  if (typeof opts.timeout === "string" && opts.timeout.trim()) {
    const parsed = Number.parseInt(opts.timeout, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

function resolveFetchInit(
  opts: BrowserParentOpts,
  extra?: { timeoutMs?: number; progress?: boolean },
): BrowserFetchInit {
  const timeoutMs = resolveTimeoutMs(opts, extra);
  const authToken = opts.authToken?.trim();
  return {
    ...(opts.baseUrl?.trim() ? { baseUrl: opts.baseUrl.trim() } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
    ...(authToken ? { auth: { token: authToken } } : {}),
  };
}

export async function callBrowserRequest<T>(
  opts: BrowserParentOpts,
  params: BrowserRequestParams,
  extra?: { timeoutMs?: number; progress?: boolean },
): Promise<T> {
  return await fetchBrowserJson<T>(`${params.path}${normalizeQuery(params.query)}`, {
    ...resolveFetchInit(opts, extra),
    method: params.method,
    ...(params.body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params.body),
        }),
  });
}

export async function callBrowserResize(
  opts: BrowserParentOpts,
  params: { profile?: string; width: number; height: number; targetId?: string },
  extra?: { timeoutMs?: number },
): Promise<unknown> {
  return await callBrowserRequest(
    opts,
    {
      method: "POST",
      path: "/act",
      query: params.profile ? { profile: params.profile } : undefined,
      body: {
        kind: "resize",
        width: params.width,
        height: params.height,
        targetId: params.targetId?.trim() || undefined,
      },
    },
    extra,
  );
}
