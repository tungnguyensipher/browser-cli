import type { BrowserControlAuth } from "@aibrowser/browser-shared";

export type BrowserTransport =
  | string
  | {
      baseUrl?: string;
      auth?: BrowserControlAuth;
    };

export type BrowserRequestTarget =
  | string
  | {
      url: string;
      auth?: BrowserControlAuth;
    };

export function buildProfileQuery(profile?: string): string {
  return profile ? `?profile=${encodeURIComponent(profile)}` : "";
}

function resolveTransportBaseUrl(transport: BrowserTransport | undefined): string | undefined {
  if (typeof transport === "string") {
    return transport;
  }
  return transport?.baseUrl;
}

export function withBaseUrl(
  transport: BrowserTransport | undefined,
  path: string,
): BrowserRequestTarget {
  const trimmed = resolveTransportBaseUrl(transport)?.trim();
  if (!trimmed) {
    return path;
  }
  const url = `${trimmed.replace(/\/$/, "")}${path}`;
  if (typeof transport === "string" || !transport?.auth) {
    return url;
  }
  return {
    url,
    auth: transport.auth,
  };
}
