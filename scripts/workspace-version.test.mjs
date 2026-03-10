import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";

const tempDirs = [];
const scriptPath = new URL("./workspace-version.mjs", import.meta.url).pathname;

function createTempWorkspace() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-version-"));
  tempDirs.push(rootDir);

  fs.mkdirSync(path.join(rootDir, "packages", "chrome-extension"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "packages", "browser-cli"), { recursive: true });

  fs.writeFileSync(
    path.join(rootDir, "package.json"),
    JSON.stringify({ name: "root", version: "0.1.0", private: true }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, "packages", "browser-cli", "package.json"),
    JSON.stringify({ name: "browser-cli", version: "0.1.0" }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, "packages", "chrome-extension", "package.json"),
    JSON.stringify({ name: "chrome-extension", version: "0.1.0" }, null, 2),
  );
  fs.writeFileSync(
    path.join(rootDir, "packages", "chrome-extension", "manifest.json"),
    JSON.stringify({ manifest_version: 3, name: "Browser CLI", version: "0.1.0" }, null, 2),
  );

  return rootDir;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("workspace-version script", () => {
  it("updates the chrome extension manifest version during set", () => {
    const rootDir = createTempWorkspace();

    const result = Bun.spawnSync({
      cmd: ["node", scriptPath, "set", "0.2.1"],
      cwd: rootDir,
      stdout: "pipe",
      stderr: "pipe",
      env: process.env,
    });

    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);
    expect(result.exitCode, `stdout:\n${stdout}\n\nstderr:\n${stderr}`).toBe(0);

    expect(readJson(path.join(rootDir, "package.json")).version).toBe("0.2.1");
    expect(readJson(path.join(rootDir, "packages", "browser-cli", "package.json")).version).toBe("0.2.1");
    expect(readJson(path.join(rootDir, "packages", "chrome-extension", "package.json")).version).toBe("0.2.1");
    expect(readJson(path.join(rootDir, "packages", "chrome-extension", "manifest.json")).version).toBe("0.2.1");
  });
});
