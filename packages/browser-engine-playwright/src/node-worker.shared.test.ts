import { describe, expect, it } from "bun:test";

import { serializeNodeWorkerValue } from "./node-worker.shared.js";

describe("serializeNodeWorkerValue", () => {
  it("encodes typed array payloads as buffers", () => {
    const value = serializeNodeWorkerValue({
      buffer: new Uint8Array(Buffer.from("pdf-bytes")),
    }) as {
      buffer: { __aibrowserType: string; base64: string };
    };

    expect(value.buffer.__aibrowserType).toBe("Buffer");
    expect(Buffer.from(value.buffer.base64, "base64").toString("utf8")).toBe("pdf-bytes");
  });
});
