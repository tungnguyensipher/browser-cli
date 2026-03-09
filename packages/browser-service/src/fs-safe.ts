import fs from "node:fs/promises";
import path from "node:path";
import { isPathInside } from "./path-guards.js";

type SafeOpenErrorCode = "not-found" | "outside-workspace" | "invalid-file";

export class SafeOpenError extends Error {
  constructor(
    readonly code: SafeOpenErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SafeOpenError";
  }
}

function resolveLexicalPathWithinRoot(rootDir: string, relativePath: string): string {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  if (!isPathInside(resolvedRoot, resolvedPath)) {
    throw new SafeOpenError("outside-workspace", "Path is outside root");
  }
  return resolvedPath;
}

async function resolveTrustedRootRealPath(rootDir: string): Promise<string> {
  try {
    const stats = await fs.lstat(rootDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new SafeOpenError("outside-workspace", "Root must be a real directory");
    }
    return await fs.realpath(rootDir);
  } catch (error) {
    if (error instanceof SafeOpenError) {
      throw error;
    }
    throw new SafeOpenError("not-found", "Root directory not found");
  }
}

export async function openFileWithinRoot(params: {
  rootDir: string;
  relativePath: string;
}): Promise<{ handle: fs.FileHandle; realPath: string }> {
  const rootRealPath = await resolveTrustedRootRealPath(path.resolve(params.rootDir));
  const lexicalPath = resolveLexicalPathWithinRoot(rootRealPath, params.relativePath);

  let stats: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stats = await fs.lstat(lexicalPath);
  } catch {
    throw new SafeOpenError("not-found", "File not found");
  }
  if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink > 1) {
    throw new SafeOpenError("invalid-file", "Path must be a regular non-symlink file");
  }

  const realPath = await fs.realpath(lexicalPath);
  if (!isPathInside(rootRealPath, realPath)) {
    throw new SafeOpenError("outside-workspace", "File resolved outside root");
  }

  const handle = await fs.open(realPath, "r");
  return { handle, realPath };
}

async function moveFile(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "EXDEV")) {
      throw error;
    }
    await fs.copyFile(sourcePath, targetPath);
    await fs.rm(sourcePath, { force: true });
  }
}

export async function writeFileFromPathWithinRoot(params: {
  rootDir: string;
  relativePath: string;
  sourcePath: string;
  mkdir?: boolean;
}): Promise<void> {
  const rootRealPath = await resolveTrustedRootRealPath(path.resolve(params.rootDir));
  const targetPath = resolveLexicalPathWithinRoot(rootRealPath, params.relativePath);
  const parentDir = path.dirname(targetPath);
  if (params.mkdir) {
    await fs.mkdir(parentDir, { recursive: true });
  }
  const parentRealPath = await fs.realpath(parentDir).catch(() => null);
  if (!parentRealPath || !isPathInside(rootRealPath, parentRealPath)) {
    throw new SafeOpenError("outside-workspace", "Parent directory resolved outside root");
  }
  await moveFile(params.sourcePath, targetPath);
}
