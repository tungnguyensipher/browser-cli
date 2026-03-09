import { getPwAiModule } from "./pw-ai-module.js";

export async function closePlaywrightBrowserConnection(params?: {
  cdpUrl?: string;
}): Promise<void> {
  const mod = await getPwAiModule({ mode: "optional" });
  const close = (mod as { closePlaywrightBrowserConnection?: (args?: { cdpUrl?: string }) => Promise<void> } | null)
    ?.closePlaywrightBrowserConnection;
  if (typeof close === "function") {
    await close(params);
  }
}
