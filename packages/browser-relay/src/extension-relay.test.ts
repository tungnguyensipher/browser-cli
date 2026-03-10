import { request as httpRequest } from "node:http";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import WebSocket from "ws";
import {
  ensureChromeExtensionRelayServer,
  getChromeExtensionRelayAuthHeaders,
  stopChromeExtensionRelayServer,
  upsertConnectedTarget,
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
    const req = httpRequest(url, {
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": "dGVzdC1rZXktZm9yLXJlbGF5IQ==",
      },
    });

    req.once("response", (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });

    req.once("upgrade", (_response, socket) => {
      socket.destroy();
      reject(new Error("unauthorized websocket unexpectedly upgraded"));
    });

    req.once("error", (error) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ECONNRESET") {
        resolve(401);
        return;
      }
      reject(error);
    });
    req.end();
  });
}

describe("chrome extension relay server", () => {
  const TEST_GATEWAY_TOKEN = "test-gateway-token";
  let cdpUrl = "";
  let sharedCdpUrl = "";
  let previousGatewayToken: string | undefined;

  beforeEach(() => {
    previousGatewayToken = process.env.BROWSER_CLI_AUTH_TOKEN;
    process.env.BROWSER_CLI_AUTH_TOKEN = TEST_GATEWAY_TOKEN;
  });

  afterEach(async () => {
    if (cdpUrl) {
      await stopChromeExtensionRelayServer({ cdpUrl }).catch(() => {});
      cdpUrl = "";
    }
    if (previousGatewayToken === undefined) {
      delete process.env.BROWSER_CLI_AUTH_TOKEN;
    } else {
      process.env.BROWSER_CLI_AUTH_TOKEN = previousGatewayToken;
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

    ext.terminate();

    await stopChromeExtensionRelayServer({ cdpUrl });
    cdpUrl = "";
  });

  it("coalesces re-announced targets when the same tab returns with a new session id", () => {
    const connectedTargets = new Map([
      [
        "cb-tab-1",
        {
          sessionId: "cb-tab-1",
          targetId: "t1",
          targetInfo: {
            targetId: "t1",
            type: "page",
            title: "Old Title",
            url: "https://example.com/old",
          },
        },
      ],
    ]);

    const result = upsertConnectedTarget(connectedTargets, {
      sessionId: "cb-tab-99",
      targetInfo: {
        targetId: "t1",
        type: "page",
        title: "New Title",
        url: "https://example.com/new",
      },
      waitingForDebugger: false,
    });

    expect(result.removed.map((target) => target.sessionId)).toEqual(["cb-tab-1"]);
    expect(Array.from(connectedTargets.keys())).toEqual(["cb-tab-99"]);
    expect(Array.from(connectedTargets.values())[0]?.targetInfo.title).toBe("New Title");
    expect(Array.from(connectedTargets.values())[0]?.targetInfo.url).toBe("https://example.com/new");
  });
});
