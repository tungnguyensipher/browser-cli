import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveRuntimeConfigPath } from "@aibrowser/browser-shared";

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveServiceRootDir(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()) {
  const explicit = trimToUndefined(env.AIBROWSER_STATE_DIR);
  if (explicit) {
    return path.resolve(cwd, explicit);
  }
  const configPath = resolveRuntimeConfigPath(env, cwd);
  return path.join(path.dirname(configPath), ".aibrowser");
}

export function ensureDirectory(dirPath: string): string {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveBrowserProfilesRoot(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  return ensureDirectory(path.join(resolveServiceRootDir(env, cwd), "browser"));
}

export function resolveBrowserProfileDir(
  profileName: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  return ensureDirectory(path.join(resolveBrowserProfilesRoot(env, cwd), profileName));
}

export function resolveBrowserUserDataDir(
  profileName: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  return ensureDirectory(path.join(resolveBrowserProfileDir(profileName, env, cwd), "user-data"));
}

export function resolveTempDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const explicit = trimToUndefined(env.AIBROWSER_TMP_DIR);
  if (explicit) {
    return ensureDirectory(path.resolve(cwd, explicit));
  }
  return ensureDirectory(path.join(resolveServiceRootDir(env, cwd), "tmp"));
}

export function resolveHomeDir(): string {
  return os.homedir();
}
