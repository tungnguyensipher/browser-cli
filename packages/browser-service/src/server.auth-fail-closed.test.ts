import net from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function getFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to allocate port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

const mocks = {
  ensureBrowserControlAuth: vi.fn(async () => {
    throw new Error("read-only config");
  }),
  resolveBrowserControlAuth: vi.fn(() => ({})),
  ensureExtensionRelayForProfiles: vi.fn(async () => {}),
};

vi.mock("./control-auth.js", () => ({
  ensureBrowserControlAuth: mocks.ensureBrowserControlAuth,
  resolveBrowserControlAuth: mocks.resolveBrowserControlAuth,
}));

vi.mock("./routes/index.js", () => ({
  registerBrowserRoutes: vi.fn(() => {}),
}));

vi.mock("./server-context.js", () => ({
  createBrowserRouteContext: vi.fn(() => ({})),
}));

vi.mock("./server-lifecycle.js", () => ({
  ensureExtensionRelayForProfiles: mocks.ensureExtensionRelayForProfiles,
  stopKnownBrowserProfiles: vi.fn(async () => {}),
}));

vi.mock("./pw-ai-state.js", () => ({
  isPwAiLoaded: vi.fn(() => false),
}));

const { startBrowserControlServerFromConfig, stopBrowserControlServer } =
  await import("./server.js");

describe("browser control auth bootstrap failures", () => {
  let previousEnabled: string | undefined;
  let previousPort: string | undefined;

  beforeEach(async () => {
    previousEnabled = process.env.BROWSER_CLI_BROWSER_ENABLED;
    previousPort = process.env.BROWSER_CLI_CONTROL_PORT;
    process.env.BROWSER_CLI_BROWSER_ENABLED = "1";
    process.env.BROWSER_CLI_CONTROL_PORT = String(await getFreePort());
    mocks.ensureBrowserControlAuth.mockClear();
    mocks.resolveBrowserControlAuth.mockClear();
    mocks.ensureExtensionRelayForProfiles.mockClear();
  });

  afterEach(async () => {
    await stopBrowserControlServer();
    if (previousEnabled === undefined) {
      delete process.env.BROWSER_CLI_BROWSER_ENABLED;
    } else {
      process.env.BROWSER_CLI_BROWSER_ENABLED = previousEnabled;
    }
    if (previousPort === undefined) {
      delete process.env.BROWSER_CLI_CONTROL_PORT;
    } else {
      process.env.BROWSER_CLI_CONTROL_PORT = previousPort;
    }
  });

  it("fails closed when auth bootstrap throws and no auth is configured", async () => {
    const started = await startBrowserControlServerFromConfig();

    expect(started).toBeNull();
    expect(mocks.ensureBrowserControlAuth).toHaveBeenCalledTimes(1);
    expect(mocks.resolveBrowserControlAuth).toHaveBeenCalledTimes(1);
    expect(mocks.ensureExtensionRelayForProfiles).not.toHaveBeenCalled();
  });
});
