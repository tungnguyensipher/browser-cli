import { describe, expect, it } from "vitest";

import {
  createPwAiNodeBridgeClient,
  sanitizePwAiNodeParams,
} from "./pw-ai-node-bridge.js";

describe("pw ai node bridge", () => {
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
