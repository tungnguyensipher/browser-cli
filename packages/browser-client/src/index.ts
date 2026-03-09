import {
  browserCloseTab,
  browserCreateProfile,
  browserDeleteProfile,
  browserFocusTab,
  browserOpenTab,
  browserProfiles,
  browserResetProfile,
  browserSnapshot,
  browserStart,
  browserStatus,
  browserStop,
  browserTabAction,
  browserTabs,
  type BrowserCreateProfileResult,
  type BrowserDeleteProfileResult,
  type BrowserResetProfileResult,
  type BrowserStatus,
  type BrowserTab,
  type ProfileStatus,
  type SnapshotResult,
} from "./client.js";
import {
  browserAct,
  browserArmDialog,
  browserArmFileChooser,
  browserDownload,
  browserNavigate,
  browserScreenshotAction,
  browserWaitForDownload,
  type BrowserActRequest,
  type BrowserActResponse,
  type BrowserDownloadPayload,
  type BrowserFormField,
} from "./client-actions-core.js";
import {
  browserConsoleMessages,
  browserHighlight,
  browserPageErrors,
  browserPdfSave,
  browserRequests,
  browserResponseBody,
  browserTraceStart,
  browserTraceStop,
} from "./client-actions-observe.js";
import {
  browserClearPermissions,
  browserCookies,
  browserCookiesClear,
  browserCookiesSet,
  browserSetDevice,
  browserSetGeolocation,
  browserSetHeaders,
  browserSetHttpCredentials,
  browserSetLocale,
  browserSetMedia,
  browserSetOffline,
  browserSetTimezone,
  browserStorageClear,
  browserStorageGet,
  browserStorageSet,
} from "./client-actions-state.js";

type WithOptionalProfile = { profile?: string };

export type BrowserClientOptions = {
  baseUrl?: string;
  defaultProfile?: string;
};

function withDefaultProfile<T extends WithOptionalProfile | undefined>(
  options: T,
  defaultProfile?: string,
): T {
  if (!defaultProfile || options?.profile) {
    return options;
  }
  return { ...(options ?? {}), profile: defaultProfile } as T;
}

export type BrowserClient = {
  browserStatus: (opts?: { profile?: string }) => Promise<BrowserStatus>;
  browserProfiles: () => Promise<ProfileStatus[]>;
  browserStart: (opts?: { profile?: string }) => Promise<void>;
  browserStop: (opts?: { profile?: string }) => Promise<void>;
  browserResetProfile: (opts?: { profile?: string }) => Promise<BrowserResetProfileResult>;
  browserCreateProfile: (opts: {
    name: string;
    color?: string;
    cdpUrl?: string;
    driver?: "openclaw" | "extension";
  }) => Promise<BrowserCreateProfileResult>;
  browserDeleteProfile: (profile: string) => Promise<BrowserDeleteProfileResult>;
  browserTabs: (opts?: { profile?: string }) => Promise<BrowserTab[]>;
  browserOpenTab: (url: string, opts?: { profile?: string }) => Promise<BrowserTab>;
  browserFocusTab: (targetId: string, opts?: { profile?: string }) => Promise<void>;
  browserCloseTab: (targetId: string, opts?: { profile?: string }) => Promise<void>;
  browserTabAction: (opts: {
    action: "list" | "new" | "close" | "select";
    index?: number;
    profile?: string;
  }) => Promise<unknown>;
  browserSnapshot: (opts: {
    format?: "aria" | "ai";
    targetId?: string;
    limit?: number;
    maxChars?: number;
    refs?: "role" | "aria";
    interactive?: boolean;
    compact?: boolean;
    depth?: number;
    selector?: string;
    frame?: string;
    labels?: boolean;
    mode?: "efficient";
    profile?: string;
  }) => Promise<SnapshotResult>;
  browserNavigate: (opts: {
    url: string;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserNavigate>;
  browserArmDialog: (opts: {
    accept: boolean;
    promptText?: string;
    targetId?: string;
    timeoutMs?: number;
    profile?: string;
  }) => ReturnType<typeof browserArmDialog>;
  browserArmFileChooser: (opts: {
    paths: string[];
    ref?: string;
    inputRef?: string;
    element?: string;
    targetId?: string;
    timeoutMs?: number;
    profile?: string;
  }) => ReturnType<typeof browserArmFileChooser>;
  browserWaitForDownload: (opts: {
    path?: string;
    targetId?: string;
    timeoutMs?: number;
    profile?: string;
  }) => ReturnType<typeof browserWaitForDownload>;
  browserDownload: (opts: {
    ref: string;
    path: string;
    targetId?: string;
    timeoutMs?: number;
    profile?: string;
  }) => ReturnType<typeof browserDownload>;
  browserAct: (req: BrowserActRequest, opts?: { profile?: string }) => Promise<BrowserActResponse>;
  browserScreenshotAction: (opts: {
    targetId?: string;
    fullPage?: boolean;
    ref?: string;
    element?: string;
    type?: "png" | "jpeg";
    profile?: string;
  }) => ReturnType<typeof browserScreenshotAction>;
  browserConsoleMessages: (opts?: {
    level?: string;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserConsoleMessages>;
  browserPdfSave: (opts?: { targetId?: string; profile?: string }) => ReturnType<typeof browserPdfSave>;
  browserPageErrors: (opts?: {
    targetId?: string;
    clear?: boolean;
    profile?: string;
  }) => ReturnType<typeof browserPageErrors>;
  browserRequests: (opts?: {
    targetId?: string;
    filter?: string;
    clear?: boolean;
    profile?: string;
  }) => ReturnType<typeof browserRequests>;
  browserTraceStart: (opts?: {
    targetId?: string;
    screenshots?: boolean;
    snapshots?: boolean;
    sources?: boolean;
    profile?: string;
  }) => ReturnType<typeof browserTraceStart>;
  browserTraceStop: (opts?: {
    targetId?: string;
    path?: string;
    profile?: string;
  }) => ReturnType<typeof browserTraceStop>;
  browserHighlight: (opts: {
    ref: string;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserHighlight>;
  browserResponseBody: (opts: {
    url: string;
    targetId?: string;
    timeoutMs?: number;
    maxChars?: number;
    profile?: string;
  }) => ReturnType<typeof browserResponseBody>;
  browserCookies: (opts?: { targetId?: string; profile?: string }) => ReturnType<typeof browserCookies>;
  browserCookiesSet: (opts: {
    cookie: Record<string, unknown>;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserCookiesSet>;
  browserCookiesClear: (opts?: { targetId?: string; profile?: string }) => ReturnType<typeof browserCookiesClear>;
  browserStorageGet: (opts: {
    kind: "local" | "session";
    key?: string;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserStorageGet>;
  browserStorageSet: (opts: {
    kind: "local" | "session";
    key: string;
    value: string;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserStorageSet>;
  browserStorageClear: (opts: {
    kind: "local" | "session";
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserStorageClear>;
  browserSetOffline: (opts: {
    offline: boolean;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserSetOffline>;
  browserSetHeaders: (opts: {
    headers: Record<string, string>;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserSetHeaders>;
  browserSetHttpCredentials: (opts?: {
    username?: string;
    password?: string;
    clear?: boolean;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserSetHttpCredentials>;
  browserSetGeolocation: (opts?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    origin?: string;
    clear?: boolean;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserSetGeolocation>;
  browserSetMedia: (opts: {
    colorScheme: "dark" | "light" | "no-preference" | "none";
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserSetMedia>;
  browserSetTimezone: (opts: {
    timezoneId: string;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserSetTimezone>;
  browserSetLocale: (opts: {
    locale: string;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserSetLocale>;
  browserSetDevice: (opts: {
    name: string;
    targetId?: string;
    profile?: string;
  }) => ReturnType<typeof browserSetDevice>;
  browserClearPermissions: (opts?: { targetId?: string; profile?: string }) => ReturnType<typeof browserClearPermissions>;
};

export function createBrowserClient(options: BrowserClientOptions = {}): BrowserClient {
  const { baseUrl, defaultProfile } = options;

  return {
    browserStatus: (opts) => browserStatus(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserProfiles: () => browserProfiles(baseUrl),
    browserStart: (opts) => browserStart(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserStop: (opts) => browserStop(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserResetProfile: (opts) =>
      browserResetProfile(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserCreateProfile: (opts) => browserCreateProfile(baseUrl, opts),
    browserDeleteProfile: (profile) => browserDeleteProfile(baseUrl, profile),
    browserTabs: (opts) => browserTabs(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserOpenTab: (url, opts) => browserOpenTab(baseUrl, url, withDefaultProfile(opts, defaultProfile)),
    browserFocusTab: (targetId, opts) =>
      browserFocusTab(baseUrl, targetId, withDefaultProfile(opts, defaultProfile)),
    browserCloseTab: (targetId, opts) =>
      browserCloseTab(baseUrl, targetId, withDefaultProfile(opts, defaultProfile)),
    browserTabAction: (opts) => browserTabAction(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserSnapshot: (opts) => browserSnapshot(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserNavigate: (opts) => browserNavigate(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserArmDialog: (opts) => browserArmDialog(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserArmFileChooser: (opts) =>
      browserArmFileChooser(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserWaitForDownload: (opts) =>
      browserWaitForDownload(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserDownload: (opts) => browserDownload(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserAct: (req, opts) => browserAct(baseUrl, req, withDefaultProfile(opts, defaultProfile)),
    browserScreenshotAction: (opts) =>
      browserScreenshotAction(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserConsoleMessages: (opts) =>
      browserConsoleMessages(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserPdfSave: (opts) => browserPdfSave(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserPageErrors: (opts) => browserPageErrors(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserRequests: (opts) => browserRequests(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserTraceStart: (opts) => browserTraceStart(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserTraceStop: (opts) => browserTraceStop(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserHighlight: (opts) => browserHighlight(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserResponseBody: (opts) =>
      browserResponseBody(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserCookies: (opts) => browserCookies(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserCookiesSet: (opts) => browserCookiesSet(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserCookiesClear: (opts) =>
      browserCookiesClear(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserStorageGet: (opts) => browserStorageGet(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserStorageSet: (opts) => browserStorageSet(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserStorageClear: (opts) =>
      browserStorageClear(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserSetOffline: (opts) => browserSetOffline(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserSetHeaders: (opts) => browserSetHeaders(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserSetHttpCredentials: (opts) =>
      browserSetHttpCredentials(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserSetGeolocation: (opts) =>
      browserSetGeolocation(baseUrl, withDefaultProfile(opts, defaultProfile)),
    browserSetMedia: (opts) => browserSetMedia(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserSetTimezone: (opts) =>
      browserSetTimezone(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserSetLocale: (opts) => browserSetLocale(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserSetDevice: (opts) => browserSetDevice(baseUrl, withDefaultProfile(opts, defaultProfile)!),
    browserClearPermissions: (opts) =>
      browserClearPermissions(baseUrl, withDefaultProfile(opts, defaultProfile)),
  };
}

export * from "./client.js";
export * from "./client-actions-types.js";
export * from "./client-actions-core.js";
export * from "./client-actions-observe.js";
export * from "./client-actions-state.js";
export * from "./client-actions.js";
export * from "./client-fetch.js";
