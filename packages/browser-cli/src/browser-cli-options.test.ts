import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { createProgram } from "./index.js";

const originalCwd = process.cwd();
const originalFetch = globalThis.fetch;
const originalEnv = {
  AIBROWSER_AUTH_TOKEN: process.env.AIBROWSER_AUTH_TOKEN,
  OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN,
  AIBROWSER_MACHINE_AUTH_PATH: process.env.AIBROWSER_MACHINE_AUTH_PATH,
};
const originalLog = console.log;
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aibrowser-cli-options-"));
  tempDirs.push(dir);
  return dir;
}

type RunStatusResult = {
  fetchCalls: Array<{ input: string; auth: string | null }>;
  logs: string[];
};

async function runStatus(argv: string[], cwd: string): Promise<RunStatusResult> {
  process.chdir(cwd);
  const fetchCalls: Array<{ input: string; auth: string | null }> = [];
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    fetchCalls.push({
      input: String(input),
      auth: headers.get("authorization"),
    });
    return new Response(
      JSON.stringify({
        profile: "openclaw",
        enabled: true,
        running: true,
        cdpPort: 18897,
        cdpUrl: "http://127.0.0.1:18897",
        chosenBrowser: null,
        detectedBrowser: "chrome",
        detectedExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        color: "#00AA00",
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  const logs: string[] = [];
  console.log = ((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  }) as typeof console.log;

  const program = createProgram();
  await program.parseAsync(["node", "aibrowser", ...argv]);
  return { fetchCalls, logs };
}

afterEach(() => {
  process.chdir(originalCwd);
  globalThis.fetch = originalFetch;
  console.log = originalLog;
  if (originalEnv.AIBROWSER_AUTH_TOKEN === undefined) {
    delete process.env.AIBROWSER_AUTH_TOKEN;
  } else {
    process.env.AIBROWSER_AUTH_TOKEN = originalEnv.AIBROWSER_AUTH_TOKEN;
  }
  if (originalEnv.OPENCLAW_GATEWAY_TOKEN === undefined) {
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
  } else {
    process.env.OPENCLAW_GATEWAY_TOKEN = originalEnv.OPENCLAW_GATEWAY_TOKEN;
  }
  if (originalEnv.AIBROWSER_MACHINE_AUTH_PATH === undefined) {
    delete process.env.AIBROWSER_MACHINE_AUTH_PATH;
  } else {
    process.env.AIBROWSER_MACHINE_AUTH_PATH = originalEnv.AIBROWSER_MACHINE_AUTH_PATH;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  mock.restore();
});

describe("browser cli option resolution", () => {
  it("uses local defaults when flags and project config are omitted", async () => {
    delete process.env.AIBROWSER_AUTH_TOKEN;
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
    const cwd = makeTempDir();

    const result = await runStatus(["status"], cwd);

    expect(result.fetchCalls[0]).toEqual({
      input: "http://127.0.0.1:18888/?profile=openclaw",
      auth: null,
    });
    expect(result.logs[0]).toContain('"profile": "openclaw"');
  });

  it("uses AIBROWSER_AUTH_TOKEN before project config and applies .aibrowser.json overrides", async () => {
    process.env.AIBROWSER_AUTH_TOKEN = "env-token";
    const cwd = makeTempDir();
    fs.writeFileSync(
      path.join(cwd, ".aibrowser.json"),
      JSON.stringify({
        baseUrl: "http://127.0.0.1:19999",
        authToken: "project-token",
        browserProfile: "chrome",
        json: false,
      }),
      "utf8",
    );

    const result = await runStatus(["status"], cwd);

    expect(result.fetchCalls[0]).toEqual({
      input: "http://127.0.0.1:19999/?profile=chrome",
      auth: "Bearer env-token",
    });
    expect(result.logs[0]).toContain("profile: openclaw");
  });

  it("falls back to machine auth and ignores OPENCLAW_GATEWAY_TOKEN for local CLI auth", async () => {
    delete process.env.AIBROWSER_AUTH_TOKEN;
    process.env.OPENCLAW_GATEWAY_TOKEN = "legacy-token";
    const cwd = makeTempDir();
    const machineAuthPath = path.join(cwd, "machine-auth.json");
    process.env.AIBROWSER_MACHINE_AUTH_PATH = machineAuthPath;
    fs.writeFileSync(machineAuthPath, JSON.stringify({ token: "machine-token" }), "utf8");

    const result = await runStatus(["status"], cwd);

    expect(result.fetchCalls[0]).toEqual({
      input: "http://127.0.0.1:18888/?profile=openclaw",
      auth: "Bearer machine-token",
    });
  });
});
