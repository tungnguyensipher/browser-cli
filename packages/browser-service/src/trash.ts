import fs from "node:fs/promises";
import path from "node:path";
import { resolveTempDir } from "./service-paths.js";

export async function movePathToTrash(targetPath: string): Promise<string> {
  const trashRoot = path.join(resolveTempDir(), "trash");
  await fs.mkdir(trashRoot, { recursive: true });
  const destination = path.join(
    trashRoot,
    `${path.basename(targetPath)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await fs.rename(targetPath, destination);
  return destination;
}
