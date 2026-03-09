import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { loadRuntimeConfig, resolveRuntimeConfigPath, resolveRuntimeConfigFromEnv } from "../src/runtime-config.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aibrowser-runtime-config-"));
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

describe("runtime config", () => {
  it("resolves the default local config path", () => {
    expect(resolveRuntimeConfigPath({}, "/tmp/aibrowser")).toBe("/tmp/aibrowser/aibrowser.config.json");
  });

  it("loads a local config file and lets env override top-level and nested browser values", () => {
    const cwd = createTempDir();
    fs.writeFileSync(
      path.join(cwd, "aibrowser.config.json"),
      JSON.stringify(
        {
          bindHost: "127.0.0.1",
          outputDir: "./from-file/output",
          auth: {
            token: "file-token",
          },
          browser: {
            controlPort: 18888,
            defaultProfile: "from-file",
            relayBindHost: "127.0.0.1",
            profiles: {
              fromFile: {
                color: "#111111",
                driver: "extension",
              },
            },
            ssrfPolicy: {
              allowedHostnames: ["file.example"],
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const config = loadRuntimeConfig(
      {
        AIBROWSER_BIND_HOST: "0.0.0.0",
        AIBROWSER_OUTPUT_DIR: "./from-env/output",
        AIBROWSER_AUTH_TOKEN: "env-token",
        AIBROWSER_DEFAULT_PROFILE: "from-env",
        AIBROWSER_CONTROL_PORT: "19999",
        AIBROWSER_RELAY_BIND_HOST: "0.0.0.0",
        AIBROWSER_BROWSER_PROFILES: JSON.stringify({
          fromEnv: {
            color: "#222222",
            driver: "openclaw",
            attachOnly: true,
          },
        }),
        AIBROWSER_ALLOWED_HOSTNAMES: "env.example, second.example",
      },
      cwd,
    );

    expect(config.bindHost).toBe("0.0.0.0");
    expect(config.outputDir).toBe("./from-env/output");
    expect(config.auth?.token).toBe("env-token");
    expect(config.browser?.controlPort).toBe(19999);
    expect(config.browser?.defaultProfile).toBe("from-env");
    expect(config.browser?.relayBindHost).toBe("0.0.0.0");
    expect(config.browser?.profiles).toEqual({
      fromFile: {
        color: "#111111",
        driver: "extension",
      },
      fromEnv: {
        color: "#222222",
        driver: "openclaw",
        attachOnly: true,
      },
    });
    expect(config.browser?.ssrfPolicy?.allowedHostnames).toEqual(["env.example", "second.example"]);
  });

  it("falls back to legacy gateway auth env for standalone auth resolution", () => {
    const config = resolveRuntimeConfigFromEnv({
      OPENCLAW_GATEWAY_TOKEN: "legacy-token",
      AIBROWSER_AUTH_PASSWORD: "secret-password",
    });

    expect(config.auth).toEqual({
      token: "legacy-token",
      password: "secret-password",
    });
  });
});
