import path from "node:path";
import { describe, expect, it } from "bun:test";

const daemonEntry = new URL("./browser-clid.ts", import.meta.url).pathname;
const packageDir = path.resolve(path.dirname(daemonEntry), "..");

describe("browser service shared helpers", () => {
  it("resolves service names, service paths, and daemon commands for each supported OS", async () => {
    const {
      resolveBrowserCliServiceName,
      resolveServicePaths,
      resolveDaemonCommand,
    } = await import("./browser-cli-service-shared.js");

    expect(resolveBrowserCliServiceName()).toEqual({
      launchdLabel: "com.browsercli.browser-clid",
      systemdUnit: "browser-cli.service",
      windowsServiceName: "browser-cli",
    });

    expect(
      resolveServicePaths({
        platform: "launchd",
        homeDir: "/Users/tester",
      }),
    ).toEqual({
      serviceDir: "/Users/tester/Library/LaunchAgents",
      serviceFile: "/Users/tester/Library/LaunchAgents/com.browsercli.browser-clid.plist",
      logsDir: "/Users/tester/.browser-cli/service/logs",
      wrapperDir: null,
      wrapperConfigFile: null,
      wrapperExecutable: null,
    });

    expect(
      resolveServicePaths({
        platform: "systemd",
        homeDir: "/home/tester",
      }),
    ).toEqual({
      serviceDir: "/home/tester/.config/systemd/user",
      serviceFile: "/home/tester/.config/systemd/user/browser-cli.service",
      logsDir: "/home/tester/.local/state/browser-cli/service/logs",
      wrapperDir: null,
      wrapperConfigFile: null,
      wrapperExecutable: null,
    });

    expect(
      resolveServicePaths({
        platform: "windows",
        localAppDataDir: "C:\\Users\\tester\\AppData\\Local",
      }),
    ).toEqual({
      serviceDir: null,
      serviceFile: null,
      logsDir: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\logs",
      wrapperDir: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service",
      wrapperConfigFile: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli.xml",
      wrapperExecutable: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli-service.exe",
    });

    const daemon = resolveDaemonCommand({
      runtimeExecutable: "/opt/homebrew/bin/bun",
      daemonEntry,
      mode: "source",
    });
    expect(daemon).toEqual({
      command: "/opt/homebrew/bin/bun",
      args: ["run", daemonEntry, "run"],
      displayCommand: `browser-clid run`,
    });
  });

  it("prefers an explicit daemon bin when provided", async () => {
    const { resolveDaemonCommand } = await import("./browser-cli-service-shared.js");

    expect(
      resolveDaemonCommand({
        daemonBin: "/usr/local/bin/browser-clid",
        daemonEntry,
        mode: "bin",
      }),
    ).toEqual({
      command: "/usr/local/bin/browser-clid",
      args: ["run"],
      displayCommand: "browser-clid run",
    });
  });
});

describe("browser-clid", () => {
  it("exposes a foreground run command", () => {
    const result = Bun.spawnSync({
      cmd: ["bun", "run", daemonEntry, "--help"],
      cwd: packageDir,
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);
    expect(result.exitCode, `stdout:\n${stdout}\n\nstderr:\n${stderr}`).toBe(0);
    expect(stdout).toContain("browser-clid");
    expect(stdout).toContain("run");
  });
});
