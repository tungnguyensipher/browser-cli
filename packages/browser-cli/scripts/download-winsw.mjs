#!/usr/bin/env node
/**
 * Download WinSW executables for Windows service support.
 * Run during build/prepublish to bundle WinSW with the package.
 *
 * WinSW is MIT licensed: https://github.com/winsw/winsw/blob/master/LICENSE
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WINSW_VERSION = "v2.12.0";
const WINSW_BASE_URL = `https://github.com/winsw/winsw/releases/download/${WINSW_VERSION}`;

const PLATFORMS = [
  { arch: "x64", filename: "WinSW-x64.exe" },
  { arch: "x86", filename: "WinSW-x86.exe" },
  // arm64 not available in v2.12.0, will be added when v3 is stable
];

const OUTPUT_DIR = path.resolve(__dirname, "../vendor/winsw");

async function downloadFile(url, dest) {
  console.log(`Downloading ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(dest, Buffer.from(buffer));

  const size = (buffer.byteLength / 1024 / 1024).toFixed(2);
  console.log(`  Saved to ${dest} (${size} MB)`);
}

async function main() {
  console.log(`Downloading WinSW ${WINSW_VERSION}...\n`);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Download each platform binary
  for (const { arch, filename } of PLATFORMS) {
    const url = `${WINSW_BASE_URL}/${filename}`;
    const dest = path.join(OUTPUT_DIR, `winsw-${arch}.exe`);

    try {
      await downloadFile(url, dest);
    } catch (error) {
      console.error(`  Error: ${error.message}`);
      process.exit(1);
    }
  }

  // Write version file
  const versionFile = path.join(OUTPUT_DIR, "version.txt");
  await fs.writeFile(versionFile, `${WINSW_VERSION}\n`, "utf8");

  console.log(`\nWinSW ${WINSW_VERSION} downloaded successfully.`);
  console.log(`Files saved to: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
