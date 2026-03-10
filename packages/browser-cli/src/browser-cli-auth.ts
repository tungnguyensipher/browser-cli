import crypto from "node:crypto";
import { spawn } from "node:child_process";
import type { Command } from "commander";
import {
  readMachineBrowserControlAuth,
  resolveMachineBrowserControlAuthPath,
  writeMachineBrowserControlAuth,
  type BrowserControlAuth,
} from "@aibrowser/browser-shared";
import { runCommandWithRuntime } from "./cli-utils.js";
import { info, danger } from "./globals.js";
import { defaultRuntime } from "./runtime.js";
import type { BrowserParentOpts } from "./browser-cli-shared.js";

type BrowserAuthControllerDeps = {
  readAuth: (env?: NodeJS.ProcessEnv, homeDir?: string) => BrowserControlAuth;
  writeAuth: (auth: BrowserControlAuth, env?: NodeJS.ProcessEnv, homeDir?: string) => void;
  resolveAuthPath: (env?: NodeJS.ProcessEnv, homeDir?: string) => string;
  generateSecret: () => string;
  copyToClipboard: (value: string) => Promise<void>;
};

type BrowserAuthResult = {
  authPath: string;
  token: string;
};

function defaultDeps(): BrowserAuthControllerDeps {
  return {
    readAuth: readMachineBrowserControlAuth,
    writeAuth: writeMachineBrowserControlAuth,
    resolveAuthPath: resolveMachineBrowserControlAuthPath,
    generateSecret: () => crypto.randomBytes(24).toString("base64url"),
    copyToClipboard: copyTextToClipboard,
  };
}

function normalizeSecret(secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new Error("Auth secret must not be empty.");
  }
  return trimmed;
}

async function copyTextToClipboard(value: string): Promise<void> {
  const attempts =
    process.platform === "darwin"
      ? [{ command: "pbcopy", args: [] }]
      : process.platform === "win32"
        ? [{ command: "cmd", args: ["/c", "clip"] }]
        : [
            { command: "wl-copy", args: [] },
            { command: "xclip", args: ["-selection", "clipboard"] },
            { command: "xsel", args: ["--clipboard", "--input"] },
          ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(attempt.command, attempt.args, {
          stdio: ["pipe", "ignore", "pipe"],
        });
        let stderr = "";

        child.on("error", reject);
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("close", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(stderr.trim() || `${attempt.command} exited with code ${code ?? 1}`));
        });
        child.stdin.end(value);
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? `: ${lastError.message}` : "";
  throw new Error(`Failed to copy auth secret to clipboard${detail}`);
}

function printAuthResult(parent: BrowserParentOpts, payload: unknown): boolean {
  if (parent?.json) {
    defaultRuntime.log(JSON.stringify(payload, null, 2));
    return true;
  }
  return false;
}

export function createBrowserAuthController(rawDeps?: Partial<BrowserAuthControllerDeps>) {
  const deps = { ...defaultDeps(), ...rawDeps } as BrowserAuthControllerDeps;

  function buildAuth(token: string, env?: NodeJS.ProcessEnv, homeDir?: string): BrowserAuthResult {
    return {
      authPath: deps.resolveAuthPath(env, homeDir),
      token,
    };
  }

  return {
    async regenerate(params?: { env?: NodeJS.ProcessEnv; homeDir?: string }): Promise<BrowserAuthResult> {
      const env = params?.env ?? process.env;
      const existing = deps.readAuth(env, params?.homeDir);
      const token = deps.generateSecret();
      deps.writeAuth({ ...existing, token }, env, params?.homeDir);
      return buildAuth(token, env, params?.homeDir);
    },

    async set(secret: string, params?: { env?: NodeJS.ProcessEnv; homeDir?: string }): Promise<BrowserAuthResult> {
      const env = params?.env ?? process.env;
      const existing = deps.readAuth(env, params?.homeDir);
      const token = normalizeSecret(secret);
      deps.writeAuth({ ...existing, token }, env, params?.homeDir);
      return buildAuth(token, env, params?.homeDir);
    },

    async copy(params?: { env?: NodeJS.ProcessEnv; homeDir?: string }): Promise<BrowserAuthResult> {
      const env = params?.env ?? process.env;
      const existing = deps.readAuth(env, params?.homeDir);
      const token = normalizeSecret(existing.token ?? "");
      await deps.copyToClipboard(token);
      return buildAuth(token, env, params?.homeDir);
    },
  };
}

export function registerBrowserAuthCommands(
  browser: Command,
  parentOpts: (cmd: Command) => BrowserParentOpts,
) {
  const controller = createBrowserAuthController();
  const auth = browser.command("auth").description("Manage the machine auth secret used by browser-clid");

  auth
    .command("regenerate")
    .description("Generate and save a new auth secret")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      await runCommandWithRuntime(defaultRuntime, async () => {
        const result = await controller.regenerate();
        if (printAuthResult(parent, result)) {
          return;
        }
        defaultRuntime.log(info(`saved a new browser auth secret to ${result.authPath}`));
        defaultRuntime.log(result.token);
      }, (err) => {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      });
    });

  auth
    .command("set")
    .description("Set the auth secret explicitly")
    .argument("<secret>", "Secret value to store")
    .action(async (secret, cmd) => {
      const parent = parentOpts(cmd);
      await runCommandWithRuntime(defaultRuntime, async () => {
        const result = await controller.set(secret);
        if (printAuthResult(parent, result)) {
          return;
        }
        defaultRuntime.log(info(`saved browser auth secret to ${result.authPath}`));
      }, (err) => {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      });
    });

  auth
    .command("copy")
    .description("Copy the current auth secret to the clipboard")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      await runCommandWithRuntime(defaultRuntime, async () => {
        const result = await controller.copy();
        if (printAuthResult(parent, result)) {
          return;
        }
        defaultRuntime.log(info(`copied browser auth secret from ${result.authPath} to the clipboard`));
      }, (err) => {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      });
    });
}
