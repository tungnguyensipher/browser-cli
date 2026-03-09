import { getNodePwAiModule, resolvePwAiLoadStrategy } from "./pw-ai-node-bridge.js";

export type PwAiModule = {
  listPagesViaPlaywright: (params: {
    cdpUrl: string;
  }) => Promise<Array<{ targetId: string; title: string; url: string; type?: string }>>;
  createPageViaPlaywright: (params: {
    cdpUrl: string;
    url: string;
    ssrfPolicy?: unknown;
  }) => Promise<{ targetId: string; title: string; url: string; type?: string }>;
  focusPageByTargetIdViaPlaywright: (params: {
    cdpUrl: string;
    targetId: string;
  }) => Promise<void>;
  closePageByTargetIdViaPlaywright: (params: {
    cdpUrl: string;
    targetId: string;
  }) => Promise<void>;
  closePageViaPlaywright: (params: { cdpUrl: string; targetId: string }) => Promise<void>;
  navigateViaPlaywright: (params: {
    cdpUrl: string;
    targetId: string;
    url: string;
    ssrfPolicy?: unknown;
  }) => Promise<{ url: string }>;
  pdfViaPlaywright: (params: { cdpUrl: string; targetId: string }) => Promise<{ buffer: Buffer }>;
  takeScreenshotViaPlaywright: (params: {
    cdpUrl: string;
    targetId: string;
    ref?: string;
    element?: string;
    fullPage?: boolean;
    type?: "png" | "jpeg";
  }) => Promise<{ buffer: Buffer }>;
  snapshotRoleViaPlaywright: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  snapshotAiViaPlaywright: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  snapshotAriaViaPlaywright: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  screenshotWithLabelsViaPlaywright: (params: Record<string, unknown>) => Promise<{
    buffer: Buffer;
    labels: number;
    skipped: number;
  }>;
  clickViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  typeViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  pressKeyViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  hoverViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  scrollIntoViewViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  dragViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  selectOptionViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  fillFormViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  resizeViewportViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  waitForViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  evaluateViaPlaywright: (params: Record<string, unknown>) => Promise<unknown>;
  responseBodyViaPlaywright: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  highlightViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  getConsoleMessagesViaPlaywright: (params: Record<string, unknown>) => Promise<unknown[]>;
  getPageErrorsViaPlaywright: (
    params: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  getNetworkRequestsViaPlaywright: (
    params: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  traceStartViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  traceStopViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  waitForDownloadViaPlaywright: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  downloadViaPlaywright: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  setInputFilesViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  armFileUploadViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  armDialogViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  cookiesGetViaPlaywright: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  cookiesSetViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  cookiesClearViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  storageGetViaPlaywright: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  storageSetViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  storageClearViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  setOfflineViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  setExtraHTTPHeadersViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  setHttpCredentialsViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  setGeolocationViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  emulateMediaViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  setTimezoneViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  setLocaleViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
  setDeviceViaPlaywright: (params: Record<string, unknown>) => Promise<void>;
};

export async function getPwAiModule(params?: {
  mode?: "soft" | "strict" | "optional";
}): Promise<PwAiModule | null> {
  if (resolvePwAiLoadStrategy() === "node-bridge") {
    return await getNodePwAiModule();
  }
  try {
    return (await import("@aibrowser/browser-engine-playwright")) as unknown as PwAiModule;
  } catch (error) {
    if (params?.mode === "strict") {
      throw error;
    }
    return null;
  }
}
