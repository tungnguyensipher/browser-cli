import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { danger, info } from "./globals.js";
import { defaultRuntime } from "./runtime.js";
import type { BrowserParentOpts } from "./browser-cli-shared.js";
import {
  type DaemonCommand,
  resolveDaemonCommand,
  resolveServicePaths,
  type ServicePlatform,
} from "./browser-cli-service-shared.js";
import {
  renderLaunchdPlist,
  renderSystemdUnit,
  renderWinSwXml,
} from "./browser-cli-service-render.js";
import { runCommandWithRuntime } from "./cli-utils.js";

const execFileAsync = promisify(execFile);

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type BrowserServiceDeps = {
  mkdir: (dirPath: string) => Promise<void>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  copyFile: (from: string, to: string) => Promise<void>;
  rm: (targetPath: string, options: { recursive?: boolean; force?: boolean }) => Promise<void>;
  run: (command: string, args: string[]) => Promise<CommandResult>;
  getUid: () => number;
};

export type BrowserServiceInstallParams = {
  platform?: ServicePlatform;
  homeDir?: string;
  localAppDataDir?: string;
  daemonCommand?: DaemonCommand;
  daemonBin?: string;
  daemonEntry?: string;
  runtimeExecutable?: string;
  env?: Record<string, string>;
  workingDirectory: string;
  winswExecutableSource?: string;
};

export type BrowserServiceStatus = {
  platform: ServicePlatform;
  installed: boolean;
  running: boolean;
};

type BrowserServiceTargetParams = {
  platform?: ServicePlatform;
  homeDir?: string;
  localAppDataDir?: string;
};

function defaultDeps(): BrowserServiceDeps {
  return {
    mkdir: async (dirPath) => {
      await fs.mkdir(dirPath, { recursive: true });
    },
    writeFile: async (filePath, content) => {
      await fs.writeFile(filePath, content, "utf8");
    },
    copyFile: async (from, to) => {
      await fs.copyFile(from, to);
    },
    rm: async (targetPath, options) => {
      await fs.rm(targetPath, { recursive: options.recursive, force: options.force });
    },
    run: async (command, args) => {
      try {
        const result = await execFileAsync(command, args, { encoding: "utf8" });
        return {
          code: 0,
          stdout: result.stdout ?? "",
          stderr: result.stderr ?? "",
        };
      } catch (error) {
        if (typeof error === "object" && error !== null && "stdout" in error && "stderr" in error) {
          const failed = error as { code?: number | string; stdout?: string; stderr?: string };
          return {
            code: typeof failed.code === "number" ? failed.code : 1,
            stdout: failed.stdout ?? "",
            stderr: failed.stderr ?? "",
          };
        }
        throw error;
      }
    },
    getUid: () => process.getuid?.() ?? 0,
  };
}

function normalizeServicePlatform(platform?: ServicePlatform): ServicePlatform {
  return platform ?? (process.platform === "darwin" ? "launchd" : process.platform === "linux" ? "systemd" : "windows");
}

function resolveManagedEnv(env?: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env ?? process.env)
      .filter(([key, value]) => {
        if (!value) {
          return false;
        }
        return key.startsWith("AIBROWSER_") || key === "OPENCLAW_GATEWAY_TOKEN" || key === "CLAWDBOT_GATEWAY_TOKEN";
      })
      .map(([key, value]) => [key, String(value)]),
  );
}

function resolveInstallDaemonCommand(params: BrowserServiceInstallParams): DaemonCommand {
  return (
    params.daemonCommand ??
    resolveDaemonCommand({
      daemonBin: params.daemonBin,
      daemonEntry: params.daemonEntry,
      runtimeExecutable: params.runtimeExecutable,
      mode: params.daemonBin ? "bin" : "source",
    })
  );
}

function assertCommandSucceeded(result: CommandResult, action: string) {
  if (result.code === 0) {
    return;
  }
  const details = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  throw new Error(details ? `${action} failed:\n${details}` : `${action} failed with exit code ${result.code}`);
}

function parseWindowsStatus(result: CommandResult) {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (result.code !== 0 && output.includes("nonexistent")) {
    return { installed: false, running: false };
  }
  if (output.includes("nonexistent")) {
    return { installed: false, running: false };
  }
  if (output.includes("stopped") || output.includes("inactive")) {
    return { installed: true, running: false };
  }
  return { installed: result.code === 0, running: result.code === 0 };
}

export function createBrowserServiceController(rawDeps?: Partial<BrowserServiceDeps>) {
  const deps = { ...defaultDeps(), ...rawDeps } as BrowserServiceDeps;

  return {
    async install(params: BrowserServiceInstallParams): Promise<{ platform: ServicePlatform }> {
      const platform = normalizeServicePlatform(params.platform);
      const paths = resolveServicePaths({
        platform,
        homeDir: params.homeDir,
        localAppDataDir: params.localAppDataDir,
      });
      const daemon = resolveInstallDaemonCommand(params);
      const env = resolveManagedEnv(params.env);

      if (platform === "launchd") {
        if (!paths.serviceDir || !paths.serviceFile) {
          throw new Error("launchd service paths are unavailable");
        }
        await deps.mkdir(paths.serviceDir);
        await deps.mkdir(paths.logsDir);
        await deps.writeFile(
          paths.serviceFile,
          renderLaunchdPlist({
            label: "com.aibrowser.aibrowserd",
            command: daemon.command,
            args: daemon.args,
            workingDirectory: params.workingDirectory,
            env,
            stdoutPath: `${paths.logsDir}/stdout.log`,
            stderrPath: `${paths.logsDir}/stderr.log`,
          }),
        );
        assertCommandSucceeded(await deps.run("launchctl", [
          "bootstrap",
          `gui/${deps.getUid()}`,
          paths.serviceFile,
        ]), "launchctl bootstrap");
        return { platform };
      }

      if (platform === "systemd") {
        if (!paths.serviceDir || !paths.serviceFile) {
          throw new Error("systemd service paths are unavailable");
        }
        await deps.mkdir(paths.serviceDir);
        await deps.mkdir(paths.logsDir);
        await deps.writeFile(
          paths.serviceFile,
          renderSystemdUnit({
            description: "AIBrowser Service",
            command: daemon.command,
            args: daemon.args,
            workingDirectory: params.workingDirectory,
            env,
          }),
        );
        assertCommandSucceeded(await deps.run("systemctl", ["--user", "daemon-reload"]), "systemctl daemon-reload");
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "enable", "--now", "aibrowser.service"]),
          "systemctl enable --now aibrowser.service",
        );
        return { platform };
      }

      if (!params.winswExecutableSource?.trim()) {
        throw new Error("winswExecutableSource is required for Windows service install");
      }
      if (!paths.wrapperDir || !paths.wrapperConfigFile || !paths.wrapperExecutable) {
        throw new Error("windows wrapper paths are unavailable");
      }
      await deps.mkdir(paths.wrapperDir);
      await deps.mkdir(paths.logsDir);
      await deps.copyFile(params.winswExecutableSource.trim(), paths.wrapperExecutable);
      await deps.writeFile(
        paths.wrapperConfigFile,
        renderWinSwXml({
          id: "aibrowser",
          name: "AIBrowser",
          description: "AIBrowser background service",
          command: daemon.command,
          args: daemon.args,
          workingDirectory: params.workingDirectory,
          env,
          logsDir: paths.logsDir,
        }),
      );
      assertCommandSucceeded(await deps.run(paths.wrapperExecutable, ["install"]), "winsw install");
      return { platform };
    },

    async uninstall(params: BrowserServiceTargetParams): Promise<{ platform: ServicePlatform }> {
      const platform = normalizeServicePlatform(params.platform);
      const paths = resolveServicePaths({
        platform,
        homeDir: params.homeDir,
        localAppDataDir: params.localAppDataDir,
      });

      if (platform === "launchd") {
        assertCommandSucceeded(
          await deps.run("launchctl", ["bootout", `gui/${deps.getUid()}/com.aibrowser.aibrowserd`]),
          "launchctl bootout",
        );
        if (paths.serviceFile) {
          await deps.rm(paths.serviceFile, { recursive: true, force: true });
        }
        return { platform };
      }
      if (platform === "systemd") {
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "disable", "--now", "aibrowser.service"]),
          "systemctl disable --now aibrowser.service",
        );
        if (paths.serviceFile) {
          await deps.rm(paths.serviceFile, { recursive: true, force: true });
        }
        return { platform };
      }
      if (!paths.wrapperExecutable) {
        throw new Error("windows wrapper executable path is unavailable");
      }
      assertCommandSucceeded(await deps.run(paths.wrapperExecutable, ["uninstall"]), "winsw uninstall");
      if (paths.wrapperDir) {
        await deps.rm(paths.wrapperDir, { recursive: true, force: true });
      }
      return { platform };
    },

    async status(params: BrowserServiceTargetParams): Promise<BrowserServiceStatus> {
      const platform = normalizeServicePlatform(params.platform);
      const paths = resolveServicePaths({
        platform,
        homeDir: params.homeDir,
        localAppDataDir: params.localAppDataDir,
      });

      if (platform === "launchd") {
        const result = await deps.run("launchctl", ["print", `gui/${deps.getUid()}/com.aibrowser.aibrowserd`]);
        if (result.code !== 0) {
          return { platform, installed: false, running: false };
        }
        return { platform, installed: true, running: true };
      }
      if (platform === "systemd") {
        const enabled = await deps.run("systemctl", ["--user", "is-enabled", "aibrowser.service"]);
        if (enabled.code !== 0) {
          return { platform, installed: false, running: false };
        }
        const active = await deps.run("systemctl", ["--user", "is-active", "aibrowser.service"]);
        return {
          platform,
          installed: true,
          running: active.code === 0 && active.stdout.trim() === "active",
        };
      }
      if (!paths.wrapperExecutable) {
        throw new Error("windows wrapper executable path is unavailable");
      }
      return {
        platform,
        ...parseWindowsStatus(await deps.run(paths.wrapperExecutable, ["status"])),
      };
    },

    async start(params: BrowserServiceTargetParams): Promise<{ platform: ServicePlatform }> {
      const platform = normalizeServicePlatform(params.platform);
      const paths = resolveServicePaths({
        platform,
        homeDir: params.homeDir,
        localAppDataDir: params.localAppDataDir,
      });

      if (platform === "launchd") {
        assertCommandSucceeded(
          await deps.run("launchctl", ["start", `gui/${deps.getUid()}/com.aibrowser.aibrowserd`]),
          "launchctl start",
        );
        return { platform };
      }
      if (platform === "systemd") {
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "start", "aibrowser.service"]),
          "systemctl start aibrowser.service",
        );
        return { platform };
      }
      if (!paths.wrapperExecutable) {
        throw new Error("windows wrapper executable path is unavailable");
      }
      assertCommandSucceeded(await deps.run(paths.wrapperExecutable, ["start"]), "winsw start");
      return { platform };
    },

    async stop(params: BrowserServiceTargetParams): Promise<{ platform: ServicePlatform }> {
      const platform = normalizeServicePlatform(params.platform);
      const paths = resolveServicePaths({
        platform,
        homeDir: params.homeDir,
        localAppDataDir: params.localAppDataDir,
      });

      if (platform === "launchd") {
        assertCommandSucceeded(
          await deps.run("launchctl", ["stop", `gui/${deps.getUid()}/com.aibrowser.aibrowserd`]),
          "launchctl stop",
        );
        return { platform };
      }
      if (platform === "systemd") {
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "stop", "aibrowser.service"]),
          "systemctl stop aibrowser.service",
        );
        return { platform };
      }
      if (!paths.wrapperExecutable) {
        throw new Error("windows wrapper executable path is unavailable");
      }
      assertCommandSucceeded(await deps.run(paths.wrapperExecutable, ["stop"]), "winsw stop");
      return { platform };
    },

    async restart(params: BrowserServiceTargetParams): Promise<{ platform: ServicePlatform }> {
      const platform = normalizeServicePlatform(params.platform);
      const paths = resolveServicePaths({
        platform,
        homeDir: params.homeDir,
        localAppDataDir: params.localAppDataDir,
      });

      if (platform === "launchd") {
        assertCommandSucceeded(
          await deps.run("launchctl", ["kickstart", "-k", `gui/${deps.getUid()}/com.aibrowser.aibrowserd`]),
          "launchctl kickstart -k",
        );
        return { platform };
      }
      if (platform === "systemd") {
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "restart", "aibrowser.service"]),
          "systemctl restart aibrowser.service",
        );
        return { platform };
      }
      if (!paths.wrapperExecutable) {
        throw new Error("windows wrapper executable path is unavailable");
      }
      assertCommandSucceeded(await deps.run(paths.wrapperExecutable, ["restart"]), "winsw restart");
      return { platform };
    },
  };
}

function runServiceCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action, (err) => {
    defaultRuntime.error(danger(String(err)));
    defaultRuntime.exit(1);
  });
}

function printServiceResult(parent: BrowserParentOpts, payload: unknown) {
  if (parent?.json) {
    defaultRuntime.log(JSON.stringify(payload, null, 2));
    return true;
  }
  return false;
}

function resolveDefaultDaemonEntry() {
  return fileURLToPath(new URL("./aibrowserd.ts", import.meta.url));
}

export function registerBrowserServiceCommands(
  browser: Command,
  parentOpts: (cmd: Command) => BrowserParentOpts,
) {
  const controller = createBrowserServiceController();
  const service = browser.command("service").description("Manage OS background services for aibrowserd");

  service
    .command("install")
    .description("Install the browser control service into the OS service manager")
    .option("--winsw-exe <path>", "Path to the WinSW wrapper executable for Windows installs")
    .action(async (opts, cmd) => {
      const parent = parentOpts(cmd);
      await runServiceCommand(async () => {
        const result = await controller.install({
          workingDirectory: process.cwd(),
          winswExecutableSource: opts.winswExe,
          daemonEntry: resolveDefaultDaemonEntry(),
          runtimeExecutable: process.execPath,
          env: process.env as Record<string, string>,
        });
        if (printServiceResult(parent, result)) {
          return;
        }
        defaultRuntime.log(info(`installed ${result.platform} service for aibrowserd`));
      });
    });

  service
    .command("uninstall")
    .description("Uninstall the browser control service from the OS service manager")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      await runServiceCommand(async () => {
        const result = await controller.uninstall({});
        if (printServiceResult(parent, result)) {
          return;
        }
        defaultRuntime.log(info(`uninstalled ${result.platform} service for aibrowserd`));
      });
    });

  service
    .command("status")
    .description("Show OS service manager status for aibrowserd")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      await runServiceCommand(async () => {
        const result = await controller.status({});
        if (printServiceResult(parent, result)) {
          return;
        }
        defaultRuntime.log(
          [`platform: ${result.platform}`, `installed: ${result.installed}`, `running: ${result.running}`].join("\n"),
        );
      });
    });

  service
    .command("start")
    .description("Start the installed browser control service")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      await runServiceCommand(async () => {
        const result = await controller.start({});
        if (printServiceResult(parent, result)) {
          return;
        }
        defaultRuntime.log(info(`started ${result.platform} service for aibrowserd`));
      });
    });

  service
    .command("stop")
    .description("Stop the installed browser control service")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      await runServiceCommand(async () => {
        const result = await controller.stop({});
        if (printServiceResult(parent, result)) {
          return;
        }
        defaultRuntime.log(info(`stopped ${result.platform} service for aibrowserd`));
      });
    });

  service
    .command("restart")
    .description("Restart the installed browser control service")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      await runServiceCommand(async () => {
        const result = await controller.restart({});
        if (printServiceResult(parent, result)) {
          return;
        }
        defaultRuntime.log(info(`restarted ${result.platform} service for aibrowserd`));
      });
    });
}
