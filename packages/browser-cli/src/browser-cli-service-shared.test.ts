import path from "node:path";
import { describe, expect, it } from "bun:test";

const daemonEntry = path.resolve(process.cwd(), "packages/browser-cli/src/aibrowserd.ts");

describe("browser service shared helpers", () => {
  it("resolves service names, service paths, and daemon commands for each supported OS", async () => {
    const {
      resolveAibrowserServiceName,
      resolveServicePaths,
      resolveDaemonCommand,
    } = await import("./browser-cli-service-shared.js");

    expect(resolveAibrowserServiceName()).toEqual({
      launchdLabel: "com.aibrowser.aibrowserd",
      systemdUnit: "aibrowser.service",
      windowsServiceName: "aibrowser",
    });

    expect(
      resolveServicePaths({
        platform: "launchd",
        homeDir: "/Users/tester",
      }),
    ).toEqual({
      serviceDir: "/Users/tester/Library/LaunchAgents",
      serviceFile: "/Users/tester/Library/LaunchAgents/com.aibrowser.aibrowserd.plist",
      logsDir: "/Users/tester/.aibrowser/service/logs",
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
      serviceFile: "/home/tester/.config/systemd/user/aibrowser.service",
      logsDir: "/home/tester/.local/state/aibrowser/service/logs",
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
      logsDir: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\logs",
      wrapperDir: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service",
      wrapperConfigFile: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser.xml",
      wrapperExecutable: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser-service.exe",
    });

    const daemon = resolveDaemonCommand({
      runtimeExecutable: "/opt/homebrew/bin/bun",
      daemonEntry,
      mode: "source",
    });
    expect(daemon).toEqual({
      command: "/opt/homebrew/bin/bun",
      args: ["run", daemonEntry, "run"],
      displayCommand: `aibrowserd run`,
    });
  });

  it("prefers an explicit daemon bin when provided", async () => {
    const { resolveDaemonCommand } = await import("./browser-cli-service-shared.js");

    expect(
      resolveDaemonCommand({
        daemonBin: "/usr/local/bin/aibrowserd",
        daemonEntry,
        mode: "bin",
      }),
    ).toEqual({
      command: "/usr/local/bin/aibrowserd",
      args: ["run"],
      displayCommand: "aibrowserd run",
    });
  });
});

describe("aibrowserd", () => {
  it("exposes a foreground run command", () => {
    const result = Bun.spawnSync({
      cmd: ["bun", "run", daemonEntry, "--help"],
      cwd: process.cwd(),
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);
    expect(result.exitCode, `stdout:\n${stdout}\n\nstderr:\n${stderr}`).toBe(0);
    expect(stdout).toContain("aibrowserd");
    expect(stdout).toContain("run");
  });
});
