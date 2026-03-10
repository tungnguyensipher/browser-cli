import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { loadRuntimeConfig, resolveRuntimeConfigPath, resolveRuntimeConfigFromEnv } from "../src/runtime-config.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-cli-runtime-config-"));
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
    expect(resolveRuntimeConfigPath({}, "/tmp/browser-cli")).toBe("/tmp/browser-cli/browser-cli.config.json");
  });

  it("loads a local config file and lets env override top-level and nested browser values", () => {
    const cwd = createTempDir();
    fs.writeFileSync(
      path.join(cwd, "browser-cli.config.json"),
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
        BROWSER_CLI_BIND_HOST: "0.0.0.0",
        BROWSER_CLI_OUTPUT_DIR: "./from-env/output",
        BROWSER_CLI_AUTH_TOKEN: "env-token",
        BROWSER_CLI_DEFAULT_PROFILE: "from-env",
        BROWSER_CLI_CONTROL_PORT: "19999",
        BROWSER_CLI_RELAY_BIND_HOST: "0.0.0.0",
        BROWSER_CLI_BROWSER_PROFILES: JSON.stringify({
          fromEnv: {
            color: "#222222",
            driver: "openclaw",
            attachOnly: true,
          },
        }),
        BROWSER_CLI_ALLOWED_HOSTNAMES: "env.example, second.example",
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

  it("reads Browser CLI auth values from env without legacy gateway fallback", () => {
    const config = resolveRuntimeConfigFromEnv({
      BROWSER_CLI_AUTH_TOKEN: "env-token",
      BROWSER_CLI_AUTH_PASSWORD: "secret-password",
    });

    expect(config.auth).toEqual({
      token: "env-token",
      password: "secret-password",
    });
  });
});
