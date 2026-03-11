import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  probeAuthenticatedOpenClawRelay,
  resolveRelayAuthTokenForPort,
} from "./extension-relay-auth.js";
import { getFreePort } from "./test-port.js";

async function withRelayServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  run: (params: { port: number }) => Promise<void>,
) {
  const port = await getFreePort();
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => resolve());
    server.once("error", reject);
  });
  try {
    const actualPort = (server.address() as AddressInfo).port;
    await run({ port: actualPort });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function handleNonVersionRequest(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.url?.startsWith("/json/version")) {
    return false;
  }
  res.writeHead(404);
  res.end("not found");
  return true;
}

describe("extension-relay-auth", () => {
  const TEST_GATEWAY_TOKEN = "test-gateway-token";
  let previousGatewayToken: string | undefined;

  beforeEach(() => {
    previousGatewayToken = process.env.BROWSER_CLI_AUTH_TOKEN;
    process.env.BROWSER_CLI_AUTH_TOKEN = TEST_GATEWAY_TOKEN;
  });

  afterEach(() => {
    if (previousGatewayToken === undefined) {
      delete process.env.BROWSER_CLI_AUTH_TOKEN;
    } else {
      process.env.BROWSER_CLI_AUTH_TOKEN = previousGatewayToken;
    }
  });

  it("accepts authenticated relay probe responses", async () => {
    let seenToken: string | undefined;
    await withRelayServer(
      (req, res) => {
        if (handleNonVersionRequest(req, res)) {
          return;
        }
        const header = req.headers["x-openclaw-relay-token"];
        seenToken = Array.isArray(header) ? header[0] : header;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ Browser: "OpenClaw/extension-relay" }));
      },
      async ({ port }) => {
        const token = await resolveRelayAuthTokenForPort(port);
        const ok = await probeAuthenticatedOpenClawRelay({
          baseUrl: `http://127.0.0.1:${port}`,
          relayAuthHeader: "x-openclaw-relay-token",
          relayAuthToken: token,
        });
        expect(ok).toBe(true);
        expect(seenToken).toBe(token);
      },
    );
  });
});
