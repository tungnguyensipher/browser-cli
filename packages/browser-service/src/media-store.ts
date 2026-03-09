import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadStandaloneConfig } from "./runtime-config-store.js";
import { ensureDirectory, resolveServiceRootDir } from "./service-paths.js";
import { sanitizeUntrustedFileName } from "./safe-filename.js";

const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

function extensionForContentType(contentType: string): string {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  switch (normalized) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "text/plain":
      return ".txt";
    default:
      return ".bin";
  }
}

export function resolveMediaDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): string {
  const configured = loadStandaloneConfig(env, cwd).mediaDir?.trim();
  if (configured) {
    return ensureDirectory(path.resolve(cwd, configured));
  }
  return ensureDirectory(path.join(resolveServiceRootDir(env, cwd), "media"));
}

export async function ensureMediaDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): Promise<string> {
  const mediaDir = resolveMediaDir(env, cwd);
  await fs.mkdir(mediaDir, { recursive: true, mode: 0o700 });
  return mediaDir;
}

export async function saveMediaBuffer(
  buffer: Buffer,
  contentType = "application/octet-stream",
  prefix = "browser",
  maxBytes = MEDIA_MAX_BYTES,
  originalFilename?: string,
): Promise<{ id: string; path: string; size: number; contentType?: string }> {
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Media exceeds ${(maxBytes / (1024 * 1024)).toFixed(0)}MB limit`);
  }
  const mediaDir = await ensureMediaDir();
  const id = crypto.randomUUID();
  const baseName = sanitizeUntrustedFileName(
    originalFilename ?? `${prefix}${extensionForContentType(contentType)}`,
    "media.bin",
  );
  const ext = path.extname(baseName) || extensionForContentType(contentType);
  const stem = path.basename(baseName, path.extname(baseName)) || prefix;
  const fileName = `${stem}---${id}${ext}`;
  const filePath = path.join(mediaDir, fileName);
  await fs.writeFile(filePath, buffer, { mode: 0o644 });
  return {
    id,
    path: filePath,
    size: buffer.byteLength,
    contentType,
  };
}
