import readline from "node:readline";
import * as mod from "./pw-ai.js";
import { serializeNodeWorkerValue } from "./node-worker.shared.js";

type WorkerRequest = {
  id: number;
  method: string;
  params?: unknown;
};

function writeResponse(payload: unknown) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

input.on("line", async (line) => {
  if (!line.trim()) {
    return;
  }
  let request: WorkerRequest;
  try {
    request = JSON.parse(line) as WorkerRequest;
  } catch (error) {
    writeResponse({
      id: -1,
      ok: false,
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: String(error),
      },
    });
    return;
  }

  try {
    const fn = (mod as Record<string, unknown>)[request.method];
    if (typeof fn !== "function") {
      throw new Error(`Unknown Playwright worker method: ${request.method}`);
    }
    const result = await (fn as (params?: unknown) => Promise<unknown>)(request.params);
    writeResponse({
      id: request.id,
      ok: true,
      result: serializeNodeWorkerValue(result),
    });
  } catch (error) {
    writeResponse({
      id: request.id,
      ok: false,
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
  }
});
