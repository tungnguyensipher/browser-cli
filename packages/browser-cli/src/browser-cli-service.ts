import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { writeMachineBrowserControlAuth } from "@aibrowser/browser-shared";
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

/**
 * Resolve the bundled WinSW executable path for the current architecture.
 * Returns null if no bundled executable is available for this platform.
 */
export function resolveBundledWinSwPath(): string | null {
  // Only Windows platforms have bundled WinSW
  if (process.platform !== "win32") {
    return null;
  }

  const arch = process.arch;
  // Note: arm64 not bundled (WinSW v2 doesn't provide arm64 builds)
  const supportedArchs = ["x64", "x86"];

  if (!supportedArchs.includes(arch)) {
    return null;
  }

  // Resolve relative to this file's location in dist/
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const winswPath = path.join(__dirname, "..", "vendor", "winsw", `winsw-${arch}.exe`);

  return winswPath;
}

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
  /** Runtime: "node" | "bun" | custom path (default: "node") */
  runtime?: string;
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

/**
 * Resolve environment variables to include in the service configuration.
 * Excludes BROWSER_CLI_AUTH_TOKEN as it should be stored in ~/.browser-cli/auth.json instead.
 */
function resolveManagedEnv(env?: Record<string, string>): {
  env: Record<string, string>;
  authToken: string | undefined;
} {
  const source = env ?? process.env;
  const authToken = source.BROWSER_CLI_AUTH_TOKEN?.trim();

  const managedEnv = Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => {
        if (!value) {
          return false;
        }
        // Exclude auth token - it goes in auth.json instead
        if (key === "BROWSER_CLI_AUTH_TOKEN") {
          return false;
        }
        return key.startsWith("BROWSER_CLI_");
      })
      .map(([key, value]) => [key, String(value)]),
  );

  return { env: managedEnv, authToken };
}

function resolveInstallDaemonCommand(
  params: BrowserServiceInstallParams,
  runtimeExecutable: string,
): DaemonCommand {
  return (
    params.daemonCommand ??
    resolveDaemonCommand({
      daemonBin: params.daemonBin,
      daemonEntry: params.daemonEntry,
      runtimeExecutable,
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
    async install(params: BrowserServiceInstallParams): Promise<{ platform: ServicePlatform; authWritten: boolean }> {
      const platform = normalizeServicePlatform(params.platform);
      const paths = resolveServicePaths({
        platform,
        homeDir: params.homeDir,
        localAppDataDir: params.localAppDataDir,
      });

      // Resolve runtime executable (node/bun/custom path)
      const runtimeExecutable = await resolveRuntimeExecutable(params.runtime, deps);

      const daemon = resolveInstallDaemonCommand(params, runtimeExecutable);
      const { env, authToken } = resolveManagedEnv(params.env);

      // Write auth token to machine auth file instead of embedding in service config
      let authWritten = false;
      if (authToken) {
        writeMachineBrowserControlAuth({ token: authToken });
        authWritten = true;
      }

      if (platform === "launchd") {
        if (!paths.serviceDir || !paths.serviceFile) {
          throw new Error("launchd service paths are unavailable");
        }
        await deps.mkdir(paths.serviceDir);
        await deps.mkdir(paths.logsDir);
        await deps.writeFile(
          paths.serviceFile,
          renderLaunchdPlist({
            label: "com.browsercli.browser-clid",
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
        return { platform, authWritten };
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
            description: "Browser CLI Service",
            command: daemon.command,
            args: daemon.args,
            workingDirectory: params.workingDirectory,
            env,
          }),
        );
        assertCommandSucceeded(await deps.run("systemctl", ["--user", "daemon-reload"]), "systemctl daemon-reload");
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "enable", "--now", "browser-cli.service"]),
          "systemctl enable --now browser-cli.service",
        );
        return { platform, authWritten };
      }

      // Resolve WinSW executable source: explicit path > bundled > error
      let winswSource = params.winswExecutableSource?.trim();
      if (!winswSource) {
        const bundled = resolveBundledWinSwPath();
        if (!bundled) {
          throw new Error(
            "WinSW executable not found. Please provide --winsw-exe or use a supported architecture (x64, x86, arm64)."
          );
        }
        winswSource = bundled;
      }

      if (!paths.wrapperDir || !paths.wrapperConfigFile || !paths.wrapperExecutable) {
        throw new Error("windows wrapper paths are unavailable");
      }
      await deps.mkdir(paths.wrapperDir);
      await deps.mkdir(paths.logsDir);
      await deps.copyFile(winswSource, paths.wrapperExecutable);
      await deps.writeFile(
        paths.wrapperConfigFile,
        renderWinSwXml({
          id: "browser-cli",
          name: "Browser CLI",
          description: "Browser CLI background service",
          command: daemon.command,
          args: daemon.args,
          workingDirectory: params.workingDirectory,
          env,
          logsDir: paths.logsDir,
        }),
      );
      assertCommandSucceeded(await deps.run(paths.wrapperExecutable, ["install"]), "winsw install");
      return { platform, authWritten };
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
          await deps.run("launchctl", ["bootout", `gui/${deps.getUid()}/com.browsercli.browser-clid`]),
          "launchctl bootout",
        );
        if (paths.serviceFile) {
          await deps.rm(paths.serviceFile, { recursive: true, force: true });
        }
        return { platform };
      }
      if (platform === "systemd") {
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "disable", "--now", "browser-cli.service"]),
          "systemctl disable --now browser-cli.service",
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
        const result = await deps.run("launchctl", ["print", `gui/${deps.getUid()}/com.browsercli.browser-clid`]);
        if (result.code !== 0) {
          return { platform, installed: false, running: false };
        }
        return { platform, installed: true, running: true };
      }
      if (platform === "systemd") {
        const enabled = await deps.run("systemctl", ["--user", "is-enabled", "browser-cli.service"]);
        if (enabled.code !== 0) {
          return { platform, installed: false, running: false };
        }
        const active = await deps.run("systemctl", ["--user", "is-active", "browser-cli.service"]);
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
          await deps.run("launchctl", ["start", `gui/${deps.getUid()}/com.browsercli.browser-clid`]),
          "launchctl start",
        );
        return { platform };
      }
      if (platform === "systemd") {
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "start", "browser-cli.service"]),
          "systemctl start browser-cli.service",
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
          await deps.run("launchctl", ["stop", `gui/${deps.getUid()}/com.browsercli.browser-clid`]),
          "launchctl stop",
        );
        return { platform };
      }
      if (platform === "systemd") {
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "stop", "browser-cli.service"]),
          "systemctl stop browser-cli.service",
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
          await deps.run("launchctl", ["kickstart", "-k", `gui/${deps.getUid()}/com.browsercli.browser-clid`]),
          "launchctl kickstart -k",
        );
        return { platform };
      }
      if (platform === "systemd") {
        assertCommandSucceeded(
          await deps.run("systemctl", ["--user", "restart", "browser-cli.service"]),
          "systemctl restart browser-cli.service",
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

function resolveDefaultDaemonEntry(): string {
  // Use compiled .mjs if available (production), otherwise fall back to .ts (development)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mjsPath = path.join(__dirname, "browser-clid.mjs");
  const tsPath = path.join(__dirname, "browser-clid.ts");

  // Check if .mjs exists (built version)
  try {
    if (require("fs").existsSync(mjsPath)) {
      return mjsPath;
    }
  } catch {
    // ignore
  }

  return tsPath;
}

/**
 * Resolve runtime executable path.
 * - If runtime is undefined/null/"node": returns "node" (default, for service use)
 * - If runtime is "bun": auto-detects bun path from shell
 * - If runtime is a path: returns as-is
 */
async function resolveRuntimeExecutable(
  runtime: string | undefined,
  deps: Pick<BrowserServiceDeps, "run">,
): Promise<string> {
  // Default: node (for services - uses shebang #!/usr/bin/env node)
  if (!runtime || runtime === "node") {
    return "node";
  }

  // Auto-detect bun path from shell
  if (runtime === "bun") {
    const result = await deps.run("which", ["bun"]);
    if (result.code === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
    // Fallback to common bun location
    const homeDir = process.env.HOME ?? process.env.USERPROFILE;
    if (homeDir) {
      return `${homeDir}/.bun/bin/bun`;
    }
    return "bun";
  }

  // Custom path provided
  return runtime;
}

export function registerBrowserServiceCommands(
  browser: Command,
  parentOpts: (cmd: Command) => BrowserParentOpts,
) {
  const controller = createBrowserServiceController();
  const service = browser.command("service").description("Manage OS background services for browser-clid");

  service
    .command("install")
    .description("Install the browser control service into the OS service manager")
    .option(
      "--winsw-exe <path>",
      "Use a custom WinSW executable instead of the bundled version (Windows only)"
    )
    .option(
      "--runtime <runtime>",
      "Runtime to use: 'node' (default), 'bun' (auto-detect), or a custom path"
    )
    .action(async (opts, cmd) => {
      const parent = parentOpts(cmd);
      await runServiceCommand(async () => {
        const result = await controller.install({
          workingDirectory: process.cwd(),
          winswExecutableSource: opts.winswExe,
          daemonEntry: resolveDefaultDaemonEntry(),
          runtime: opts.runtime,
          env: process.env as Record<string, string>,
        });
        if (printServiceResult(parent, result)) {
          return;
        }
        const authMsg = result.authWritten
          ? " (auth token saved to ~/.browser-cli/auth.json)"
          : "";
        defaultRuntime.log(info(`installed ${result.platform} service for browser-clid${authMsg}`));
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
        defaultRuntime.log(info(`uninstalled ${result.platform} service for browser-clid`));
      });
    });

  service
    .command("status")
    .description("Show OS service manager status for browser-clid")
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
        defaultRuntime.log(info(`started ${result.platform} service for browser-clid`));
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
        defaultRuntime.log(info(`stopped ${result.platform} service for browser-clid`));
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
        defaultRuntime.log(info(`restarted ${result.platform} service for browser-clid`));
      });
    });
}
