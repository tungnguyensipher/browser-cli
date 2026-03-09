import net from "node:net";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import WebSocket from "ws";
import {
  ensureChromeExtensionRelayServer,
  getChromeExtensionRelayAuthHeaders,
  stopChromeExtensionRelayServer,
} from "./extension-relay.js";
import { getFreePort } from "./test-port.js";

function waitForOpen(ws: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

function requestUnauthorizedUpgrade(url: string) {
  return new Promise<number>((resolve, reject) => {
    const parsed = new URL(url);
    const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
    const socket = net.createConnection({ host: parsed.hostname, port });
    let buffer = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      fn();
    };

    socket.once("connect", () => {
      socket.write(
        [
          `GET ${parsed.pathname} HTTP/1.1`,
          `Host: ${parsed.host}`,
          "Connection: Upgrade",
          "Upgrade: websocket",
          "Sec-WebSocket-Version: 13",
          "Sec-WebSocket-Key: dGVzdC1rZXktZm9yLXJlbGF5IQ==",
          "",
          "",
        ].join("\r\n"),
      );
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const match = /^HTTP\/1\.1 (\d{3})/.exec(buffer);
      if (match) {
        finish(() => resolve(Number(match[1])));
      }
    });

    socket.once("error", (error) => {
      const match = /^HTTP\/1\.1 (\d{3})/.exec(buffer);
      if (match) {
        finish(() => resolve(Number(match[1])));
        return;
      }
      finish(() => reject(error));
    });

    socket.once("close", () => {
      const match = /^HTTP\/1\.1 (\d{3})/.exec(buffer);
      if (match) {
        finish(() => resolve(Number(match[1])));
        return;
      }
      finish(() => reject(new Error("socket closed before HTTP status was received")));
    });
  });
}

describe("chrome extension relay server", () => {
  const TEST_GATEWAY_TOKEN = "test-gateway-token";
  let cdpUrl = "";
  let sharedCdpUrl = "";
  let previousGatewayToken: string | undefined;

  beforeEach(() => {
    previousGatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    process.env.OPENCLAW_GATEWAY_TOKEN = TEST_GATEWAY_TOKEN;
  });

  afterEach(async () => {
    if (cdpUrl) {
      await stopChromeExtensionRelayServer({ cdpUrl }).catch(() => {});
      cdpUrl = "";
    }
    if (previousGatewayToken === undefined) {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
    } else {
      process.env.OPENCLAW_GATEWAY_TOKEN = previousGatewayToken;
    }
  });

  afterAll(async () => {
    if (sharedCdpUrl) {
      await stopChromeExtensionRelayServer({ cdpUrl: sharedCdpUrl }).catch(() => {});
      sharedCdpUrl = "";
    }
  });

  async function ensureSharedRelayServer() {
    if (sharedCdpUrl) {
      return sharedCdpUrl;
    }
    const port = await getFreePort();
    sharedCdpUrl = `http://127.0.0.1:${port}`;
    await ensureChromeExtensionRelayServer({ cdpUrl: sharedCdpUrl });
    return sharedCdpUrl;
  }

  it("uses relay-scoped token only for known relay ports", async () => {
    const port = await getFreePort();
    const unknown = getChromeExtensionRelayAuthHeaders(`http://127.0.0.1:${port}`);
    expect(unknown).toEqual({});

    const sharedUrl = await ensureSharedRelayServer();
    const headers = getChromeExtensionRelayAuthHeaders(sharedUrl);
    expect(Object.keys(headers)).toContain("x-openclaw-relay-token");
    expect(headers["x-openclaw-relay-token"]).not.toBe(TEST_GATEWAY_TOKEN);
  });

  it("rejects CDP access without relay auth token", async () => {
    const sharedUrl = await ensureSharedRelayServer();
    const sharedPort = new URL(sharedUrl).port;

    const res = await fetch(`${sharedUrl}/json/version`);
    expect(res.status).toBe(401);

    const status = await requestUnauthorizedUpgrade(`http://127.0.0.1:${sharedPort}/cdp`);
    expect(status).toBe(401);
  });

  it("advertises CDP WS only when extension is connected", async () => {
    const port = await getFreePort();
    cdpUrl = `http://127.0.0.1:${port}`;
    await ensureChromeExtensionRelayServer({ cdpUrl });

    const v1 = (await fetch(`${cdpUrl}/json/version`, {
      headers: getChromeExtensionRelayAuthHeaders(cdpUrl),
    }).then((response) => response.json())) as { webSocketDebuggerUrl?: string };
    expect(v1.webSocketDebuggerUrl).toBeUndefined();

    const ext = new WebSocket(`ws://127.0.0.1:${port}/extension`, {
      headers: getChromeExtensionRelayAuthHeaders(`ws://127.0.0.1:${port}/extension`),
    });
    await waitForOpen(ext);

    const v2 = (await fetch(`${cdpUrl}/json/version`, {
      headers: getChromeExtensionRelayAuthHeaders(cdpUrl),
    }).then((response) => response.json())) as { webSocketDebuggerUrl?: string };
    expect(String(v2.webSocketDebuggerUrl ?? "")).toContain("/cdp");

    ext.close();
  });
});
