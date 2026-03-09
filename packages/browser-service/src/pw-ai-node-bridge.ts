import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import type { PwAiModule } from "./pw-ai-module.js";

type PwAiLoadStrategy = "direct-import" | "node-bridge";

type PwAiNodeBridgeRequest = {
  id: number;
  method: string;
  params?: unknown;
};

type PwAiNodeBridgeResponse =
  | {
      id: number;
      ok: true;
      result: unknown;
    }
  | {
      id: number;
      ok: false;
      error: {
        name?: string;
        message: string;
        stack?: string;
      };
    };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

type PwAiBridgeTransport = (method: string, params: unknown) => Promise<unknown>;

type PwAiNodeBridgeClient = PwAiModule & {
  closePlaywrightBrowserConnection: (params?: { cdpUrl?: string }) => Promise<void>;
  dispose: () => Promise<void>;
};

type WorkerState = {
  child: ChildProcessWithoutNullStreams;
  pending: Map<number, PendingRequest>;
  nextId: number;
  stderr: string[];
  disposed: boolean;
};

type NodeWorkerLaunchConfig = {
  entrypoint: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
};

const BUFFER_SENTINEL = "__aibrowserType";
const BUFFER_SENTINEL_VALUE = "Buffer";
const MAX_STDERR_LINES = 50;
let workerStatePromise: Promise<WorkerState> | null = null;

export function resolvePwAiLoadStrategy(versions: NodeJS.ProcessVersions = process.versions): PwAiLoadStrategy {
  return versions.bun ? "node-bridge" : "direct-import";
}

export function deserializePwAiNodeValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  if (
    record[BUFFER_SENTINEL] === BUFFER_SENTINEL_VALUE &&
    typeof record.base64 === "string"
  ) {
    return Buffer.from(record.base64, "base64");
  }
  if (Array.isArray(value)) {
    return value.map((entry) => deserializePwAiNodeValue(entry));
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, deserializePwAiNodeValue(entry)]),
  );
}

function serializeBridgeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

function isAbortSignalLike(value: unknown): value is AbortSignal {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as AbortSignal).aborted === "boolean" &&
      typeof (value as AbortSignal).addEventListener === "function" &&
      typeof (value as AbortSignal).removeEventListener === "function",
  );
}

export function sanitizePwAiNodeParams(value: unknown): unknown {
  if (isAbortSignalLike(value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePwAiNodeParams(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const sanitized = sanitizePwAiNodeParams(entry);
      return sanitized === undefined ? [] : [[key, sanitized] as const];
    }),
  );
}

function createWorkerNotReadyError(message: string, state?: WorkerState): Error {
  const stderr = state?.stderr?.length ? `\n${state.stderr.join("\n")}` : "";
  return new Error(`${message}${stderr}`);
}

function resolveNodeExecutable(): string {
  const configured = process.env.AIBROWSER_NODE_PATH?.trim();
  return configured || "node";
}

function resolveRepoRoot(fromDir: string): string {
  return path.resolve(fromDir, "../../..");
}

function resolveWorkerLaunchConfig(env: NodeJS.ProcessEnv = process.env): NodeWorkerLaunchConfig {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolveRepoRoot(here);
  const tsconfigPath = path.join(repoRoot, "tsconfig.json");
  const tsxLoader = path.resolve(here, "../node_modules/tsx/dist/loader.mjs");
  const sourceWorker = path.resolve(here, "../../browser-engine-playwright/src/node-worker.ts");
  if (fs.existsSync(sourceWorker) && fs.existsSync(tsxLoader)) {
    return {
      entrypoint: sourceWorker,
      args: ["--import", tsxLoader, sourceWorker],
      cwd: repoRoot,
      env: {
        ...env,
        TSX_TSCONFIG_PATH: env.TSX_TSCONFIG_PATH || tsconfigPath,
      },
    };
  }
  const distWorker = path.resolve(here, "../../browser-engine-playwright/dist/node-worker.js");
  if (fs.existsSync(distWorker)) {
    return {
      entrypoint: distWorker,
      args: [distWorker],
      cwd: repoRoot,
      env,
    };
  }
  throw new Error("Playwright node worker entrypoint is missing.");
}

async function ensureWorkerState(): Promise<WorkerState> {
  if (!workerStatePromise) {
    workerStatePromise = startWorkerState();
  }
  return await workerStatePromise;
}

async function startWorkerState(): Promise<WorkerState> {
  const { args, cwd, entrypoint, env } = resolveWorkerLaunchConfig();
  const child = spawn(resolveNodeExecutable(), args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const state: WorkerState = {
    child,
    pending: new Map(),
    nextId: 1,
    stderr: [],
    disposed: false,
  };

  const stdoutReader = readline.createInterface({ input: child.stdout });
  stdoutReader.on("line", (line) => {
    if (!line.trim()) {
      return;
    }
    let parsed: PwAiNodeBridgeResponse;
    try {
      parsed = JSON.parse(line) as PwAiNodeBridgeResponse;
    } catch (error) {
      for (const pending of state.pending.values()) {
        pending.reject(
          createWorkerNotReadyError(
            `Failed to parse Playwright worker response from ${entrypoint}: ${String(error)}`,
            state,
          ),
        );
      }
      state.pending.clear();
      return;
    }
    const pending = state.pending.get(parsed.id);
    if (!pending) {
      return;
    }
    state.pending.delete(parsed.id);
    if (parsed.ok) {
      pending.resolve(parsed.result);
      return;
    }
    const err = new Error(parsed.error.message);
    if (parsed.error.name) {
      err.name = parsed.error.name;
    }
    if (parsed.error.stack) {
      err.stack = parsed.error.stack;
    }
    pending.reject(err);
  });

  const rejectPending = (reason: string) => {
    const error = createWorkerNotReadyError(reason, state);
    for (const pending of state.pending.values()) {
      pending.reject(error);
    }
    state.pending.clear();
  };

  child.stderr.on("data", (chunk) => {
    const text = String(chunk);
    if (!text.trim()) {
      return;
    }
    state.stderr.push(text.trimEnd());
    if (state.stderr.length > MAX_STDERR_LINES) {
      state.stderr.splice(0, state.stderr.length - MAX_STDERR_LINES);
    }
  });

  child.once("error", (error) => {
    workerStatePromise = null;
    rejectPending(`Playwright worker failed to start: ${String(error)}`);
  });

  child.once("exit", (code, signal) => {
    workerStatePromise = null;
    if (state.disposed) {
      return;
    }
    rejectPending(`Playwright worker exited unexpectedly (code=${String(code)}, signal=${String(signal)})`);
  });

  return state;
}

async function requestNodeWorker(method: string, params: unknown): Promise<unknown> {
  const state = await ensureWorkerState();
  if (state.disposed || !state.child.stdin.writable) {
    throw createWorkerNotReadyError("Playwright worker stdin is not writable.", state);
  }
  const id = state.nextId++;
  const payload: PwAiNodeBridgeRequest = { id, method, params: sanitizePwAiNodeParams(params) };

  return await new Promise<unknown>((resolve, reject) => {
    state.pending.set(id, { resolve, reject });
    state.child.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
      if (!error) {
        return;
      }
      state.pending.delete(id);
      reject(serializeBridgeError(error));
    });
  });
}

export function createPwAiNodeBridgeClient(transport: PwAiBridgeTransport): PwAiNodeBridgeClient {
  const handler: ProxyHandler<Record<string, never>> = {
    get(_target, prop) {
      if (prop === "then") {
        return undefined;
      }
      if (prop === "dispose") {
        return async () => {
          await stopPwAiNodeBridge();
        };
      }
      if (typeof prop !== "string") {
        return undefined;
      }
      return async (params?: unknown) => deserializePwAiNodeValue(await transport(prop, params));
    },
  };
  return new Proxy({}, handler) as unknown as PwAiNodeBridgeClient;
}

export { resolveWorkerLaunchConfig };

export async function getNodePwAiModule(): Promise<PwAiNodeBridgeClient> {
  return createPwAiNodeBridgeClient(requestNodeWorker);
}

export async function stopPwAiNodeBridge(): Promise<void> {
  const state = workerStatePromise ? await workerStatePromise.catch(() => null) : null;
  workerStatePromise = null;
  if (!state || state.disposed) {
    return;
  }
  state.disposed = true;
  for (const pending of state.pending.values()) {
    pending.reject(new Error("Playwright worker stopped."));
  }
  state.pending.clear();
  state.child.kill();
}

process.once("exit", () => {
  const statePromise = workerStatePromise;
  if (!statePromise) {
    return;
  }
  void statePromise.then((state) => {
    if (!state.disposed) {
      state.disposed = true;
      state.child.kill();
    }
  });
});
