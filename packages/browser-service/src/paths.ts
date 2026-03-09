import fs from "node:fs/promises";
import path from "node:path";
import { resolveTempDir } from "./service-paths.js";

export const DEFAULT_BROWSER_TMP_DIR = resolveTempDir();
export const DEFAULT_TRACE_DIR = DEFAULT_BROWSER_TMP_DIR;
export const DEFAULT_DOWNLOAD_DIR = path.join(DEFAULT_BROWSER_TMP_DIR, "downloads");
export const DEFAULT_UPLOAD_DIR = path.join(DEFAULT_BROWSER_TMP_DIR, "uploads");

type InvalidPathResult = { ok: false; error: string };

function invalidPath(scopeLabel: string): InvalidPathResult {
  return {
    ok: false,
    error: `Invalid path: must stay within ${scopeLabel}`,
  };
}

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isNotFoundPathError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err && err.code === "ENOENT";
}

async function resolveRealPathIfExists(targetPath: string): Promise<string | undefined> {
  try {
    return await fs.realpath(targetPath);
  } catch {
    return undefined;
  }
}

async function resolveTrustedRootRealPath(rootDir: string): Promise<string | undefined> {
  try {
    const rootLstat = await fs.lstat(rootDir);
    if (!rootLstat.isDirectory() || rootLstat.isSymbolicLink()) {
      return undefined;
    }
    return await fs.realpath(rootDir);
  } catch {
    return undefined;
  }
}

async function validateCanonicalPathWithinRoot(params: {
  rootRealPath: string;
  candidatePath: string;
  expect: "directory" | "file";
}): Promise<"ok" | "not-found" | "invalid"> {
  try {
    const candidateLstat = await fs.lstat(params.candidatePath);
    if (candidateLstat.isSymbolicLink()) {
      return "invalid";
    }
    if (params.expect === "directory" && !candidateLstat.isDirectory()) {
      return "invalid";
    }
    if (params.expect === "file" && !candidateLstat.isFile()) {
      return "invalid";
    }
    if (params.expect === "file" && candidateLstat.nlink > 1) {
      return "invalid";
    }
    const candidateRealPath = await fs.realpath(params.candidatePath);
    return isPathInside(params.rootRealPath, candidateRealPath) ? "ok" : "invalid";
  } catch (err) {
    return isNotFoundPathError(err) ? "not-found" : "invalid";
  }
}

export function resolvePathWithinRoot(params: {
  rootDir: string;
  requestedPath: string;
  scopeLabel: string;
  defaultFileName?: string;
}): { ok: true; path: string } | { ok: false; error: string } {
  const root = path.resolve(params.rootDir);
  const raw = params.requestedPath.trim();
  if (!raw) {
    if (!params.defaultFileName) {
      return { ok: false, error: "path is required" };
    }
    return { ok: true, path: path.join(root, params.defaultFileName) };
  }
  const resolved = path.resolve(root, raw);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return { ok: false, error: `Invalid path: must stay within ${params.scopeLabel}` };
  }
  return { ok: true, path: resolved };
}

export async function resolveWritablePathWithinRoot(params: {
  rootDir: string;
  requestedPath: string;
  scopeLabel: string;
  defaultFileName?: string;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const lexical = resolvePathWithinRoot(params);
  if (!lexical.ok) {
    return lexical;
  }

  const rootDir = path.resolve(params.rootDir);
  const rootRealPath = await resolveTrustedRootRealPath(rootDir);
  if (!rootRealPath) {
    return invalidPath(params.scopeLabel);
  }

  const requestedPath = lexical.path;
  const parentDir = path.dirname(requestedPath);
  const parentStatus = await validateCanonicalPathWithinRoot({
    rootRealPath,
    candidatePath: parentDir,
    expect: "directory",
  });
  if (parentStatus !== "ok") {
    return invalidPath(params.scopeLabel);
  }

  const targetStatus = await validateCanonicalPathWithinRoot({
    rootRealPath,
    candidatePath: requestedPath,
    expect: "file",
  });
  if (targetStatus === "invalid") {
    return invalidPath(params.scopeLabel);
  }

  return lexical;
}

export function resolvePathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): { ok: true; paths: string[] } | { ok: false; error: string } {
  const resolvedPaths: string[] = [];
  for (const raw of params.requestedPaths) {
    const pathResult = resolvePathWithinRoot({
      rootDir: params.rootDir,
      requestedPath: raw,
      scopeLabel: params.scopeLabel,
    });
    if (!pathResult.ok) {
      return { ok: false, error: pathResult.error };
    }
    resolvedPaths.push(pathResult.path);
  }
  return { ok: true, paths: resolvedPaths };
}

export async function resolveExistingPathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  return await resolveCheckedPathsWithinRoot({
    ...params,
    allowMissingFallback: true,
  });
}

export async function resolveStrictExistingPathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  return await resolveCheckedPathsWithinRoot({
    ...params,
    allowMissingFallback: false,
  });
}

async function resolveCheckedPathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
  allowMissingFallback: boolean;
}): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const rootDir = path.resolve(params.rootDir);
  const rootRealPath = await resolveRealPathIfExists(rootDir);

  const isInRoot = (relativePath: string) =>
    Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);

  const resolveExistingRelativePath = async (
    requestedPath: string,
  ): Promise<
    { ok: true; relativePath: string; fallbackPath: string } | { ok: false; error: string }
  > => {
    const raw = requestedPath.trim();
    const lexicalPathResult = resolvePathWithinRoot({
      rootDir,
      requestedPath,
      scopeLabel: params.scopeLabel,
    });
    if (lexicalPathResult.ok) {
      return {
        ok: true,
        relativePath: path.relative(rootDir, lexicalPathResult.path),
        fallbackPath: lexicalPathResult.path,
      };
    }
    if (!rootRealPath || !raw || !path.isAbsolute(raw)) {
      return lexicalPathResult;
    }
    try {
      const resolvedExistingPath = await fs.realpath(raw);
      const relativePath = path.relative(rootRealPath, resolvedExistingPath);
      if (!isInRoot(relativePath)) {
        return lexicalPathResult;
      }
      return {
        ok: true,
        relativePath,
        fallbackPath: resolvedExistingPath,
      };
    } catch {
      return lexicalPathResult;
    }
  };

  const resolvedPaths: string[] = [];
  for (const raw of params.requestedPaths) {
    const pathResult = await resolveExistingRelativePath(raw);
    if (!pathResult.ok) {
      return { ok: false, error: pathResult.error };
    }

    try {
      const candidatePath = path.join(rootDir, pathResult.relativePath);
      const stats = await fs.lstat(candidatePath);
      if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink > 1) {
        return {
          ok: false,
          error: `Invalid path: must stay within ${params.scopeLabel} and be a regular non-symlink file`,
        };
      }
      const realPath = await fs.realpath(candidatePath);
      const trustedRoot = (await resolveTrustedRootRealPath(rootDir)) ?? rootRealPath;
      if (trustedRoot && !isPathInside(trustedRoot, realPath)) {
        return {
          ok: false,
          error: `File is outside ${params.scopeLabel}`,
        };
      }
      resolvedPaths.push(realPath);
    } catch (err) {
      if (params.allowMissingFallback && isNotFoundPathError(err)) {
        resolvedPaths.push(pathResult.fallbackPath);
        continue;
      }
      return {
        ok: false,
        error: `Invalid path: must stay within ${params.scopeLabel} and be a regular non-symlink file`,
      };
    }
  }
  return { ok: true, paths: resolvedPaths };
}
