import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { fetchBrowserJson } from "./client-fetch.js";

describe("fetchBrowserJson", () => {
  const originalEnv = {
    BROWSER_CLI_CONTROL_PORT: process.env.BROWSER_CLI_CONTROL_PORT,
    BROWSER_CLI_AUTH_TOKEN: process.env.BROWSER_CLI_AUTH_TOKEN,
    BROWSER_CLI_AUTH_PASSWORD: process.env.BROWSER_CLI_AUTH_PASSWORD,
    BROWSER_CLI_MACHINE_AUTH_PATH: process.env.BROWSER_CLI_MACHINE_AUTH_PATH,
    BROWSER_CLI_CONFIG_PATH: process.env.BROWSER_CLI_CONFIG_PATH,
  };

  beforeEach(() => {
    delete process.env.BROWSER_CLI_CONFIG_PATH;
    process.env.BROWSER_CLI_CONTROL_PORT = "18888";
    process.env.BROWSER_CLI_AUTH_TOKEN = "loopback-token";
    delete process.env.BROWSER_CLI_AUTH_PASSWORD;
    process.env.BROWSER_CLI_MACHINE_AUTH_PATH = "/tmp/browser-cli-client-fetch-no-auth.json";
  });

  afterEach(() => {
    if (originalEnv.BROWSER_CLI_CONTROL_PORT === undefined) {
      delete process.env.BROWSER_CLI_CONTROL_PORT;
    } else {
      process.env.BROWSER_CLI_CONTROL_PORT = originalEnv.BROWSER_CLI_CONTROL_PORT;
    }

    if (originalEnv.BROWSER_CLI_AUTH_TOKEN === undefined) {
      delete process.env.BROWSER_CLI_AUTH_TOKEN;
    } else {
      process.env.BROWSER_CLI_AUTH_TOKEN = originalEnv.BROWSER_CLI_AUTH_TOKEN;
    }

    if (originalEnv.BROWSER_CLI_AUTH_PASSWORD === undefined) {
      delete process.env.BROWSER_CLI_AUTH_PASSWORD;
    } else {
      process.env.BROWSER_CLI_AUTH_PASSWORD = originalEnv.BROWSER_CLI_AUTH_PASSWORD;
    }

    if (originalEnv.BROWSER_CLI_MACHINE_AUTH_PATH === undefined) {
      delete process.env.BROWSER_CLI_MACHINE_AUTH_PATH;
    } else {
      process.env.BROWSER_CLI_MACHINE_AUTH_PATH = originalEnv.BROWSER_CLI_MACHINE_AUTH_PATH;
    }

    if (originalEnv.BROWSER_CLI_CONFIG_PATH === undefined) {
      delete process.env.BROWSER_CLI_CONFIG_PATH;
    } else {
      process.env.BROWSER_CLI_CONFIG_PATH = originalEnv.BROWSER_CLI_CONFIG_PATH;
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

  it("does not inject auth when Browser CLI loopback auth is unset and fallback is suppressed", async () => {
    delete process.env.BROWSER_CLI_AUTH_TOKEN;

    const fetchMock = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBeNull();
      return new Response(JSON.stringify({ ok: true, tabs: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchBrowserJson<{ ok: true; tabs: [] }>("/tabs", {
      suppressLoopbackAuthFallback: true,
    });

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
