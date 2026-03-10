import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { readMachineBrowserControlAuth } from "@aibrowser/browser-shared";
import type { BrowserParentOpts } from "./browser-cli-shared.js";

const DEFAULT_BROWSER_CLI_BASE_URL = "http://127.0.0.1:18888";
const DEFAULT_BROWSER_CLI_PROFILE = "openclaw";

type BrowserCliProjectConfig = {
  baseUrl?: string;
  authToken?: string;
  browserProfile?: string;
  json?: boolean;
};

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function resolveBrowserCliProjectConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, ".aibrowser.json");
}

export function readBrowserCliProjectConfig(cwd = process.cwd()): BrowserCliProjectConfig {
  const configPath = resolveBrowserCliProjectConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const raw = fs.readFileSync(configPath, "utf8");
  if (!raw.trim()) {
    return {};
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    ...(trimToUndefined(parsed.baseUrl) ? { baseUrl: trimToUndefined(parsed.baseUrl) } : {}),
    ...(trimToUndefined(parsed.authToken) ? { authToken: trimToUndefined(parsed.authToken) } : {}),
    ...(trimToUndefined(parsed.browserProfile)
      ? { browserProfile: trimToUndefined(parsed.browserProfile) }
      : {}),
    ...(booleanOrUndefined(parsed.json) !== undefined ? { json: booleanOrUndefined(parsed.json) } : {}),
  };
}

function hasCliSource(command: Command | undefined, name: string): boolean {
  let current: Command | undefined = command;
  while (current) {
    if (
      typeof current.getOptionValueSource === "function" &&
      current.getOptionValueSource(name) === "cli"
    ) {
      return true;
    }
    current = current.parent ?? undefined;
  }
  return false;
}

export function resolveBrowserCliParentOpts(
  command: Command,
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): BrowserParentOpts {
  const raw = command.optsWithGlobals() as BrowserParentOpts;
  const projectConfig = readBrowserCliProjectConfig(cwd);
  const machineAuth = readMachineBrowserControlAuth(env);

  const baseUrl = hasCliSource(command, "baseUrl")
    ? trimToUndefined(raw.baseUrl)
    : trimToUndefined(projectConfig.baseUrl) ?? DEFAULT_BROWSER_CLI_BASE_URL;

  const authToken = hasCliSource(command, "authToken")
    ? trimToUndefined(raw.authToken)
    : trimToUndefined(env.AIBROWSER_AUTH_TOKEN) ??
      trimToUndefined(projectConfig.authToken) ??
      trimToUndefined(machineAuth.token);

  const browserProfile = hasCliSource(command, "browserProfile")
    ? trimToUndefined(raw.browserProfile)
    : trimToUndefined(projectConfig.browserProfile) ?? DEFAULT_BROWSER_CLI_PROFILE;

  const json = hasCliSource(command, "json")
    ? Boolean(raw.json)
    : projectConfig.json ?? true;

  return {
    ...raw,
    ...(baseUrl ? { baseUrl } : {}),
    ...(authToken ? { authToken } : {}),
    ...(browserProfile ? { browserProfile } : {}),
    json,
  };
}
