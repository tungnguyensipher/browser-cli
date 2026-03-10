import { describe, expect, it, vi } from "vitest";

const mocks = {
  connectOverCDP: vi.fn(),
  getChromeWebSocketUrl: vi.fn(async () => null),
  getHeadersWithAuth: vi.fn(() => ({})),
  withNoProxyForCdpUrl: vi.fn(async (_url: string, fn: () => Promise<unknown>) => await fn()),
  isExtensionRelayCdpEndpoint: vi.fn(async () => true),
  appendCdpPath: vi.fn((base: string, path: string) => `${base}${path}`),
  normalizeCdpHttpBaseForJsonEndpoints: vi.fn((url: string) => url),
  normalizeCdpWsUrl: vi.fn((url: string) => url),
  fetchJson: vi.fn(),
};

vi.mock("playwright-core", () => ({
  chromium: {
    connectOverCDP: mocks.connectOverCDP,
  },
}));

vi.mock("./chrome.js", () => ({
  getChromeWebSocketUrl: mocks.getChromeWebSocketUrl,
}));

vi.mock("./cdp-proxy-bypass.js", () => ({
  withNoProxyForCdpUrl: mocks.withNoProxyForCdpUrl,
}));

vi.mock("./cdp.helpers.js", () => ({
  appendCdpPath: mocks.appendCdpPath,
  fetchJson: mocks.fetchJson,
  getHeadersWithAuth: mocks.getHeadersWithAuth,
  normalizeCdpHttpBaseForJsonEndpoints: mocks.normalizeCdpHttpBaseForJsonEndpoints,
  withCdpSocket: vi.fn(),
}));

vi.mock("./cdp.js", () => ({
  normalizeCdpWsUrl: mocks.normalizeCdpWsUrl,
}));

vi.mock("./navigation-guard.js", () => ({
  assertBrowserNavigationAllowed: vi.fn(async () => {}),
  assertBrowserNavigationResultAllowed: vi.fn(async () => {}),
  withBrowserNavigationPolicy: vi.fn((policy?: unknown) => policy ?? {}),
}));

vi.mock("./pw-session.page-cdp.js", () => ({
  isExtensionRelayCdpEndpoint: mocks.isExtensionRelayCdpEndpoint,
  withPageScopedCdpClient: vi.fn(),
}));

describe("pw-session extension relay target resolution", () => {
  it("prefers exact page target ids over stale relay target-list URL matching", async () => {
    vi.clearAllMocks();

    const sessionA = {
      send: vi.fn(async () => ({ targetInfo: { targetId: "target-x" } })),
      detach: vi.fn(async () => {}),
    };
    const sessionB = {
      send: vi.fn(async () => ({ targetInfo: { targetId: "target-example" } })),
      detach: vi.fn(async () => {}),
    };

    const context = {
      pages: vi.fn(),
      on: vi.fn(),
      newCDPSession: vi.fn(async (page: unknown) => (page === pageA ? sessionA : sessionB)),
    };

    const pageA = {
      url: vi.fn(() => "https://x.com/post"),
      title: vi.fn(async () => "X"),
      context: vi.fn(() => context),
      on: vi.fn(),
    };
    const pageB = {
      url: vi.fn(() => "https://example.com/"),
      title: vi.fn(async () => "Example Domain"),
      context: vi.fn(() => context),
      on: vi.fn(),
    };

    context.pages.mockReturnValue([pageA, pageB]);

    const browser = {
      contexts: vi.fn(() => [context]),
      on: vi.fn(),
    };
    mocks.connectOverCDP.mockResolvedValue(browser);

    // Simulate stale relay metadata that no longer matches the page URLs.
    mocks.fetchJson.mockResolvedValue([
      { id: "target-x", url: "https://x.com/post" },
      { id: "target-example", url: "about:blank" },
    ]);

    const { getPageForTargetId } = await import("./pw-session.js");

    const page = await getPageForTargetId({
      cdpUrl: "http://127.0.0.1:18889",
      targetId: "target-example",
    });

    expect(page).toBe(pageB);
  });
});
