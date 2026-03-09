import crypto from "node:crypto";
import { resolveBrowserControlAuth, type BrowserControlAuth, type StandaloneRuntimeConfig } from "@aibrowser/browser-shared";
import {
  loadStandaloneConfig,
  loadStandaloneConfigFile,
  writeStandaloneConfigFile,
} from "./runtime-config-store.js";

function shouldAutoGenerateBrowserAuth(env: NodeJS.ProcessEnv): boolean {
  const nodeEnv = (env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv === "test") {
    return false;
  }
  const vitest = (env.VITEST ?? "").trim().toLowerCase();
  if (vitest && vitest !== "0" && vitest !== "false" && vitest !== "off") {
    return false;
  }
  return true;
}

export { resolveBrowserControlAuth, type BrowserControlAuth } from "./http-auth.js";

export async function ensureBrowserControlAuth(params?: {
  cfg?: StandaloneRuntimeConfig;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): Promise<{
  auth: BrowserControlAuth;
  generatedToken?: string;
}> {
  const env = params?.env ?? process.env;
  const cwd = params?.cwd ?? process.cwd();
  const cfg = params?.cfg ?? loadStandaloneConfig(env, cwd);
  const auth = resolveBrowserControlAuth(cfg, env);
  if (auth.token || auth.password) {
    return { auth };
  }
  if (!shouldAutoGenerateBrowserAuth(env)) {
    return { auth };
  }

  const latestCfg = loadStandaloneConfigFile(env, cwd);
  const latestAuth = resolveBrowserControlAuth(latestCfg, env);
  if (latestAuth.token || latestAuth.password) {
    return { auth: latestAuth };
  }

  const generatedToken = crypto.randomBytes(24).toString("base64url");
  const nextConfig: StandaloneRuntimeConfig = {
    ...latestCfg,
    auth: {
      ...(latestCfg.auth ?? {}),
      token: generatedToken,
    },
  };
  await writeStandaloneConfigFile(nextConfig, env, cwd);

  return {
    auth: { token: generatedToken },
    generatedToken,
  };
}
