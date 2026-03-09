import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { fetchBrowserJson } from "./client-fetch.js";

describe("fetchBrowserJson", () => {
  const originalEnv = {
    AIBROWSER_CONTROL_PORT: process.env.AIBROWSER_CONTROL_PORT,
    AIBROWSER_AUTH_TOKEN: process.env.AIBROWSER_AUTH_TOKEN,
    AIBROWSER_AUTH_PASSWORD: process.env.AIBROWSER_AUTH_PASSWORD,
    AIBROWSER_CONFIG_PATH: process.env.AIBROWSER_CONFIG_PATH,
  };

  beforeEach(() => {
    delete process.env.AIBROWSER_CONFIG_PATH;
    process.env.AIBROWSER_CONTROL_PORT = "18888";
    process.env.AIBROWSER_AUTH_TOKEN = "loopback-token";
    delete process.env.AIBROWSER_AUTH_PASSWORD;
  });

  afterEach(() => {
    if (originalEnv.AIBROWSER_CONTROL_PORT === undefined) {
      delete process.env.AIBROWSER_CONTROL_PORT;
    } else {
      process.env.AIBROWSER_CONTROL_PORT = originalEnv.AIBROWSER_CONTROL_PORT;
    }

    if (originalEnv.AIBROWSER_AUTH_TOKEN === undefined) {
      delete process.env.AIBROWSER_AUTH_TOKEN;
    } else {
      process.env.AIBROWSER_AUTH_TOKEN = originalEnv.AIBROWSER_AUTH_TOKEN;
    }

    if (originalEnv.AIBROWSER_AUTH_PASSWORD === undefined) {
      delete process.env.AIBROWSER_AUTH_PASSWORD;
    } else {
      process.env.AIBROWSER_AUTH_PASSWORD = originalEnv.AIBROWSER_AUTH_PASSWORD;
    }

    if (originalEnv.AIBROWSER_CONFIG_PATH === undefined) {
      delete process.env.AIBROWSER_CONFIG_PATH;
    } else {
      process.env.AIBROWSER_CONFIG_PATH = originalEnv.AIBROWSER_CONFIG_PATH;
    }

    mock.restore();
  });

  it("injects bearer auth for explicit loopback HTTP URLs", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer loopback-token");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await fetchBrowserJson<{ ok: boolean }>("http://127.0.0.1:18888/");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not inject auth for non-loopback URLs", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBeNull();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchBrowserJson<{ ok: boolean }>("http://example.com/");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves caller-supplied auth headers", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer caller-token");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchBrowserJson<{ ok: boolean }>("http://localhost:18888/", {
      headers: { Authorization: "Bearer caller-token" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses explicit auth for non-loopback URLs when provided by the caller", async () => {
    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer remote-token");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchBrowserJson<{ ok: boolean }>(
      { url: "https://browser.example.com/", auth: { token: "remote-token" } },
      {},
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves relative paths against the standalone control port and stays on HTTP transport", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:18888/tabs");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer loopback-token");
      return new Response(JSON.stringify({ ok: true, tabs: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await fetchBrowserJson<{ ok: true; tabs: [] }>("/tabs");

    expect(result.tabs).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts the request when the timeout elapses", async () => {
    const fetchMock = mock(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(init.signal?.reason ?? new Error("aborted"));
            },
            { once: true },
          );
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(fetchBrowserJson("/tabs", { timeoutMs: 25 })).rejects.toThrow(
      /timed out after 25ms/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
