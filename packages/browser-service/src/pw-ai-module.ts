export type PwAiModule = {
  listPagesViaPlaywright?: (params: {
    cdpUrl: string;
  }) => Promise<Array<{ targetId: string; title: string; url: string; type?: string }>>;
  createPageViaPlaywright?: (params: {
    cdpUrl: string;
    url: string;
    ssrfPolicy?: unknown;
  }) => Promise<{ targetId: string; title: string; url: string; type?: string }>;
  focusPageByTargetIdViaPlaywright?: (params: {
    cdpUrl: string;
    targetId: string;
  }) => Promise<void>;
  closePageByTargetIdViaPlaywright?: (params: {
    cdpUrl: string;
    targetId: string;
  }) => Promise<void>;
};

export async function getPwAiModule(params?: {
  mode?: "strict" | "optional";
}): Promise<PwAiModule | null> {
  try {
    return (await import("@aibrowser/browser-engine-playwright")) as PwAiModule;
  } catch (error) {
    if (params?.mode === "strict") {
      throw error;
    }
    return null;
  }
}
