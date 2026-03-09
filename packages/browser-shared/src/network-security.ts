import http from "node:http";
import https from "node:https";
import { lookup as dnsLookupCb, type LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { Buffer } from "node:buffer";
import { Agent, type Dispatcher } from "undici";
import type WebSocket from "ws";
import ipaddr from "ipaddr.js";

type ParsedIpAddress = ipaddr.IPv4 | ipaddr.IPv6;
type Ipv4Range = ReturnType<ipaddr.IPv4["range"]>;
type Ipv6Range = ReturnType<ipaddr.IPv6["range"]>;

export type LookupFn = typeof dnsLookup;
export type SsrFPolicy = {
  allowPrivateNetwork?: boolean;
  dangerouslyAllowPrivateNetwork?: boolean;
  allowRfc2544BenchmarkRange?: boolean;
  allowedHostnames?: string[];
  hostnameAllowlist?: string[];
};

export class SsrFBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrFBlockedError";
  }
}

const BLOCKED_IPV4_SPECIAL_USE_RANGES = new Set<Ipv4Range>([
  "unspecified",
  "broadcast",
  "multicast",
  "linkLocal",
  "loopback",
  "carrierGradeNat",
  "private",
  "reserved",
]);
const PRIVATE_OR_LOOPBACK_IPV4_RANGES = new Set<Ipv4Range>([
  "loopback",
  "private",
  "linkLocal",
  "carrierGradeNat",
]);
const BLOCKED_IPV6_SPECIAL_USE_RANGES = new Set<Ipv6Range>([
  "unspecified",
  "loopback",
  "linkLocal",
  "uniqueLocal",
  "multicast",
]);
const RFC2544_BENCHMARK_PREFIX: [ipaddr.IPv4, number] = [ipaddr.IPv4.parse("198.18.0.0"), 15];
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);
const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
] as const;
const LOOPBACK_NO_PROXY_ENTRIES = "localhost,127.0.0.1,[::1]";

const directHttpAgent = new http.Agent();
const directHttpsAgent = new https.Agent();

function normalizeHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function stripIpv6Brackets(value: string): string {
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1);
  }
  return value;
}

function isNumericIpv4LiteralPart(value: string): boolean {
  return /^[0-9]+$/.test(value) || /^0x[0-9a-f]+$/i.test(value);
}

function parseIpv6WithEmbeddedIpv4(raw: string): ipaddr.IPv6 | undefined {
  if (!raw.includes(":") || !raw.includes(".")) {
    return undefined;
  }
  const match = /^(.*:)([^:%]+(?:\.[^:%]+){3})(%[0-9A-Za-z]+)?$/i.exec(raw);
  if (!match) {
    return undefined;
  }
  const [, prefix, embeddedIpv4, zoneSuffix = ""] = match;
  if (!ipaddr.IPv4.isValidFourPartDecimal(embeddedIpv4)) {
    return undefined;
  }
  const octets = embeddedIpv4.split(".").map((part) => Number.parseInt(part, 10));
  const high = ((octets[0] << 8) | octets[1]).toString(16);
  const low = ((octets[2] << 8) | octets[3]).toString(16);
  const normalizedIpv6 = `${prefix}${high}:${low}${zoneSuffix}`;
  return ipaddr.IPv6.isValid(normalizedIpv6) ? ipaddr.IPv6.parse(normalizedIpv6) : undefined;
}

function isIpv4Address(address: ParsedIpAddress): address is ipaddr.IPv4 {
  return address.kind() === "ipv4";
}

function isIpv6Address(address: ParsedIpAddress): address is ipaddr.IPv6 {
  return address.kind() === "ipv6";
}

function normalizeIpv4MappedAddress(address: ParsedIpAddress): ParsedIpAddress {
  if (!isIpv6Address(address) || !address.isIPv4MappedAddress()) {
    return address;
  }
  return address.toIPv4Address();
}

function parseCanonicalIpAddress(raw: string | undefined): ParsedIpAddress | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const normalized = stripIpv6Brackets(trimmed);
  if (!normalized) {
    return undefined;
  }
  if (ipaddr.IPv4.isValid(normalized)) {
    if (!ipaddr.IPv4.isValidFourPartDecimal(normalized)) {
      return undefined;
    }
    return ipaddr.IPv4.parse(normalized);
  }
  if (ipaddr.IPv6.isValid(normalized)) {
    return ipaddr.IPv6.parse(normalized);
  }
  return parseIpv6WithEmbeddedIpv4(normalized);
}

function parseLooseIpAddress(raw: string | undefined): ParsedIpAddress | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const normalized = stripIpv6Brackets(trimmed);
  if (!normalized) {
    return undefined;
  }
  if (ipaddr.isValid(normalized)) {
    return ipaddr.parse(normalized);
  }
  return parseIpv6WithEmbeddedIpv4(normalized);
}

function isCanonicalDottedDecimalIPv4(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = stripIpv6Brackets(trimmed);
  return Boolean(normalized && ipaddr.IPv4.isValidFourPartDecimal(normalized));
}

function isLegacyIpv4Literal(raw: string | undefined): boolean {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = stripIpv6Brackets(trimmed);
  if (!normalized || normalized.includes(":") || isCanonicalDottedDecimalIPv4(normalized)) {
    return false;
  }
  const parts = normalized.split(".");
  if (parts.length === 0 || parts.length > 4 || parts.some((part) => part.length === 0)) {
    return false;
  }
  return parts.every((part) => isNumericIpv4LiteralPart(part));
}

function isBlockedSpecialUseIpv6Address(address: ipaddr.IPv6): boolean {
  if (BLOCKED_IPV6_SPECIAL_USE_RANGES.has(address.range())) {
    return true;
  }
  return (address.parts[0] & 0xffc0) === 0xfec0;
}

function isBlockedSpecialUseIpv4Address(
  address: ipaddr.IPv4,
  policy?: SsrFPolicy,
): boolean {
  const inRfc2544BenchmarkRange = address.match(RFC2544_BENCHMARK_PREFIX);
  if (inRfc2544BenchmarkRange && policy?.allowRfc2544BenchmarkRange === true) {
    return false;
  }
  return BLOCKED_IPV4_SPECIAL_USE_RANGES.has(address.range()) || inRfc2544BenchmarkRange;
}

function extractEmbeddedIpv4FromIpv6(address: ipaddr.IPv6): ipaddr.IPv4 | undefined {
  if (address.isIPv4MappedAddress()) {
    return address.toIPv4Address();
  }
  if (address.range() === "rfc6145" || address.range() === "rfc6052") {
    return ipaddr.IPv4.parse(
      [
        (address.parts[6] >>> 8) & 0xff,
        address.parts[6] & 0xff,
        (address.parts[7] >>> 8) & 0xff,
        address.parts[7] & 0xff,
      ].join("."),
    );
  }
  return undefined;
}

function isPrivateIpAddress(address: string, policy?: SsrFPolicy): boolean {
  let normalized = address.trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  if (!normalized) {
    return false;
  }

  const strictIp = parseCanonicalIpAddress(normalized);
  if (strictIp) {
    if (isIpv4Address(strictIp)) {
      return isBlockedSpecialUseIpv4Address(strictIp, policy);
    }
    if (isBlockedSpecialUseIpv6Address(strictIp)) {
      return true;
    }
    const embeddedIpv4 = extractEmbeddedIpv4FromIpv6(strictIp);
    return embeddedIpv4 ? isBlockedSpecialUseIpv4Address(embeddedIpv4, policy) : false;
  }

  if (normalized.includes(":") && !parseLooseIpAddress(normalized)) {
    return true;
  }
  if (!isCanonicalDottedDecimalIPv4(normalized) && isLegacyIpv4Literal(normalized)) {
    return true;
  }
  return normalized.split(".").every((part) => isNumericIpv4LiteralPart(part));
}

function isBlockedHostnameNormalized(normalized: string): boolean {
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  return (
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  );
}

function isBlockedHostnameOrIp(hostname: string, policy?: SsrFPolicy): boolean {
  const normalized = normalizeHostname(hostname);
  return Boolean(normalized) && (isBlockedHostnameNormalized(normalized) || isPrivateIpAddress(normalized, policy));
}

function normalizeHostnameSet(values?: string[]): Set<string> {
  return new Set((values ?? []).map((value) => normalizeHostname(value)).filter(Boolean));
}

function normalizeHostnameAllowlist(values?: string[]): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalizeHostname(value))
        .filter((value) => value !== "*" && value !== "*." && value.length > 0),
    ),
  );
}

function isHostnameAllowedByPattern(hostname: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(2);
    return Boolean(suffix) && hostname !== suffix && hostname.endsWith(`.${suffix}`);
  }
  return hostname === pattern;
}

function matchesHostnameAllowlist(hostname: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) {
    return true;
  }
  return allowlist.some((pattern) => isHostnameAllowedByPattern(hostname, pattern));
}

export function isPrivateNetworkAllowedByPolicy(policy?: SsrFPolicy): boolean {
  return policy?.dangerouslyAllowPrivateNetwork === true || policy?.allowPrivateNetwork === true;
}

function createPinnedLookup(params: {
  hostname: string;
  addresses: string[];
  fallback?: typeof dnsLookupCb;
}): typeof dnsLookupCb {
  const normalizedHost = normalizeHostname(params.hostname);
  const fallback = params.fallback ?? dnsLookupCb;
  const records = params.addresses.map((address) => ({
    address,
    family: address.includes(":") ? 6 : 4,
  }));
  let index = 0;

  return ((host: string, options?: unknown, callback?: unknown) => {
    const cb =
      typeof options === "function"
        ? (options as (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void)
        : (callback as (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void);
    if (!cb) {
      return;
    }
    const normalized = normalizeHostname(host);
    if (!normalized || normalized !== normalizedHost) {
      if (typeof options === "function" || options === undefined) {
        return (fallback as typeof dnsLookupCb)(host, cb);
      }
      return (fallback as unknown as (hostname: string, options: unknown, callback: typeof cb) => void)(host, options, cb);
    }

    const opts =
      typeof options === "object" && options !== null
        ? (options as { all?: boolean; family?: number })
        : {};
    const requestedFamily =
      typeof options === "number" ? options : typeof opts.family === "number" ? opts.family : 0;
    const candidates =
      requestedFamily === 4 || requestedFamily === 6
        ? records.filter((entry) => entry.family === requestedFamily)
        : records;
    const usable = candidates.length > 0 ? candidates : records;
    if (opts.all) {
      cb(null, usable as LookupAddress[]);
      return;
    }
    const chosen = usable[index % usable.length];
    index += 1;
    cb(null, chosen.address, chosen.family);
  }) as typeof dnsLookupCb;
}

function dedupeAndPreferIpv4(results: readonly LookupAddress[]): string[] {
  const seen = new Set<string>();
  const ipv4: string[] = [];
  const otherFamilies: string[] = [];
  for (const entry of results) {
    if (seen.has(entry.address)) {
      continue;
    }
    seen.add(entry.address);
    if (entry.family === 4) {
      ipv4.push(entry.address);
    } else {
      otherFamilies.push(entry.address);
    }
  }
  return [...ipv4, ...otherFamilies];
}

export async function resolvePinnedHostnameWithPolicy(
  hostname: string,
  params: { lookupFn?: LookupFn; policy?: SsrFPolicy } = {},
): Promise<{ hostname: string; addresses: string[]; lookup: typeof dnsLookupCb }> {
  const normalized = normalizeHostname(hostname);
  if (!normalized) {
    throw new Error("Invalid hostname");
  }

  const allowPrivateNetwork = isPrivateNetworkAllowedByPolicy(params.policy);
  const allowedHostnames = normalizeHostnameSet(params.policy?.allowedHostnames);
  const hostnameAllowlist = normalizeHostnameAllowlist(params.policy?.hostnameAllowlist);
  const skipPrivateNetworkChecks = allowPrivateNetwork || allowedHostnames.has(normalized);

  if (!matchesHostnameAllowlist(normalized, hostnameAllowlist)) {
    throw new SsrFBlockedError(`Blocked hostname (not in allowlist): ${hostname}`);
  }

  if (!skipPrivateNetworkChecks && isBlockedHostnameOrIp(normalized, params.policy)) {
    throw new SsrFBlockedError("Blocked hostname or private/internal/special-use IP address");
  }

  const lookupFn = params.lookupFn ?? dnsLookup;
  const results = await lookupFn(normalized, { all: true });
  if (results.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  if (!skipPrivateNetworkChecks) {
    for (const entry of results) {
      if (isBlockedHostnameOrIp(entry.address, params.policy)) {
        throw new SsrFBlockedError("Blocked: resolves to private/internal/special-use IP address");
      }
    }
  }

  const addresses = dedupeAndPreferIpv4(results);
  if (addresses.length === 0) {
    throw new Error(`Unable to resolve hostname: ${hostname}`);
  }

  return {
    hostname: normalized,
    addresses,
    lookup: createPinnedLookup({ hostname: normalized, addresses }),
  };
}

export function createPinnedDispatcher(pinned: {
  hostname: string;
  addresses: string[];
  lookup: typeof dnsLookupCb;
}): Dispatcher {
  return new Agent({
    connect: {
      lookup: pinned.lookup,
    },
  });
}

export async function closeDispatcher(dispatcher?: Dispatcher | null): Promise<void> {
  if (!dispatcher) {
    return;
  }
  const candidate = dispatcher as { close?: () => Promise<void> | void; destroy?: () => void };
  if (typeof candidate.close === "function") {
    await candidate.close();
    return;
  }
  candidate.destroy?.();
}

export function isLoopbackAddress(ip: string | undefined): boolean {
  const parsed = parseCanonicalIpAddress(ip);
  if (!parsed) {
    return false;
  }
  return normalizeIpv4MappedAddress(parsed).range() === "loopback";
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized === "localhost") {
    return true;
  }
  const unbracketed =
    normalized.startsWith("[") && normalized.endsWith("]") ? normalized.slice(1, -1) : normalized;
  return isLoopbackAddress(unbracketed);
}

export function hasProxyEnvConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  for (const key of PROXY_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return true;
    }
  }
  return false;
}

export function getDirectAgentForCdp(url: string): http.Agent | https.Agent | undefined {
  try {
    const parsed = new URL(url);
    if (!isLoopbackHost(parsed.hostname)) {
      return undefined;
    }
    return parsed.protocol === "https:" || parsed.protocol === "wss:" ? directHttpsAgent : directHttpAgent;
  } catch {
    return undefined;
  }
}

function noProxyAlreadyCoversLocalhost(): boolean {
  const current = process.env.NO_PROXY || process.env.no_proxy || "";
  return (
    current.includes("localhost") && current.includes("127.0.0.1") && current.includes("[::1]")
  );
}

class NoProxyLeaseManager {
  private leaseCount = 0;
  private snapshot:
    | {
        noProxy: string | undefined;
        noProxyLower: string | undefined;
        applied: string;
      }
    | null = null;

  acquire(url: string): (() => void) | null {
    try {
      if (!isLoopbackHost(new URL(url).hostname) || !hasProxyEnvConfigured()) {
        return null;
      }
    } catch {
      return null;
    }

    if (this.leaseCount === 0 && !noProxyAlreadyCoversLocalhost()) {
      const noProxy = process.env.NO_PROXY;
      const noProxyLower = process.env.no_proxy;
      const current = noProxy || noProxyLower || "";
      const applied = current ? `${current},${LOOPBACK_NO_PROXY_ENTRIES}` : LOOPBACK_NO_PROXY_ENTRIES;
      process.env.NO_PROXY = applied;
      process.env.no_proxy = applied;
      this.snapshot = { noProxy, noProxyLower, applied };
    }

    this.leaseCount += 1;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.release();
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
    const currentNoProxy = process.env.NO_PROXY;
    const currentNoProxyLower = process.env.no_proxy;
    const untouched =
      currentNoProxy === applied &&
      (currentNoProxyLower === applied || currentNoProxyLower === undefined);
    if (untouched) {
      if (noProxy !== undefined) {
        process.env.NO_PROXY = noProxy;
      } else {
        delete process.env.NO_PROXY;
      }
      if (noProxyLower !== undefined) {
        process.env.no_proxy = noProxyLower;
      } else {
        delete process.env.no_proxy;
      }
    }

    this.snapshot = null;
  }
}

const noProxyLeaseManager = new NoProxyLeaseManager();

export async function withNoProxyForCdpUrl<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const release = noProxyLeaseManager.acquire(url);
  try {
    return await fn();
  } finally {
    release?.();
  }
}

export function rawDataToString(
  data: WebSocket.RawData,
  encoding: BufferEncoding = "utf8",
): string {
  if (typeof data === "string") {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString(encoding);
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString(encoding);
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString(encoding);
  }
  return Buffer.from(String(data)).toString(encoding);
}
