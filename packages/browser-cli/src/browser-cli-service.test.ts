import { describe, expect, it } from "bun:test";
import { createProgram } from "./index.js";

function createDeps() {
  const execCalls: Array<{ command: string; args: string[] }> = [];
  const mkdirCalls: string[] = [];
  const writeCalls: Array<{ filePath: string; content: string }> = [];
  const copyCalls: Array<{ from: string; to: string }> = [];
  const rmCalls: Array<{ targetPath: string; recursive: boolean; force: boolean }> = [];
  const writeAuthCalls: Array<{ auth: Record<string, string>; homeDir?: string }> = [];
  const runResponses = new Map<string, { code: number; stdout: string; stderr: string }>();

  return {
    execCalls,
    mkdirCalls,
    writeCalls,
    copyCalls,
    rmCalls,
    writeAuthCalls,
    runResponses,
    deps: {
      mkdir: async (dirPath: string) => {
        mkdirCalls.push(dirPath);
      },
      writeFile: async (filePath: string, content: string) => {
        writeCalls.push({ filePath, content });
      },
      copyFile: async (from: string, to: string) => {
        copyCalls.push({ from, to });
      },
      rm: async (targetPath: string, options: { recursive?: boolean; force?: boolean }) => {
        rmCalls.push({
          targetPath,
          recursive: options.recursive ?? false,
          force: options.force ?? false,
        });
      },
      readAuth: () => ({}),
      writeAuth: async (
        auth: Record<string, string>,
        _env?: Record<string, string>,
        homeDir?: string,
      ) => {
        writeAuthCalls.push({ auth, homeDir });
      },
      run: async (command: string, args: string[]) => {
        execCalls.push({ command, args });
        return runResponses.get(JSON.stringify([command, args])) ?? {
          code: 0,
          stdout: "active\n",
          stderr: "",
        };
      },
      getUid: () => 501,
    },
  };
}

describe("browser service commands", () => {
  it("adds the service command family to the root CLI", () => {
    const program = createProgram();
    const help = program.helpInformation();

    expect(help).toContain("service");
  });

  it("installs a launchd user service by writing a plist and bootstrapping it", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, execCalls, mkdirCalls, writeAuthCalls, writeCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    const result = await controller.install({
      platform: "launchd",
      homeDir: "/Users/tester",
      daemonCommand: {
        command: "/opt/homebrew/bin/bun",
        args: ["run", "/repo/packages/browser-cli/src/browser-clid.ts", "run"],
        displayCommand: "browser-clid run",
      },
      env: {
        BROWSER_CLI_AUTH_TOKEN: "smoke-token",
        BROWSER_CLI_CONTROL_PORT: "18888",
      },
      workingDirectory: "/repo",
    });

    expect(result.platform).toBe("launchd");
    expect(mkdirCalls).toContain("/Users/tester/Library/LaunchAgents");
    expect(writeCalls[0]?.filePath).toBe(
      "/Users/tester/Library/LaunchAgents/com.browsercli.browser-clid.plist",
    );
    expect(writeCalls[0]?.content).toContain("com.browsercli.browser-clid");
    expect(writeCalls[0]?.content).toContain("<string>/Users/tester/.browser-cli</string>");
    expect(writeAuthCalls).toEqual([{ auth: { token: "smoke-token" }, homeDir: "/Users/tester" }]);
    expect(execCalls).toEqual([
      {
        command: "launchctl",
        args: [
          "bootstrap",
          "gui/501",
          "/Users/tester/Library/LaunchAgents/com.browsercli.browser-clid.plist",
        ],
      },
    ]);
  });

  it("generates a new auth token during install when none is provided", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, writeAuthCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    const result = await controller.install({
      platform: "launchd",
      homeDir: "/Users/tester",
      daemonCommand: {
        command: "/opt/homebrew/bin/bun",
        args: ["run", "/repo/packages/browser-cli/src/browser-clid.ts", "run"],
        displayCommand: "browser-clid run",
      },
      env: {
        BROWSER_CLI_CONTROL_PORT: "18888",
      },
      workingDirectory: "/repo",
    });

    expect(result.platform).toBe("launchd");
    expect(result.authWritten).toBe(true);
    expect(writeAuthCalls).toHaveLength(1);
    expect(writeAuthCalls[0]?.homeDir).toBe("/Users/tester");
    expect(writeAuthCalls[0]?.auth.token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  });

  it("installs a systemd user service by writing a unit and enabling it", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, execCalls, mkdirCalls, writeCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    const result = await controller.install({
      platform: "systemd",
      homeDir: "/home/tester",
      daemonCommand: {
        command: "/usr/bin/bun",
        args: ["run", "/repo/packages/browser-cli/src/browser-clid.ts", "run"],
        displayCommand: "browser-clid run",
      },
      env: {
        BROWSER_CLI_AUTH_TOKEN: "smoke-token",
      },
      workingDirectory: "/repo",
    });

    expect(result.platform).toBe("systemd");
    expect(mkdirCalls).toContain("/home/tester/.config/systemd/user");
    expect(mkdirCalls).toContain("/home/tester/.browser-cli");
    expect(writeCalls[0]?.filePath).toBe("/home/tester/.config/systemd/user/browser-cli.service");
    expect(writeCalls[0]?.content).toContain("WorkingDirectory=/home/tester/.browser-cli");
    expect(writeCalls[0]?.content).toContain("ExecStart=/usr/bin/bun run /repo/packages/browser-cli/src/browser-clid.ts run");
    expect(execCalls).toEqual([
      { command: "systemctl", args: ["--user", "daemon-reload"] },
      { command: "systemctl", args: ["--user", "enable", "--now", "browser-cli.service"] },
    ]);
  });

  it("installs a Windows service using explicit --winsw-exe path", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, copyCalls, execCalls, mkdirCalls, writeCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    const result = await controller.install({
      platform: "windows",
      homeDir: "C:\\Users\\tester",
      localAppDataDir: "C:\\Users\\tester\\AppData\\Local",
      daemonCommand: {
        command: "C:\\Program Files\\Bun\\bun.exe",
        args: ["run", "C:\\repo\\packages\\browser-cli\\src\\browser-clid.ts", "run"],
        displayCommand: "browser-clid run",
      },
      env: {
        BROWSER_CLI_AUTH_TOKEN: "smoke-token",
      },
      winswExecutableSource: "D:\\tools\\winsw.exe",
      workingDirectory: "C:\\repo",
    });

    expect(result.platform).toBe("windows");
    expect(mkdirCalls).toContain("C:\\Users\\tester\\AppData\\Local\\browser-cli\\service");
    expect(mkdirCalls).toContain("C:\\Users\\tester\\.browser-cli");
    expect(copyCalls).toEqual([
      {
        from: "D:\\tools\\winsw.exe",
        to: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli-service.exe",
      },
    ]);
    expect(writeCalls[0]?.filePath).toBe(
      "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli.xml",
    );
    expect(writeCalls[0]?.content).toContain("<workingdirectory>C:\\Users\\tester\\.browser-cli</workingdirectory>");
    expect(execCalls).toEqual([
      {
        command: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli-service.exe",
        args: ["install"],
      },
    ]);
  });

  it("throws when installing on Windows without bundled WinSW or explicit path", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps } = createDeps();
    const controller = createBrowserServiceController(deps);

    // Simulate Windows platform with unsupported architecture to trigger the bundled check failure
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    const originalArch = Object.getOwnPropertyDescriptor(process, "arch");
    Object.defineProperty(process, "platform", {
      value: "win32",
    });
    Object.defineProperty(process, "arch", {
      value: "mips", // Unsupported architecture
    });

    try {
      await controller.install({
        platform: "windows",
        localAppDataDir: "C:\\Users\\tester\\AppData\\Local",
        daemonCommand: {
          command: "C:\\Program Files\\Bun\\bun.exe",
          args: ["run", "C:\\repo\\packages\\browser-cli\\src\\browser-clid.ts", "run"],
          displayCommand: "browser-clid run",
        },
        env: {},
        workingDirectory: "C:\\repo",
        // No winswExecutableSource provided
      });

      throw new Error("Should have thrown");
    } catch (error) {
      expect(error.message).toContain("WinSW executable not found");
    } finally {
      Object.defineProperty(process, "platform", originalPlatform!);
      Object.defineProperty(process, "arch", originalArch!);
    }
  });

  it("reports service status through the platform-specific manager", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, execCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    const launchd = await controller.status({
      platform: "launchd",
      homeDir: "/Users/tester",
    });
    const systemd = await controller.status({
      platform: "systemd",
      homeDir: "/home/tester",
    });
    const windows = await controller.status({
      platform: "windows",
      localAppDataDir: "C:\\Users\\tester\\AppData\\Local",
    });

    expect(launchd).toMatchObject({ platform: "launchd", installed: true, running: true });
    expect(systemd).toMatchObject({ platform: "systemd", installed: true, running: true });
    expect(windows).toMatchObject({ platform: "windows", installed: true, running: true });
    expect(execCalls).toEqual([
      {
        command: "launchctl",
        args: ["print", "gui/501/com.browsercli.browser-clid"],
      },
      {
        command: "systemctl",
        args: ["--user", "is-enabled", "browser-cli.service"],
      },
      {
        command: "systemctl",
        args: ["--user", "is-active", "browser-cli.service"],
      },
      {
        command: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli-service.exe",
        args: ["status"],
      },
    ]);
  });

  it("reports missing services without throwing when the platform manager says they are absent", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, execCalls, runResponses } = createDeps();
    const controller = createBrowserServiceController(deps);

    runResponses.set(
      JSON.stringify(["launchctl", ["print", "gui/501/com.browsercli.browser-clid"]]),
      { code: 113, stdout: "", stderr: "Could not find service" },
    );
    runResponses.set(
      JSON.stringify(["systemctl", ["--user", "is-enabled", "browser-cli.service"]]),
      { code: 1, stdout: "disabled\n", stderr: "" },
    );
    runResponses.set(
      JSON.stringify([
        "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli-service.exe",
        ["status"],
      ]),
      { code: 1, stdout: "NonExistent\n", stderr: "" },
    );

    const launchd = await controller.status({
      platform: "launchd",
      homeDir: "/Users/tester",
    });
    const systemd = await controller.status({
      platform: "systemd",
      homeDir: "/home/tester",
    });
    const windows = await controller.status({
      platform: "windows",
      localAppDataDir: "C:\\Users\\tester\\AppData\\Local",
    });

    expect(launchd).toMatchObject({ platform: "launchd", installed: false, running: false });
    expect(systemd).toMatchObject({ platform: "systemd", installed: false, running: false });
    expect(windows).toMatchObject({ platform: "windows", installed: false, running: false });
    expect(execCalls).toEqual([
      {
        command: "launchctl",
        args: ["print", "gui/501/com.browsercli.browser-clid"],
      },
      {
        command: "systemctl",
        args: ["--user", "is-enabled", "browser-cli.service"],
      },
      {
        command: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli-service.exe",
        args: ["status"],
      },
    ]);
  });

  it("uninstalls services through the platform-specific manager", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, execCalls, rmCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    await controller.uninstall({
      platform: "launchd",
      homeDir: "/Users/tester",
    });
    await controller.uninstall({
      platform: "systemd",
      homeDir: "/home/tester",
    });
    await controller.uninstall({
      platform: "windows",
      localAppDataDir: "C:\\Users\\tester\\AppData\\Local",
    });

    expect(execCalls).toEqual([
      {
        command: "launchctl",
        args: ["bootout", "gui/501/com.browsercli.browser-clid"],
      },
      {
        command: "systemctl",
        args: ["--user", "disable", "--now", "browser-cli.service"],
      },
      {
        command: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli-service.exe",
        args: ["uninstall"],
      },
    ]);
    expect(rmCalls).toEqual([
      {
        targetPath: "/Users/tester/Library/LaunchAgents/com.browsercli.browser-clid.plist",
        recursive: true,
        force: true,
      },
      {
        targetPath: "/home/tester/.config/systemd/user/browser-cli.service",
        recursive: true,
        force: true,
      },
      {
        targetPath: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service",
        recursive: true,
        force: true,
      },
    ]);
  });

  it("controls installed services through start, stop, and restart commands", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, execCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    await controller.start({
      platform: "launchd",
    });
    await controller.stop({
      platform: "systemd",
    });
    await controller.restart({
      platform: "windows",
      localAppDataDir: "C:\\Users\\tester\\AppData\\Local",
    });

    expect(execCalls).toEqual([
      {
        command: "launchctl",
        args: ["start", "gui/501/com.browsercli.browser-clid"],
      },
      {
        command: "systemctl",
        args: ["--user", "stop", "browser-cli.service"],
      },
      {
        command: "C:\\Users\\tester\\AppData\\Local\\browser-cli\\service\\browser-cli-service.exe",
        args: ["restart"],
      },
    ]);
  });
});

describe("resolveBundledWinSwPath", () => {
  it("returns null on non-Windows platforms", async () => {
    const { resolveBundledWinSwPath } = await import("./browser-cli-service.js");

    // Save original platform
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

    // Test non-Windows platforms
    for (const platform of ["darwin", "linux", "freebsd"]) {
      Object.defineProperty(process, "platform", {
        value: platform,
      });

      expect(resolveBundledWinSwPath()).toBeNull();
    }

    // Restore original platform
    Object.defineProperty(process, "platform", originalPlatform!);
  });

  it("returns null for unsupported architectures on Windows", async () => {
    const { resolveBundledWinSwPath } = await import("./browser-cli-service.js");

    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    const originalArch = Object.getOwnPropertyDescriptor(process, "arch");

    Object.defineProperty(process, "platform", { value: "win32" });
    Object.defineProperty(process, "arch", { value: "mips" });

    expect(resolveBundledWinSwPath()).toBeNull();

    Object.defineProperty(process, "platform", originalPlatform!);
    Object.defineProperty(process, "arch", originalArch!);
  });

  it("returns a path for supported Windows architectures", async () => {
    const { resolveBundledWinSwPath } = await import("./browser-cli-service.js");

    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    const originalArch = Object.getOwnPropertyDescriptor(process, "arch");

    Object.defineProperty(process, "platform", { value: "win32" });

    // Note: arm64 not bundled (WinSW v2 doesn't provide arm64 builds)
    for (const arch of ["x64", "x86"]) {
      Object.defineProperty(process, "arch", { value: arch });

      const result = resolveBundledWinSwPath();
      expect(result).not.toBeNull();
      expect(result).toContain(`winsw-${arch}.exe`);
    }

    Object.defineProperty(process, "platform", originalPlatform!);
    Object.defineProperty(process, "arch", originalArch!);
  });
});

describe("resolveRuntimeExecutable", () => {
  it("resolves node to a full path on macOS/Linux shells", async () => {
    const { resolveRuntimeExecutable } = await import("./browser-cli-service.js");
    const execCalls: Array<{ command: string; args: string[] }> = [];

    const resolved = await resolveRuntimeExecutable(undefined, {
      run: async (command, args) => {
        execCalls.push({ command, args });
        return {
          code: 0,
          stdout: "/usr/local/bin/node\n",
          stderr: "",
        };
      },
    });

    expect(resolved).toBe("/usr/local/bin/node");
    expect(execCalls).toEqual([{ command: "which", args: ["node"] }]);
  });

  it("resolves bun to a full path on Windows shells", async () => {
    const { resolveRuntimeExecutable } = await import("./browser-cli-service.js");
    const execCalls: Array<{ command: string; args: string[] }> = [];
    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");

    Object.defineProperty(process, "platform", {
      value: "win32",
    });

    try {
      const resolved = await resolveRuntimeExecutable("bun", {
        run: async (command, args) => {
          execCalls.push({ command, args });
          return {
            code: 0,
            stdout: "C:\\Users\\tester\\.bun\\bin\\bun.exe\r\n",
            stderr: "",
          };
        },
      });

      expect(resolved).toBe("C:\\Users\\tester\\.bun\\bin\\bun.exe");
      expect(execCalls).toEqual([{ command: "where", args: ["bun"] }]);
    } finally {
      Object.defineProperty(process, "platform", originalPlatform!);
    }
  });
});
