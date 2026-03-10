import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { resolveBrowserControlAuth } from "../src/http-auth.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-cli-http-auth-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("http auth", () => {
  it("falls back to machine auth when env and runtime config do not provide a token", () => {
    const dir = createTempDir();
    const machineAuthPath = path.join(dir, "auth.json");
    fs.writeFileSync(machineAuthPath, JSON.stringify({ token: "machine-token" }), "utf8");

    const auth = resolveBrowserControlAuth(
      {},
      {
        BROWSER_CLI_MACHINE_AUTH_PATH: machineAuthPath,
      },
      {
        allowLegacyGatewayTokenFallback: false,
      },
    );

    expect(auth).toEqual({ token: "machine-token" });
  });

  it("prefers BROWSER_CLI_AUTH_TOKEN over machine auth", () => {
    const dir = createTempDir();
    const machineAuthPath = path.join(dir, "auth.json");
    fs.writeFileSync(machineAuthPath, JSON.stringify({ token: "machine-token" }), "utf8");

    const auth = resolveBrowserControlAuth(
      {},
      {
        BROWSER_CLI_AUTH_TOKEN: "env-token",
        BROWSER_CLI_MACHINE_AUTH_PATH: machineAuthPath,
      },
      {
        allowLegacyGatewayTokenFallback: false,
      },
    );

    expect(auth).toEqual({ token: "env-token" });
  });
});
