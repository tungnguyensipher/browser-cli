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
import type { BrowserTransport } from "./client-actions-url.js";
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
  authToken?: string;
  authPassword?: string;
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
  const { authPassword, authToken, baseUrl, defaultProfile } = options;
  const transport: BrowserTransport | undefined =
    authToken || authPassword
      ? {
          baseUrl,
          auth: {
            ...(authToken ? { token: authToken } : {}),
            ...(authPassword ? { password: authPassword } : {}),
          },
        }
      : baseUrl;

  return {
    browserStatus: (opts) => browserStatus(transport, withDefaultProfile(opts, defaultProfile)),
    browserProfiles: () => browserProfiles(transport),
    browserStart: (opts) => browserStart(transport, withDefaultProfile(opts, defaultProfile)),
    browserStop: (opts) => browserStop(transport, withDefaultProfile(opts, defaultProfile)),
    browserResetProfile: (opts) =>
      browserResetProfile(transport, withDefaultProfile(opts, defaultProfile)),
    browserCreateProfile: (opts) => browserCreateProfile(transport, opts),
    browserDeleteProfile: (profile) => browserDeleteProfile(transport, profile),
    browserTabs: (opts) => browserTabs(transport, withDefaultProfile(opts, defaultProfile)),
    browserOpenTab: (url, opts) =>
      browserOpenTab(transport, url, withDefaultProfile(opts, defaultProfile)),
    browserFocusTab: (targetId, opts) =>
      browserFocusTab(transport, targetId, withDefaultProfile(opts, defaultProfile)),
    browserCloseTab: (targetId, opts) =>
      browserCloseTab(transport, targetId, withDefaultProfile(opts, defaultProfile)),
    browserTabAction: (opts) =>
      browserTabAction(transport, withDefaultProfile(opts, defaultProfile)!),
    browserSnapshot: (opts) => browserSnapshot(transport, withDefaultProfile(opts, defaultProfile)!),
    browserNavigate: (opts) => browserNavigate(transport, withDefaultProfile(opts, defaultProfile)!),
    browserArmDialog: (opts) =>
      browserArmDialog(transport, withDefaultProfile(opts, defaultProfile)!),
    browserArmFileChooser: (opts) =>
      browserArmFileChooser(transport, withDefaultProfile(opts, defaultProfile)!),
    browserWaitForDownload: (opts) =>
      browserWaitForDownload(transport, withDefaultProfile(opts, defaultProfile)!),
    browserDownload: (opts) =>
      browserDownload(transport, withDefaultProfile(opts, defaultProfile)!),
    browserAct: (req, opts) =>
      browserAct(transport, req, withDefaultProfile(opts, defaultProfile)),
    browserScreenshotAction: (opts) =>
      browserScreenshotAction(transport, withDefaultProfile(opts, defaultProfile)!),
    browserConsoleMessages: (opts) =>
      browserConsoleMessages(transport, withDefaultProfile(opts, defaultProfile)),
    browserPdfSave: (opts) => browserPdfSave(transport, withDefaultProfile(opts, defaultProfile)),
    browserPageErrors: (opts) =>
      browserPageErrors(transport, withDefaultProfile(opts, defaultProfile)),
    browserRequests: (opts) => browserRequests(transport, withDefaultProfile(opts, defaultProfile)),
    browserTraceStart: (opts) =>
      browserTraceStart(transport, withDefaultProfile(opts, defaultProfile)),
    browserTraceStop: (opts) => browserTraceStop(transport, withDefaultProfile(opts, defaultProfile)),
    browserHighlight: (opts) =>
      browserHighlight(transport, withDefaultProfile(opts, defaultProfile)!),
    browserResponseBody: (opts) =>
      browserResponseBody(transport, withDefaultProfile(opts, defaultProfile)!),
    browserCookies: (opts) => browserCookies(transport, withDefaultProfile(opts, defaultProfile)),
    browserCookiesSet: (opts) =>
      browserCookiesSet(transport, withDefaultProfile(opts, defaultProfile)!),
    browserCookiesClear: (opts) =>
      browserCookiesClear(transport, withDefaultProfile(opts, defaultProfile)),
    browserStorageGet: (opts) =>
      browserStorageGet(transport, withDefaultProfile(opts, defaultProfile)!),
    browserStorageSet: (opts) =>
      browserStorageSet(transport, withDefaultProfile(opts, defaultProfile)!),
    browserStorageClear: (opts) =>
      browserStorageClear(transport, withDefaultProfile(opts, defaultProfile)!),
    browserSetOffline: (opts) =>
      browserSetOffline(transport, withDefaultProfile(opts, defaultProfile)!),
    browserSetHeaders: (opts) =>
      browserSetHeaders(transport, withDefaultProfile(opts, defaultProfile)!),
    browserSetHttpCredentials: (opts) =>
      browserSetHttpCredentials(transport, withDefaultProfile(opts, defaultProfile)),
    browserSetGeolocation: (opts) =>
      browserSetGeolocation(transport, withDefaultProfile(opts, defaultProfile)),
    browserSetMedia: (opts) =>
      browserSetMedia(transport, withDefaultProfile(opts, defaultProfile)!),
    browserSetTimezone: (opts) =>
      browserSetTimezone(transport, withDefaultProfile(opts, defaultProfile)!),
    browserSetLocale: (opts) =>
      browserSetLocale(transport, withDefaultProfile(opts, defaultProfile)!),
    browserSetDevice: (opts) =>
      browserSetDevice(transport, withDefaultProfile(opts, defaultProfile)!),
    browserClearPermissions: (opts) =>
      browserClearPermissions(transport, withDefaultProfile(opts, defaultProfile)),
  };
}

export * from "./client.js";
export * from "./client-actions-types.js";
export * from "./client-actions-core.js";
export * from "./client-actions-observe.js";
export * from "./client-actions-state.js";
export * from "./client-actions.js";
export * from "./client-fetch.js";
