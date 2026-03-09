export {
  parseHttpUrl,
  resolveBrowserConfig,
  resolveProfile,
  type ResolvedBrowserConfig,
  type ResolvedBrowserProfile,
} from "@aibrowser/browser-shared";
export {
  loadRuntimeConfig,
  type BrowserConfig,
  type BrowserProfileConfig,
  type StandaloneRuntimeConfig,
} from "@aibrowser/browser-shared";

export function deriveDefaultBrowserCdpPortRange(browserControlPort: number): {
  start: number;
  end: number;
} {
  const start = browserControlPort + 9;
  const end = Math.min(65535, start + 99);
  return end < start ? { start, end: start } : { start, end };
}
