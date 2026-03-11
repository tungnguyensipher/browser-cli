import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BrowserRouteContext,
  BrowserServerState,
  BrowserTab,
  ProfileContext,
  ProfileRuntimeState,
} from "../server-context.js";
import { registerBrowserAgentRoutes } from "./agent.js";
import { registerBrowserBasicRoutes } from "./basic.js";
import { registerBrowserTabRoutes } from "./tabs.js";
import type { BrowserRouteHandler, BrowserRouteRegistrar } from "./types.js";

const pdfPath = "/tmp/browser-contract.pdf";
const mocks = {
  pdfPath,
  ensureMediaDir: vi.fn(async () => path.dirname(pdfPath)),
  saveMediaBuffer: vi.fn(async () => ({ path: pdfPath })),
  normalizeBrowserScreenshot: vi.fn(async (buffer: Buffer) => ({ buffer, contentType: "image/png" as const })),
  resolveBrowserExecutableForPlatform: vi.fn(() => ({
    kind: "chrome",
    path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  })),
  pw: {
      listPagesViaPlaywright: vi.fn(async () => []),
      createPageViaPlaywright: vi.fn(async () => ({
        targetId: "tab-1",
        title: "Example",
        url: "https://example.com",
        type: "page",
      })),
      focusPageByTargetIdViaPlaywright: vi.fn(async () => {}),
      closePageByTargetIdViaPlaywright: vi.fn(async () => {}),
      closePageViaPlaywright: vi.fn(async () => {}),
      navigateViaPlaywright: vi.fn(async () => ({ url: "https://example.com" })),
      pdfViaPlaywright: vi.fn(async () => ({ buffer: Buffer.from("pdf") })),
      takeScreenshotViaPlaywright: vi.fn(async () => ({ buffer: Buffer.from("png") })),
      snapshotRoleViaPlaywright: vi.fn(async () => ({ snapshot: "role", refs: {} })),
      snapshotAiViaPlaywright: vi.fn(async () => ({ snapshot: "ai", refs: { e1: "button" } })),
      snapshotAriaViaPlaywright: vi.fn(async () => ({ nodes: [{ ref: "1", role: "button", depth: 0 }] })),
      screenshotWithLabelsViaPlaywright: vi.fn(async () => ({
        buffer: Buffer.from("png"),
        labels: 1,
        skipped: 0,
      })),
      clickViaPlaywright: vi.fn(async () => {}),
      typeViaPlaywright: vi.fn(async () => {}),
      pressKeyViaPlaywright: vi.fn(async () => {}),
      hoverViaPlaywright: vi.fn(async () => {}),
      scrollIntoViewViaPlaywright: vi.fn(async () => {}),
      dragViaPlaywright: vi.fn(async () => {}),
      selectOptionViaPlaywright: vi.fn(async () => {}),
      fillFormViaPlaywright: vi.fn(async () => {}),
      resizeViewportViaPlaywright: vi.fn(async () => {}),
      waitForViaPlaywright: vi.fn(async () => {}),
      evaluateViaPlaywright: vi.fn(async () => "ok"),
      responseBodyViaPlaywright: vi.fn(async () => ({
        url: "https://example.com/api",
        status: 200,
        headers: {},
        body: "{}",
      })),
      highlightViaPlaywright: vi.fn(async () => {}),
      findViaPlaywright: vi.fn(async () => ({ text: "Submit" })),
      getConsoleMessagesViaPlaywright: vi.fn(async () => [{ level: "error", text: "boom" }]),
      getPageErrorsViaPlaywright: vi.fn(async () => ({ errors: [] })),
      getNetworkRequestsViaPlaywright: vi.fn(async () => ({ requests: [] })),
      traceStartViaPlaywright: vi.fn(async () => {}),
      traceStopViaPlaywright: vi.fn(async () => {}),
      waitForDownloadViaPlaywright: vi.fn(async () => ({
        url: "https://example.com/report.pdf",
        suggestedFilename: "report.pdf",
        path: "/tmp/report.pdf",
      })),
      downloadViaPlaywright: vi.fn(async () => ({
        url: "https://example.com/report.pdf",
        suggestedFilename: "report.pdf",
        path: "/tmp/report.pdf",
      })),
      setInputFilesViaPlaywright: vi.fn(async () => {}),
      armFileUploadViaPlaywright: vi.fn(async () => {}),
      armDialogViaPlaywright: vi.fn(async () => {}),
      cookiesGetViaPlaywright: vi.fn(async () => ({ cookies: [] })),
      cookiesSetViaPlaywright: vi.fn(async () => {}),
      cookiesClearViaPlaywright: vi.fn(async () => {}),
      storageGetViaPlaywright: vi.fn(async () => ({ items: {} })),
      storageSetViaPlaywright: vi.fn(async () => {}),
      storageClearViaPlaywright: vi.fn(async () => {}),
      setOfflineViaPlaywright: vi.fn(async () => {}),
      setExtraHTTPHeadersViaPlaywright: vi.fn(async () => {}),
      setHttpCredentialsViaPlaywright: vi.fn(async () => {}),
      setGeolocationViaPlaywright: vi.fn(async () => {}),
      emulateMediaViaPlaywright: vi.fn(async () => {}),
      setTimezoneViaPlaywright: vi.fn(async () => {}),
      setLocaleViaPlaywright: vi.fn(async () => {}),
      setDeviceViaPlaywright: vi.fn(async () => {}),
    },
};

vi.mock("../pw-ai-module.js", () => ({
  getPwAiModule: vi.fn(async () => mocks.pw),
}));

vi.mock("../media-store.js", () => ({
  ensureMediaDir: mocks.ensureMediaDir,
  saveMediaBuffer: mocks.saveMediaBuffer,
}));

vi.mock("../screenshot.js", () => ({
  DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES: 5 * 1024 * 1024,
  DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE: 2000,
  normalizeBrowserScreenshot: mocks.normalizeBrowserScreenshot,
}));

vi.mock("../chrome.executables.js", () => ({
  resolveBrowserExecutableForPlatform: mocks.resolveBrowserExecutableForPlatform,
  findChromeExecutableMac: vi.fn(() => null),
  findChromeExecutableLinux: vi.fn(() => null),
  findChromeExecutableWindows: vi.fn(() => null),
}));

type TestHarness = {
  dispatcher: {
    dispatch: (params: {
      method: "GET" | "POST" | "DELETE";
      path: string;
      query?: Record<string, unknown>;
      body?: unknown;
    }) => Promise<{ status: number; body: unknown }>;
  };
  tab: BrowserTab;
};

function createHarness(): TestHarness {
  const tab: BrowserTab = {
    targetId: "tab-1",
    title: "Example",
    type: "page",
    url: "https://example.com",
    wsUrl: "ws://127.0.0.1/devtools/page/tab-1",
  };

  const profile = {
    name: "openclaw",
    cdpPort: 18792,
    cdpUrl: "http://127.0.0.1:18792",
    cdpHost: "127.0.0.1",
    cdpIsLoopback: true,
    color: "#FF4500",
    driver: "openclaw",
    attachOnly: false,
  } as const;

  const profileState: ProfileRuntimeState = {
    profile,
    running: {
      pid: 123,
      exe: { kind: "chrome", path: "/chrome" },
      userDataDir: "/tmp/openclaw-profile",
      cdpPort: profile.cdpPort,
      startedAt: Date.now(),
      proc: {} as never,
    },
    lastTargetId: tab.targetId,
    reconcile: null,
  };

  const profileCtx: ProfileContext = {
    profile,
    ensureBrowserAvailable: async () => {},
    ensureTabAvailable: async () => tab,
    isHttpReachable: async () => true,
    isReachable: async () => true,
    listTabs: async () => [tab],
    openTab: async () => tab,
    focusTab: async () => {},
    closeTab: async () => {},
    stopRunningBrowser: async () => ({ stopped: true }),
    resetProfile: async () => ({ stopped: true, deleted: false }),
  };

  const state: BrowserServerState = {
    server: null,
    port: 18888,
    resolved: {
      enabled: true,
      evaluateEnabled: true,
      controlPort: 18888,
      cdpPortRangeStart: 18897,
      cdpPortRangeEnd: 18996,
      cdpProtocol: "http",
      cdpHost: "127.0.0.1",
      cdpIsLoopback: true,
      remoteCdpTimeoutMs: 1500,
      remoteCdpHandshakeTimeoutMs: 3000,
      color: "#FF4500",
      headless: true,
      noSandbox: false,
      attachOnly: false,
      defaultProfile: "openclaw",
      profiles: {
        openclaw: {
          cdpPort: profile.cdpPort,
          color: profile.color,
        },
      },
      extraArgs: [],
    },
    profiles: new Map([["openclaw", profileState]]),
  };

  const ctx: BrowserRouteContext = {
    state: () => state,
    forProfile: () => profileCtx,
    listProfiles: async () => [],
    ensureBrowserAvailable: async () => {},
    ensureTabAvailable: async () => tab,
    isHttpReachable: async () => true,
    isReachable: async () => true,
    listTabs: async () => [tab],
    openTab: async () => tab,
    focusTab: async () => {},
    closeTab: async () => {},
    stopRunningBrowser: async () => ({ stopped: true }),
    resetProfile: async () => ({ stopped: true, deleted: false }),
    mapTabError: () => null,
  };

  const routes = new Map<string, BrowserRouteHandler>();
  const registrar: BrowserRouteRegistrar = {
    get(routePath, handler) {
      routes.set(`GET ${routePath}`, handler);
    },
    post(routePath, handler) {
      routes.set(`POST ${routePath}`, handler);
    },
    delete(routePath, handler) {
      routes.set(`DELETE ${routePath}`, handler);
    },
  };

  registerBrowserBasicRoutes(registrar, ctx);
  registerBrowserTabRoutes(registrar, ctx);
  registerBrowserAgentRoutes(registrar, ctx);

  return {
    dispatcher: {
      dispatch: async (params) => {
        const handler = routes.get(`${params.method} ${params.path}`);
        if (!handler) {
          return { status: 404, body: { error: "Not Found" } };
        }
        let status = 200;
        let body: unknown;
        await handler(
          {
            params: {},
            query: params.query ?? {},
            body: params.body,
          },
          {
            status(code) {
              status = code;
              return this;
            },
            json(value) {
              body = value;
            },
          },
        );
        return { status, body };
      },
    },
    tab,
  };
}

describe("browser-service route smoke contract", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks.pw)) {
      fn.mockClear();
    }
    mocks.ensureMediaDir.mockClear();
    mocks.saveMediaBuffer.mockClear();
    mocks.normalizeBrowserScreenshot.mockClear();
    mocks.resolveBrowserExecutableForPlatform.mockClear();
  });

  it("serves the status, tabs, snapshot, act, console, and pdf route contracts", async () => {
    const { dispatcher, tab } = createHarness();

    const status = await dispatcher.dispatch({
      method: "GET",
      path: "/",
      query: {},
    });
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      enabled: true,
      profile: "openclaw",
      running: true,
      cdpPort: 18792,
      cdpUrl: "http://127.0.0.1:18792",
      pid: 123,
    });

    const tabs = await dispatcher.dispatch({
      method: "GET",
      path: "/tabs",
      query: {},
    });
    expect(tabs.status).toBe(200);
    expect(tabs.body).toEqual({
      running: true,
      tabs: [tab],
    });

    const snapshot = await dispatcher.dispatch({
      method: "GET",
      path: "/snapshot",
      query: { format: "ai" },
    });
    expect(snapshot.status).toBe(200);
    expect(snapshot.body).toMatchObject({
      ok: true,
      format: "ai",
      targetId: tab.targetId,
      url: tab.url,
      snapshot: "ai",
    });
    expect(mocks.pw.snapshotAiViaPlaywright).toHaveBeenCalledWith({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: tab.targetId,
      maxChars: 80_000,
    });

    const act = await dispatcher.dispatch({
      method: "POST",
      path: "/act",
      body: { kind: "click", ref: "e1" },
    });
    expect(act.status).toBe(200);
    expect(act.body).toEqual({
      ok: true,
      targetId: tab.targetId,
      url: tab.url,
    });
    expect(mocks.pw.clickViaPlaywright).toHaveBeenCalledWith({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: tab.targetId,
      ref: "e1",
      doubleClick: false,
    });

    const consoleResult = await dispatcher.dispatch({
      method: "GET",
      path: "/console",
      query: { level: "error" },
    });
    expect(consoleResult.status).toBe(200);
    expect(consoleResult.body).toEqual({
      ok: true,
      messages: [{ level: "error", text: "boom" }],
      targetId: tab.targetId,
    });

    const pdf = await dispatcher.dispatch({
      method: "POST",
      path: "/pdf",
      body: {},
    });
    expect(pdf.status).toBe(200);
    expect(pdf.body).toEqual({
      ok: true,
      path: mocks.pdfPath,
      targetId: tab.targetId,
      url: tab.url,
    });
    expect(mocks.pw.pdfViaPlaywright).toHaveBeenCalledWith({
      cdpUrl: "http://127.0.0.1:18792",
      targetId: tab.targetId,
    });
  });

  it("accepts selector highlight requests", async () => {
    const { dispatcher, tab } = createHarness();

    const highlight = await dispatcher.dispatch({
      method: "POST",
      path: "/highlight",
      body: { selector: ".primary" },
    });
    expect(highlight.status).toBe(200);
    expect(highlight.body).toEqual({
      ok: true,
      targetId: tab.targetId,
    });
    expect(mocks.pw.highlightViaPlaywright).toHaveBeenCalledWith(
      expect.objectContaining({ selector: ".primary" }),
    );
  });

  it("accepts annotated screenshot requests", async () => {
    const { dispatcher } = createHarness();
    const screenshot = await dispatcher.dispatch({
      method: "POST",
      path: "/screenshot",
      body: { annotate: true },
    });
    expect(screenshot.status).toBe(200);
    expect(screenshot.body).toMatchObject({ ok: true, labels: true, labelsCount: 1 });
    expect(mocks.pw.screenshotWithLabelsViaPlaywright).toHaveBeenCalled();
  });

  it("accepts semantic find requests", async () => {
    const { dispatcher } = createHarness();
    const find = await dispatcher.dispatch({
      method: "POST",
      path: "/find",
      body: { by: "role", value: "button", action: "click", name: "Submit" },
    });
    expect(find.status).toBe(200);
    expect(mocks.pw.findViaPlaywright).toHaveBeenCalledWith(
      expect.objectContaining({ by: "role", value: "button", action: "click", name: "Submit" }),
    );
  });
});
