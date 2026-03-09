import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  loadRuntimeConfig,
  resolveRuntimeConfigPath,
  type BrowserProfileConfig,
  type StandaloneRuntimeConfig,
} from "@aibrowser/browser-shared";

const browserProfileConfigSchema = z.object({
  cdpPort: z.number().int().positive().max(65535).optional(),
  cdpUrl: z.string().trim().min(1).optional(),
  driver: z.enum(["openclaw", "extension"]).optional(),
  attachOnly: z.boolean().optional(),
  color: z.string().trim().min(1),
});

const standaloneRuntimeConfigSchema = z.object({
  bindHost: z.string().trim().min(1).optional(),
  outputDir: z.string().trim().min(1).optional(),
  mediaDir: z.string().trim().min(1).optional(),
  auth: z
    .object({
      token: z.string().trim().min(1).optional(),
      password: z.string().trim().min(1).optional(),
    })
    .optional(),
  browser: z
    .object({
      enabled: z.boolean().optional(),
      evaluateEnabled: z.boolean().optional(),
      controlPort: z.number().int().positive().max(65535).optional(),
      cdpUrl: z.string().trim().min(1).optional(),
      remoteCdpTimeoutMs: z.number().int().nonnegative().optional(),
      remoteCdpHandshakeTimeoutMs: z.number().int().nonnegative().optional(),
      color: z.string().trim().min(1).optional(),
      executablePath: z.string().trim().min(1).optional(),
      headless: z.boolean().optional(),
      noSandbox: z.boolean().optional(),
      attachOnly: z.boolean().optional(),
      cdpPortRangeStart: z.number().int().positive().max(65535).optional(),
      defaultProfile: z.string().trim().min(1).optional(),
      profiles: z.record(z.string(), browserProfileConfigSchema).optional(),
      ssrfPolicy: z
        .object({
          allowPrivateNetwork: z.boolean().optional(),
          dangerouslyAllowPrivateNetwork: z.boolean().optional(),
          allowRfc2544BenchmarkRange: z.boolean().optional(),
          allowedHostnames: z.array(z.string()).optional(),
          hostnameAllowlist: z.array(z.string()).optional(),
        })
        .optional(),
      extraArgs: z.array(z.string()).optional(),
      relayBindHost: z.string().trim().min(1).optional(),
    })
    .optional(),
});

export type WritableStandaloneRuntimeConfig = StandaloneRuntimeConfig;

function readConfigFileOnly(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): WritableStandaloneRuntimeConfig {
  const configPath = resolveRuntimeConfigPath(env, cwd);
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const raw = fs.readFileSync(configPath, "utf8");
  if (!raw.trim()) {
    return {};
  }
  return standaloneRuntimeConfigSchema.parse(JSON.parse(raw));
}

export function loadStandaloneConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): WritableStandaloneRuntimeConfig {
  return loadRuntimeConfig(env, cwd);
}

export function loadStandaloneConfigFile(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): WritableStandaloneRuntimeConfig {
  return readConfigFileOnly(env, cwd);
}

export async function writeStandaloneConfigFile(
  nextConfig: WritableStandaloneRuntimeConfig,
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): Promise<void> {
  const configPath = resolveRuntimeConfigPath(env, cwd);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    `${JSON.stringify(standaloneRuntimeConfigSchema.parse(nextConfig), null, 2)}\n`,
    "utf8",
  );
}

export function createStandaloneConfigIO(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): { loadConfig: () => WritableStandaloneRuntimeConfig } {
  return {
    loadConfig: () => loadStandaloneConfigFile(env, cwd),
  };
}

export function mergeProfileConfig(
  config: WritableStandaloneRuntimeConfig,
  name: string,
  profile: BrowserProfileConfig,
): WritableStandaloneRuntimeConfig {
  return {
    ...config,
    browser: {
      ...(config.browser ?? {}),
      profiles: {
        ...(config.browser?.profiles ?? {}),
        [name]: profile,
      },
    },
  };
}
