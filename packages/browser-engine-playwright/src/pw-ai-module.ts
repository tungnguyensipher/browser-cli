export type PwAiModule = typeof import("./pw-ai.js");

type PwAiLoadMode = "soft" | "strict";

let pwAiModuleSoft: Promise<PwAiModule | null> | null = null;
let pwAiModuleStrict: Promise<PwAiModule | null> | null = null;

function isModuleNotFoundError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err && err.code === "ERR_MODULE_NOT_FOUND") {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("Cannot find module") ||
    message.includes("Cannot find package") ||
    message.includes("Failed to resolve import") ||
    message.includes("Failed to resolve entry for package") ||
    message.includes("Failed to load url")
  );
}

async function loadPwAiModule(mode: PwAiLoadMode): Promise<PwAiModule | null> {
  try {
    return await import("./pw-ai.js");
  } catch (err) {
    if (mode === "soft" || isModuleNotFoundError(err)) {
      return null;
    }
    throw err;
  }
}

export async function getPwAiModule(opts?: { mode?: PwAiLoadMode }): Promise<PwAiModule | null> {
  const mode: PwAiLoadMode = opts?.mode ?? "soft";
  if (mode === "soft") {
    if (!pwAiModuleSoft) {
      pwAiModuleSoft = loadPwAiModule("soft");
    }
    return await pwAiModuleSoft;
  }
  if (!pwAiModuleStrict) {
    pwAiModuleStrict = loadPwAiModule("strict");
  }
  return await pwAiModuleStrict;
}
