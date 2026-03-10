import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import os from "node:os";
import path from "node:path";
import { isLoopbackHost } from "./network-security.js";
import { loadRuntimeConfig, type RuntimeAuthConfig, type StandaloneRuntimeConfig } from "./runtime-config.js";

export const RELAY_AUTH_HEADER = "x-openclaw-relay-token";
const RELAY_TOKEN_CONTEXT = "openclaw-extension-relay-v1";
type RelayAuthHeaderResolver = (url: string) => Record<string, string>;
let relayAuthHeaderResolver: RelayAuthHeaderResolver = () => ({});

export type BrowserControlAuth = RuntimeAuthConfig;
export type BrowserControlAuthResolveOptions = {
  allowLegacyGatewayTokenFallback?: boolean;
};

function trimToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstHeaderValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function safeEqualSecret(provided: string | undefined | null, expected: string | undefined | null) {
  if (typeof provided !== "string" || typeof expected !== "string") {
    return false;
  }
  const hash = (input: string) => createHash("sha256").update(input).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

function parseBearerToken(authorization: string): string | undefined {
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    return undefined;
  }
  return trimToUndefined(authorization.slice(7));
}

function parseBasicPassword(authorization: string): string | undefined {
  if (!authorization || !authorization.toLowerCase().startsWith("basic ")) {
    return undefined;
  }
  const encoded = trimToUndefined(authorization.slice(6));
  if (!encoded) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) {
      return undefined;
    }
    return trimToUndefined(decoded.slice(separator + 1));
  } catch {
    return undefined;
  }
}

export function resolveMachineBrowserControlAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  homeDir = os.homedir(),
): string {
  const explicit = trimToUndefined(env.AIBROWSER_MACHINE_AUTH_PATH);
  if (explicit) {
    return path.resolve(homeDir, explicit);
  }
  return path.join(homeDir, ".aibrowser", "auth.json");
}

export function readMachineBrowserControlAuth(
  env: NodeJS.ProcessEnv = process.env,
  homeDir = os.homedir(),
): BrowserControlAuth {
  const authPath = resolveMachineBrowserControlAuthPath(env, homeDir);
  if (!fs.existsSync(authPath)) {
    return {};
  }
  const raw = fs.readFileSync(authPath, "utf8");
  if (!raw.trim()) {
    return {};
  }
  const parsed = JSON.parse(raw) as RuntimeAuthConfig;
  const token = trimToUndefined(parsed?.token);
  const password = trimToUndefined(parsed?.password);
  return {
    ...(token ? { token } : {}),
    ...(password ? { password } : {}),
  };
}

export function writeMachineBrowserControlAuth(
  auth: BrowserControlAuth,
  env: NodeJS.ProcessEnv = process.env,
  homeDir = os.homedir(),
): void {
  const authPath = resolveMachineBrowserControlAuthPath(env, homeDir);
  fs.mkdirSync(path.dirname(authPath), { recursive: true });
  fs.writeFileSync(`${authPath}`, `${JSON.stringify(auth, null, 2)}\n`, "utf8");
}

export function resolveBrowserControlAuth(
  cfg?: StandaloneRuntimeConfig,
  env: NodeJS.ProcessEnv = process.env,
  opts?: BrowserControlAuthResolveOptions,
): BrowserControlAuth {
  const runtimeConfig = cfg ?? loadRuntimeConfig(env);
  const machineAuth = readMachineBrowserControlAuth(env);
  const token =
    trimToUndefined(env.AIBROWSER_AUTH_TOKEN) ??
    trimToUndefined(runtimeConfig.auth?.token) ??
    trimToUndefined(machineAuth.token) ??
    (opts?.allowLegacyGatewayTokenFallback === false
      ? undefined
      : trimToUndefined(env.OPENCLAW_GATEWAY_TOKEN) ??
        trimToUndefined(env.CLAWDBOT_GATEWAY_TOKEN));
  const password =
    trimToUndefined(env.AIBROWSER_AUTH_PASSWORD) ??
    trimToUndefined(runtimeConfig.auth?.password) ??
    trimToUndefined(machineAuth.password) ??
    undefined;
  return {
    ...(token ? { token } : {}),
    ...(password ? { password } : {}),
  };
}

export function isAuthorizedBrowserRequest(
  req: IncomingMessage,
  auth: BrowserControlAuth,
): boolean {
  const authorization = firstHeaderValue(req.headers.authorization).trim();

  if (auth.token) {
    const bearer = parseBearerToken(authorization);
    if (bearer && safeEqualSecret(bearer, auth.token)) {
      return true;
    }
  }

  if (auth.password) {
    const passwordHeader = firstHeaderValue(req.headers["x-openclaw-password"]).trim();
    if (passwordHeader && safeEqualSecret(passwordHeader, auth.password)) {
      return true;
    }

    const basicPassword = parseBasicPassword(authorization);
    if (basicPassword && safeEqualSecret(basicPassword, auth.password)) {
      return true;
    }
  }

  return false;
}

export function deriveRelayAuthToken(authToken: string, port: number): string {
  return createHmac("sha256", authToken).update(`${RELAY_TOKEN_CONTEXT}:${port}`).digest("hex");
}

function parseUrlPort(url: URL): number | null {
  const port =
    url.port.trim() !== "" ? Number(url.port) : url.protocol === "https:" || url.protocol === "wss:" ? 443 : 80;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    return null;
  }
  return port;
}

export function resolveRelayAcceptedTokensForPort(
  port: number,
  authToken?: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const baseToken = trimToUndefined(authToken) ?? resolveBrowserControlAuth(undefined, env).token;
  if (!baseToken) {
    return [];
  }
  const relayToken = deriveRelayAuthToken(baseToken, port);
  return relayToken === baseToken ? [relayToken] : [relayToken, baseToken];
}

export function resolveRelayAuthTokenForPort(
  port: number,
  authToken?: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return resolveRelayAcceptedTokensForPort(port, authToken, env)[0];
}

export function getChromeExtensionRelayAuthHeaders(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const fromRuntime = relayAuthHeaderResolver(url);
  if (Object.keys(fromRuntime).length > 0) {
    return fromRuntime;
  }
  try {
    const parsed = new URL(url);
    if (!isLoopbackHost(parsed.hostname)) {
      return {};
    }
    const port = parseUrlPort(parsed);
    if (!port) {
      return {};
    }
    const relayAuthToken = resolveRelayAuthTokenForPort(port, undefined, env);
    return relayAuthToken ? { [RELAY_AUTH_HEADER]: relayAuthToken } : {};
  } catch {
    return {};
  }
}

export function registerChromeExtensionRelayAuthHeaderResolver(
  resolver: RelayAuthHeaderResolver,
): void {
  relayAuthHeaderResolver = resolver;
}
