import http from "node:http";
import https from "node:https";
import { isLoopbackHost } from "@aibrowser/browser-shared";

const directHttpAgent = new http.Agent();
const directHttpsAgent = new https.Agent();
const LOOPBACK_ENTRIES = "localhost,127.0.0.1,[::1]";

function hasProxyEnv(): boolean {
  return Boolean(
    process.env.HTTP_PROXY ||
      process.env.http_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.ALL_PROXY ||
      process.env.all_proxy,
  );
}

function isLoopbackCdpUrl(url: string): boolean {
  try {
    return isLoopbackHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function noProxyAlreadyCoversLocalhost(): boolean {
  const current = process.env.NO_PROXY || process.env.no_proxy || "";
  return (
    current.includes("localhost") && current.includes("127.0.0.1") && current.includes("[::1]")
  );
}

type NoProxySnapshot = {
  noProxy: string | undefined;
  noProxyLower: string | undefined;
  applied: string;
};

class NoProxyLeaseManager {
  private leaseCount = 0;
  private snapshot: NoProxySnapshot | null = null;

  acquire(url: string): (() => void) | null {
    if (!isLoopbackCdpUrl(url) || !hasProxyEnv()) {
      return null;
    }
    if (this.leaseCount === 0 && !noProxyAlreadyCoversLocalhost()) {
      const noProxy = process.env.NO_PROXY;
      const noProxyLower = process.env.no_proxy;
      const current = noProxy || noProxyLower || "";
      const applied = current ? `${current},${LOOPBACK_ENTRIES}` : LOOPBACK_ENTRIES;
      process.env.NO_PROXY = applied;
      process.env.no_proxy = applied;
      this.snapshot = { noProxy, noProxyLower, applied };
    }
    this.leaseCount += 1;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.release();
      }
    };
  }

  private release() {
    if (this.leaseCount <= 0) {
      return;
    }
    this.leaseCount -= 1;
    if (this.leaseCount > 0 || !this.snapshot) {
      return;
    }
    const { noProxy, noProxyLower, applied } = this.snapshot;
    const untouched =
      process.env.NO_PROXY === applied &&
      (process.env.no_proxy === applied || process.env.no_proxy === undefined);
    if (untouched) {
      if (noProxy === undefined) {
        delete process.env.NO_PROXY;
      } else {
        process.env.NO_PROXY = noProxy;
      }
      if (noProxyLower === undefined) {
        delete process.env.no_proxy;
      } else {
        process.env.no_proxy = noProxyLower;
      }
    }
    this.snapshot = null;
  }
}

const noProxyLeaseManager = new NoProxyLeaseManager();

export function getDirectAgentForCdp(url: string): http.Agent | https.Agent | undefined {
  try {
    const parsed = new URL(url);
    if (isLoopbackHost(parsed.hostname)) {
      return parsed.protocol === "https:" || parsed.protocol === "wss:"
        ? directHttpsAgent
        : directHttpAgent;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function withNoProxyForCdpUrl<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const release = noProxyLeaseManager.acquire(url);
  try {
    return await fn();
  } finally {
    release?.();
  }
}
