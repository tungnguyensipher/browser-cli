import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { danger, info } from "./globals.js";
import { defaultRuntime } from "./runtime.js";
import { shortenHomePath } from "./utils.js";
import { formatCliCommand } from "./command-format.js";

function resolveBundledExtensionRootDir(here = path.dirname(fileURLToPath(import.meta.url))) {
  const candidate = path.resolve(here, "../../chrome-extension");
  const manifest = path.join(candidate, "manifest.json");
  if (fs.existsSync(manifest)) {
    return candidate;
  }
  throw new Error("Bundled Chrome extension is missing from packages/chrome-extension.");
}

function resolveInstalledExtensionRootDir() {
  return path.join(os.homedir(), ".aibrowser", "chrome-extension");
}

function hasManifest(dir: string) {
  return fs.existsSync(path.join(dir, "manifest.json"));
}

export async function installChromeExtension(): Promise<{ path: string }> {
  const src = resolveBundledExtensionRootDir();
  if (!hasManifest(src)) {
    throw new Error("Bundled Chrome extension is missing.");
  }

  const dest = resolveInstalledExtensionRootDir();
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.rm(dest, { recursive: true, force: true });
  await fs.promises.cp(src, dest, { recursive: true });

  if (!hasManifest(dest)) {
    throw new Error("Chrome extension install failed (manifest.json missing).");
  }

  return { path: dest };
}

export function registerBrowserExtensionCommands(
  program: Command,
  parentOpts: (cmd: Command) => { json?: boolean },
) {
  const ext = program.command("extension").description("Chrome extension helpers");

  ext
    .command("install")
    .description("Install the Chrome extension to a stable local path")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      try {
        const installed = await installChromeExtension();
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify({ ok: true, path: installed.path }, null, 2));
          return;
        }
        defaultRuntime.log(shortenHomePath(installed.path));
        defaultRuntime.error(
          info(
            [
              "Next:",
              "- Chrome -> chrome://extensions -> enable Developer mode",
              `- Load unpacked -> select: ${shortenHomePath(installed.path)}`,
              `- Then use ${formatCliCommand("aibrowser extension path")} to print it again later`,
            ].join("\n"),
          ),
        );
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  ext
    .command("path")
    .description("Print the path to the installed Chrome extension")
    .action(async (_opts, cmd) => {
      const parent = parentOpts(cmd);
      const dir = resolveInstalledExtensionRootDir();
      if (!hasManifest(dir)) {
        defaultRuntime.error(
          danger(
            `Chrome extension is not installed. Run: "${formatCliCommand("aibrowser extension install")}"`,
          ),
        );
        defaultRuntime.exit(1);
      }
      if (parent?.json) {
        defaultRuntime.log(JSON.stringify({ path: dir }, null, 2));
        return;
      }
      defaultRuntime.log(shortenHomePath(dir));
    });
}
