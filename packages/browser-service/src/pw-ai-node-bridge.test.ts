import { describe, expect, it } from "vitest";

import {
  createPwAiNodeBridgeClient,
  deserializePwAiNodeValue,
  resolvePwAiLoadStrategy,
  sanitizePwAiNodeParams,
  resolveWorkerLaunchConfig,
} from "./pw-ai-node-bridge.js";

describe("pw ai node bridge", () => {
  it("uses the node bridge when running under bun", () => {
    expect(resolvePwAiLoadStrategy({ bun: "1.3.8" })).toBe("node-bridge");
  });

  it("uses direct imports when bun is not present", () => {
    expect(resolvePwAiLoadStrategy({ node: "22.0.0" })).toBe("direct-import");
  });

  it("decodes nested buffer payloads from the node worker", async () => {
    const client = createPwAiNodeBridgeClient(async (method, params) => {
      expect(method).toBe("pdfViaPlaywright");
      expect(params).toEqual({ cdpUrl: "http://127.0.0.1:18897", targetId: "tab-1" });
      return {
        buffer: {
          __aibrowserType: "Buffer",
          base64: Buffer.from("hello world").toString("base64"),
        },
      };
    });

    const result = await client.pdfViaPlaywright({
      cdpUrl: "http://127.0.0.1:18897",
      targetId: "tab-1",
    });

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.toString("utf8")).toBe("hello world");
  });

  it("does not flatten already-decoded buffers back into plain objects", async () => {
    const client = createPwAiNodeBridgeClient(async () => ({
      buffer: Buffer.from("hello world"),
    }));

    const result = await client.pdfViaPlaywright({
      cdpUrl: "http://127.0.0.1:18897",
      targetId: "tab-1",
    });

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.toString("utf8")).toBe("hello world");
  });

  it("preserves plain object payloads from the node worker", () => {
    const decoded = deserializePwAiNodeValue({
      ok: true,
      refs: {
        e1: { role: "button", name: "Submit" },
      },
    });

    expect(decoded).toEqual({
      ok: true,
      refs: {
        e1: { role: "button", name: "Submit" },
      },
    });
  });

  it("pins tsx workers to the repo tsconfig regardless of cwd", () => {
    const launch = resolveWorkerLaunchConfig({});

    expect(launch.cwd.endsWith("/auto-browser")).toBe(true);
    expect(launch.env.TSX_TSCONFIG_PATH).toBe(`${launch.cwd}/tsconfig.json`);
    expect(launch.args).toContain("--import");
    expect(launch.entrypoint.endsWith("/packages/browser-engine-playwright/src/node-worker.ts")).toBe(true);
  });

  it("drops abort signals from bridged worker params", () => {
    const ctrl = new AbortController();

    const sanitized = sanitizePwAiNodeParams({
      cdpUrl: "http://127.0.0.1:18897",
      targetId: "tab-1",
      signal: ctrl.signal,
      nested: {
        keep: true,
        signal: ctrl.signal,
      },
    });

    expect(sanitized).toEqual({
      cdpUrl: "http://127.0.0.1:18897",
      targetId: "tab-1",
      nested: {
        keep: true,
      },
    });
  });
});
