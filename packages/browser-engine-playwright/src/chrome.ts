import { appendCdpPath, fetchJson, isWebSocketUrl } from "./cdp.js";
import { normalizeCdpWsUrl } from "./cdp.js";

type ChromeVersion = {
  webSocketDebuggerUrl?: string;
};

async function fetchChromeVersion(cdpUrl: string, timeoutMs = 1500): Promise<ChromeVersion | null> {
  try {
    const res = await fetchJson<ChromeVersion>(appendCdpPath(cdpUrl, "/json/version"), timeoutMs);
    return res && typeof res === "object" ? res : null;
  } catch {
    return null;
  }
}

export async function getChromeWebSocketUrl(
  cdpUrl: string,
  timeoutMs = 1500,
): Promise<string | null> {
  if (isWebSocketUrl(cdpUrl)) {
    return cdpUrl;
  }
  const version = await fetchChromeVersion(cdpUrl, timeoutMs);
  const wsUrl = String(version?.webSocketDebuggerUrl ?? "").trim();
  if (!wsUrl) {
    return null;
  }
  return normalizeCdpWsUrl(wsUrl, cdpUrl);
}
