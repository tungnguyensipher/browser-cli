import { afterEach, describe, expect, it, mock } from "bun:test";

import { createBrowserClient } from "./index.js";

describe("createBrowserClient", () => {
  afterEach(() => {
    mock.restore();
  });

  it("binds baseUrl and defaultProfile for copied client helpers", async () => {
    const calls: string[] = [];
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          ok: true,
          format: "ai",
          targetId: "tab-1",
          url: "https://example.com/",
          snapshot: "ok",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = createBrowserClient({
      baseUrl: "http://127.0.0.1:18888",
      defaultProfile: "chrome",
    });

    await client.browserSnapshot({ format: "ai", refs: "aria" });

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!);
    expect(url.origin).toBe("http://127.0.0.1:18888");
    expect(url.pathname).toBe("/snapshot");
    expect(url.searchParams.get("profile")).toBe("chrome");
    expect(url.searchParams.get("refs")).toBe("aria");
  });

  it("lets an explicit profile override the client default", async () => {
    const calls: string[] = [];
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          ok: true,
          format: "ai",
          targetId: "tab-1",
          url: "https://example.com/",
          snapshot: "ok",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = createBrowserClient({
      baseUrl: "http://127.0.0.1:18888",
      defaultProfile: "chrome",
    });

    await client.browserSnapshot({ format: "ai", profile: "openclaw" });

    const url = new URL(calls[0]!);
    expect(url.searchParams.get("profile")).toBe("openclaw");
  });
});
