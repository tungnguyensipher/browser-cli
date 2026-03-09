import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const DEFAULT_BROWSER_TMP_DIR = path.join(os.tmpdir(), "aibrowser");
export const DEFAULT_UPLOAD_DIR = path.join(DEFAULT_BROWSER_TMP_DIR, "uploads");

function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function ensureRegularFileWithinRoot(rootDir: string, filePath: string): Promise<string> {
  const rootRealPath = await fs.realpath(rootDir);
  const stats = await fs.lstat(filePath);
  if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink > 1) {
    throw new Error("Path must be a regular non-symlink file");
  }
  const realPath = await fs.realpath(filePath);
  if (!isPathInside(rootRealPath, realPath)) {
    throw new Error("File resolved outside root");
  }
  return realPath;
}

export async function resolveStrictExistingPathsWithinRoot(params: {
  rootDir: string;
  requestedPaths: string[];
  scopeLabel: string;
}): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const rootDir = path.resolve(params.rootDir);
  try {
    await fs.mkdir(rootDir, { recursive: true });
    const resolvedPaths: string[] = [];
    for (const requestedPath of params.requestedPaths) {
      const raw = requestedPath.trim();
      const resolved = path.resolve(rootDir, raw);
      if (!raw || !isPathInside(rootDir, resolved)) {
        return { ok: false, error: `Invalid path: must stay within ${params.scopeLabel}` };
      }
      resolvedPaths.push(await ensureRegularFileWithinRoot(rootDir, resolved));
    }
    return { ok: true, paths: resolvedPaths };
  } catch {
    return {
      ok: false,
      error: `Invalid path: must stay within ${params.scopeLabel} and be a regular non-symlink file`,
    };
  }
}
