import path from "node:path";
import { describe, expect, it } from "bun:test";

const cliEntry = new URL("./index.ts", import.meta.url).pathname;

function runCliHelp(args: string[]) {
  return Bun.spawnSync({
    cmd: ["bun", "run", cliEntry, ...args, "--help"],
    cwd: path.resolve(path.dirname(cliEntry), ".."),
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });
}

describe("browser cli help", () => {
  it("lists the required browser command families", () => {
    const result = runCliHelp([]);

    const stdout = new TextDecoder().decode(result.stdout);
    const stderr = new TextDecoder().decode(result.stderr);
    expect(result.exitCode, `stdout:\n${stdout}\n\nstderr:\n${stderr}`).toBe(0);
    expect(stdout).toContain("status");
    expect(stdout).toContain("profiles");
    expect(stdout).toContain("snapshot");
    expect(stdout).toContain("screenshot");
    expect(stdout).toContain("navigate");
    expect(stdout).toContain("act");
    expect(stdout).toContain("service");
    expect(stdout).toContain("auth");
    expect(stdout).toContain("extension");
  });

  it("keeps the contract-sensitive snapshot and action flags", () => {
    const snapshotHelp = runCliHelp(["snapshot"]);
    const snapshotStdout = new TextDecoder().decode(snapshotHelp.stdout);
    expect(snapshotHelp.exitCode).toBe(0);
    expect(snapshotStdout).toContain("--refs");

    const screenshotHelp = runCliHelp(["screenshot"]);
    const screenshotStdout = new TextDecoder().decode(screenshotHelp.stdout);
    expect(screenshotHelp.exitCode).toBe(0);
    expect(screenshotStdout).toContain("--target-id");

    const uploadHelp = runCliHelp(["upload"]);
    const uploadStdout = new TextDecoder().decode(uploadHelp.stdout);
    expect(uploadHelp.exitCode).toBe(0);
    expect(uploadStdout).toContain("--paths");

    const waitHelp = runCliHelp(["wait"]);
    const waitStdout = new TextDecoder().decode(waitHelp.stdout);
    expect(waitHelp.exitCode).toBe(0);
    expect(waitStdout).toContain("--time-ms");
    expect(waitStdout).toContain("--load-state");

    const dialogHelp = runCliHelp(["dialog"]);
    const dialogStdout = new TextDecoder().decode(dialogHelp.stdout);
    expect(dialogHelp.exitCode).toBe(0);
    expect(dialogStdout).toContain("--prompt-text");

    const actHelp = runCliHelp(["act"]);
    const actStdout = new TextDecoder().decode(actHelp.stdout);
    expect(actHelp.exitCode).toBe(0);
    expect(actStdout).toContain("--kind");

    const serviceHelp = runCliHelp(["service"]);
    const serviceStdout = new TextDecoder().decode(serviceHelp.stdout);
    expect(serviceHelp.exitCode).toBe(0);
    expect(serviceStdout).toContain("install");
    expect(serviceStdout).toContain("status");
    expect(serviceStdout).toContain("restart");

    const authHelp = runCliHelp(["auth"]);
    const authStdout = new TextDecoder().decode(authHelp.stdout);
    expect(authHelp.exitCode).toBe(0);
    expect(authStdout).toContain("regenerate");
    expect(authStdout).toContain("set");
    expect(authStdout).toContain("copy");
  });
});
