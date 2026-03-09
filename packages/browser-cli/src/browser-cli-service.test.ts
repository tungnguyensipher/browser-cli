import { describe, expect, it } from "bun:test";
import { createProgram } from "./index.js";

function createDeps() {
  const execCalls: Array<{ command: string; args: string[] }> = [];
  const mkdirCalls: string[] = [];
  const writeCalls: Array<{ filePath: string; content: string }> = [];
  const copyCalls: Array<{ from: string; to: string }> = [];
  const rmCalls: Array<{ targetPath: string; recursive: boolean; force: boolean }> = [];
  const runResponses = new Map<string, { code: number; stdout: string; stderr: string }>();

  return {
    execCalls,
    mkdirCalls,
    writeCalls,
    copyCalls,
    rmCalls,
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
    const { deps, execCalls, mkdirCalls, writeCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    const result = await controller.install({
      platform: "launchd",
      homeDir: "/Users/tester",
      daemonCommand: {
        command: "/opt/homebrew/bin/bun",
        args: ["run", "/repo/packages/browser-cli/src/aibrowserd.ts", "run"],
        displayCommand: "aibrowserd run",
      },
      env: {
        AIBROWSER_AUTH_TOKEN: "smoke-token",
        AIBROWSER_CONTROL_PORT: "18888",
      },
      workingDirectory: "/repo",
    });

    expect(result.platform).toBe("launchd");
    expect(mkdirCalls).toContain("/Users/tester/Library/LaunchAgents");
    expect(writeCalls[0]?.filePath).toBe(
      "/Users/tester/Library/LaunchAgents/com.aibrowser.aibrowserd.plist",
    );
    expect(writeCalls[0]?.content).toContain("com.aibrowser.aibrowserd");
    expect(execCalls).toEqual([
      {
        command: "launchctl",
        args: [
          "bootstrap",
          "gui/501",
          "/Users/tester/Library/LaunchAgents/com.aibrowser.aibrowserd.plist",
        ],
      },
    ]);
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
        args: ["run", "/repo/packages/browser-cli/src/aibrowserd.ts", "run"],
        displayCommand: "aibrowserd run",
      },
      env: {
        AIBROWSER_AUTH_TOKEN: "smoke-token",
      },
      workingDirectory: "/repo",
    });

    expect(result.platform).toBe("systemd");
    expect(mkdirCalls).toContain("/home/tester/.config/systemd/user");
    expect(writeCalls[0]?.filePath).toBe("/home/tester/.config/systemd/user/aibrowser.service");
    expect(writeCalls[0]?.content).toContain("ExecStart=/usr/bin/bun run /repo/packages/browser-cli/src/aibrowserd.ts run");
    expect(execCalls).toEqual([
      { command: "systemctl", args: ["--user", "daemon-reload"] },
      { command: "systemctl", args: ["--user", "enable", "--now", "aibrowser.service"] },
    ]);
  });

  it("installs a Windows service by copying WinSW, writing XML, and invoking install", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, copyCalls, execCalls, mkdirCalls, writeCalls } = createDeps();
    const controller = createBrowserServiceController(deps);

    const result = await controller.install({
      platform: "windows",
      localAppDataDir: "C:\\Users\\tester\\AppData\\Local",
      daemonCommand: {
        command: "C:\\Program Files\\Bun\\bun.exe",
        args: ["run", "C:\\repo\\packages\\browser-cli\\src\\aibrowserd.ts", "run"],
        displayCommand: "aibrowserd run",
      },
      env: {
        AIBROWSER_AUTH_TOKEN: "smoke-token",
      },
      winswExecutableSource: "D:\\tools\\winsw.exe",
      workingDirectory: "C:\\repo",
    });

    expect(result.platform).toBe("windows");
    expect(mkdirCalls).toContain("C:\\Users\\tester\\AppData\\Local\\aibrowser\\service");
    expect(copyCalls).toEqual([
      {
        from: "D:\\tools\\winsw.exe",
        to: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser-service.exe",
      },
    ]);
    expect(writeCalls[0]?.filePath).toBe(
      "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser.xml",
    );
    expect(execCalls).toEqual([
      {
        command: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser-service.exe",
        args: ["install"],
      },
    ]);
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
        args: ["print", "gui/501/com.aibrowser.aibrowserd"],
      },
      {
        command: "systemctl",
        args: ["--user", "is-enabled", "aibrowser.service"],
      },
      {
        command: "systemctl",
        args: ["--user", "is-active", "aibrowser.service"],
      },
      {
        command: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser-service.exe",
        args: ["status"],
      },
    ]);
  });

  it("reports missing services without throwing when the platform manager says they are absent", async () => {
    const { createBrowserServiceController } = await import("./browser-cli-service.js");
    const { deps, execCalls, runResponses } = createDeps();
    const controller = createBrowserServiceController(deps);

    runResponses.set(
      JSON.stringify(["launchctl", ["print", "gui/501/com.aibrowser.aibrowserd"]]),
      { code: 113, stdout: "", stderr: "Could not find service" },
    );
    runResponses.set(
      JSON.stringify(["systemctl", ["--user", "is-enabled", "aibrowser.service"]]),
      { code: 1, stdout: "disabled\n", stderr: "" },
    );
    runResponses.set(
      JSON.stringify([
        "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser-service.exe",
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
        args: ["print", "gui/501/com.aibrowser.aibrowserd"],
      },
      {
        command: "systemctl",
        args: ["--user", "is-enabled", "aibrowser.service"],
      },
      {
        command: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser-service.exe",
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
        args: ["bootout", "gui/501/com.aibrowser.aibrowserd"],
      },
      {
        command: "systemctl",
        args: ["--user", "disable", "--now", "aibrowser.service"],
      },
      {
        command: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser-service.exe",
        args: ["uninstall"],
      },
    ]);
    expect(rmCalls).toEqual([
      {
        targetPath: "/Users/tester/Library/LaunchAgents/com.aibrowser.aibrowserd.plist",
        recursive: true,
        force: true,
      },
      {
        targetPath: "/home/tester/.config/systemd/user/aibrowser.service",
        recursive: true,
        force: true,
      },
      {
        targetPath: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service",
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
        args: ["start", "gui/501/com.aibrowser.aibrowserd"],
      },
      {
        command: "systemctl",
        args: ["--user", "stop", "aibrowser.service"],
      },
      {
        command: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\aibrowser-service.exe",
        args: ["restart"],
      },
    ]);
  });
});
