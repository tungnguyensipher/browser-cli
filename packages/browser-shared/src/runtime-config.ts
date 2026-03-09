import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export type BrowserProfileDriver = "openclaw" | "extension";

export type BrowserSsrFPolicyConfig = {
  allowPrivateNetwork?: boolean;
  dangerouslyAllowPrivateNetwork?: boolean;
  allowRfc2544BenchmarkRange?: boolean;
  allowedHostnames?: string[];
  hostnameAllowlist?: string[];
};

export type BrowserProfileConfig = {
  cdpPort?: number;
  cdpUrl?: string;
  driver?: BrowserProfileDriver;
  attachOnly?: boolean;
  color: string;
};

export type BrowserConfig = {
  enabled?: boolean;
  evaluateEnabled?: boolean;
  controlPort?: number;
  cdpUrl?: string;
  remoteCdpTimeoutMs?: number;
  remoteCdpHandshakeTimeoutMs?: number;
  color?: string;
  executablePath?: string;
  headless?: boolean;
  noSandbox?: boolean;
  attachOnly?: boolean;
  cdpPortRangeStart?: number;
  defaultProfile?: string;
  profiles?: Record<string, BrowserProfileConfig>;
  ssrfPolicy?: BrowserSsrFPolicyConfig;
  extraArgs?: string[];
  relayBindHost?: string;
};

export type RuntimeAuthConfig = {
  token?: string;
  password?: string;
};

export type StandaloneRuntimeConfig = {
  bindHost?: string;
  outputDir?: string;
  mediaDir?: string;
  auth?: RuntimeAuthConfig;
  browser?: BrowserConfig;
};

const browserProfileConfigSchema = z.object({
  cdpPort: z.number().int().positive().max(65535).optional(),
  cdpUrl: z.string().trim().min(1).optional(),
  driver: z.enum(["openclaw", "extension"]).optional(),
  attachOnly: z.boolean().optional(),
  color: z.string().trim().min(1),
});

const browserConfigSchema = z.object({
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
  browser: browserConfigSchema.optional(),
});

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numberFromEnv(value: string | undefined): number | undefined {
  const raw = trimToUndefined(value);
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanFromEnv(value: string | undefined): boolean | undefined {
  const raw = trimToUndefined(value)?.toLowerCase();
  if (!raw) {
    return undefined;
  }
  if (["1", "true", "yes", "on"].includes(raw)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(raw)) {
    return false;
  }
  return undefined;
}

function stringArrayFromEnv(value: string | undefined): string[] | undefined {
  const raw = trimToUndefined(value);
  if (!raw) {
    return undefined;
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function recordFromJsonEnv<T>(value: string | undefined): T | undefined {
  const raw = trimToUndefined(value);
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as T;
}

function mergeDefined<T extends object>(base: T | undefined, overlay: Partial<T>): T | undefined {
  if (!base && Object.keys(overlay).length === 0) {
    return undefined;
  }
  return { ...(base ?? ({} as T)), ...overlay };
}

export function resolveRuntimeConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const explicit = trimToUndefined(env.AIBROWSER_CONFIG_PATH);
  if (explicit) {
    return path.resolve(cwd, explicit);
  }
  return path.join(cwd, "aibrowser.config.json");
}

export function readRuntimeConfigFile(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): StandaloneRuntimeConfig {
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

export function resolveRuntimeConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StandaloneRuntimeConfig {
  const browserProfiles = recordFromJsonEnv<Record<string, BrowserProfileConfig>>(
    env.AIBROWSER_BROWSER_PROFILES,
  );
  const browser = mergeDefined<BrowserConfig>(undefined, {
    enabled: booleanFromEnv(env.AIBROWSER_BROWSER_ENABLED),
    evaluateEnabled: booleanFromEnv(env.AIBROWSER_EVALUATE_ENABLED),
    controlPort: numberFromEnv(env.AIBROWSER_CONTROL_PORT),
    cdpUrl: trimToUndefined(env.AIBROWSER_CDP_URL),
    remoteCdpTimeoutMs: numberFromEnv(env.AIBROWSER_REMOTE_CDP_TIMEOUT_MS),
    remoteCdpHandshakeTimeoutMs: numberFromEnv(env.AIBROWSER_REMOTE_CDP_HANDSHAKE_TIMEOUT_MS),
    color: trimToUndefined(env.AIBROWSER_BROWSER_COLOR),
    executablePath: trimToUndefined(env.AIBROWSER_EXECUTABLE_PATH),
    headless: booleanFromEnv(env.AIBROWSER_HEADLESS),
    noSandbox: booleanFromEnv(env.AIBROWSER_NO_SANDBOX),
    attachOnly: booleanFromEnv(env.AIBROWSER_ATTACH_ONLY),
    cdpPortRangeStart: numberFromEnv(env.AIBROWSER_CDP_PORT_RANGE_START),
    defaultProfile: trimToUndefined(env.AIBROWSER_DEFAULT_PROFILE),
    profiles: browserProfiles,
    ssrfPolicy:
      mergeDefined<BrowserSsrFPolicyConfig>(undefined, {
        allowPrivateNetwork: booleanFromEnv(env.AIBROWSER_ALLOW_PRIVATE_NETWORK),
        dangerouslyAllowPrivateNetwork: booleanFromEnv(
          env.AIBROWSER_DANGEROUSLY_ALLOW_PRIVATE_NETWORK,
        ),
        allowRfc2544BenchmarkRange: booleanFromEnv(
          env.AIBROWSER_ALLOW_RFC2544_BENCHMARK_RANGE,
        ),
        allowedHostnames: stringArrayFromEnv(env.AIBROWSER_ALLOWED_HOSTNAMES),
        hostnameAllowlist: stringArrayFromEnv(env.AIBROWSER_HOSTNAME_ALLOWLIST),
      }) ?? undefined,
    extraArgs: stringArrayFromEnv(env.AIBROWSER_EXTRA_ARGS),
    relayBindHost: trimToUndefined(env.AIBROWSER_RELAY_BIND_HOST),
  });

  return standaloneRuntimeConfigSchema.parse({
    bindHost: trimToUndefined(env.AIBROWSER_BIND_HOST),
    outputDir: trimToUndefined(env.AIBROWSER_OUTPUT_DIR),
    mediaDir: trimToUndefined(env.AIBROWSER_MEDIA_DIR),
    auth: mergeDefined<RuntimeAuthConfig>(undefined, {
      token:
        trimToUndefined(env.AIBROWSER_AUTH_TOKEN) ??
        trimToUndefined(env.OPENCLAW_GATEWAY_TOKEN) ??
        trimToUndefined(env.CLAWDBOT_GATEWAY_TOKEN),
      password: trimToUndefined(env.AIBROWSER_AUTH_PASSWORD),
    }),
    browser,
  });
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): StandaloneRuntimeConfig {
  const fileConfig = readRuntimeConfigFile(env, cwd);
  const envConfig = resolveRuntimeConfigFromEnv(env);
  return standaloneRuntimeConfigSchema.parse({
    ...fileConfig,
    ...envConfig,
    auth: {
      ...(fileConfig.auth ?? {}),
      ...(envConfig.auth ?? {}),
    },
    browser: {
      ...(fileConfig.browser ?? {}),
      ...(envConfig.browser ?? {}),
      profiles: {
        ...(fileConfig.browser?.profiles ?? {}),
        ...(envConfig.browser?.profiles ?? {}),
      },
      ssrfPolicy: {
        ...(fileConfig.browser?.ssrfPolicy ?? {}),
        ...(envConfig.browser?.ssrfPolicy ?? {}),
      },
    },
  });
}
