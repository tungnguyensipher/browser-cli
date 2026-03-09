import {
  appendCdpPath,
  fetchJson,
  isWebSocketUrl,
  normalizeCdpWsUrl,
} from "@aibrowser/browser-shared";

type ChromeVersion = {
  webSocketDebuggerUrl?: unknown;
};

export async function getChromeWebSocketUrl(
  cdpUrl: string,
  timeoutMs = 2_000,
): Promise<string | null> {
  if (isWebSocketUrl(cdpUrl)) {
    return cdpUrl;
  }
  try {
    const version = await fetchJson<ChromeVersion>(appendCdpPath(cdpUrl, "/json/version"), timeoutMs);
    const wsUrl = String(version?.webSocketDebuggerUrl ?? "").trim();
    return wsUrl ? normalizeCdpWsUrl(wsUrl, cdpUrl) : null;
  } catch {
    return null;
  }
}
