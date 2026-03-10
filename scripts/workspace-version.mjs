#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const VALID_BUMP_KINDS = new Set(["patch", "minor", "major"]);
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function usage() {
  console.log(
    [
      "Usage:",
      "  node ./scripts/workspace-version.mjs check",
      "  node ./scripts/workspace-version.mjs set <version>",
      "  node ./scripts/workspace-version.mjs bump [patch|minor|major]",
    ].join("\n"),
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveWorkspacePackageJsonPaths(rootDir = process.cwd()) {
  const rootPackageJson = path.join(rootDir, "package.json");
  const packagesDir = path.join(rootDir, "packages");
  const paths = [rootPackageJson];
  if (!fs.existsSync(packagesDir)) {
    return paths;
  }
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = path.join(packagesDir, entry.name, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      paths.push(packageJsonPath);
    }
  }
  return paths;
}

function assertVersionString(version) {
  if (!VERSION_RE.test(version)) {
    throw new Error(`Invalid version "${version}". Expected semver like 1.2.3`);
  }
}

function bumpVersion(version, kind) {
  if (!VALID_BUMP_KINDS.has(kind)) {
    throw new Error(`Unsupported bump kind "${kind}". Use patch, minor, or major.`);
  }
  assertVersionString(version);
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Cannot ${kind}-bump prerelease/build version "${version}". Set it explicitly instead.`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (kind === "major") {
    return `${major + 1}.0.0`;
  }
  if (kind === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

function syncWorkspaceVersion(version, rootDir = process.cwd()) {
  assertVersionString(version);
  const packageJsonPaths = resolveWorkspacePackageJsonPaths(rootDir);
  for (const packageJsonPath of packageJsonPaths) {
    const pkg = readJson(packageJsonPath);
    if (pkg.version === version) {
      continue;
    }
    pkg.version = version;
    writeJson(packageJsonPath, pkg);
    console.log(`Updated ${path.relative(rootDir, packageJsonPath)} -> ${version}`);
  }
}

function checkWorkspaceVersions(rootDir = process.cwd()) {
  const packageJsonPaths = resolveWorkspacePackageJsonPaths(rootDir);
  const rootVersion = readJson(path.join(rootDir, "package.json")).version;
  assertVersionString(rootVersion);
  let ok = true;
  for (const packageJsonPath of packageJsonPaths.slice(1)) {
    const pkg = readJson(packageJsonPath);
    if (pkg.version !== rootVersion) {
      console.error(
        `${path.relative(rootDir, packageJsonPath)} has version ${pkg.version ?? "<missing>"} but root package.json is ${rootVersion}`,
      );
      ok = false;
    }
  }
  if (ok) {
    console.log(`Workspace versions are in sync at ${rootVersion}`);
  } else {
    process.exitCode = 1;
  }
}

function getRootVersion(rootDir = process.cwd()) {
  const version = readJson(path.join(rootDir, "package.json")).version;
  assertVersionString(version);
  return version;
}

function main(argv = process.argv.slice(2), rootDir = process.cwd()) {
  const [command, arg] = argv;
  if (!command) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (command === "check") {
    checkWorkspaceVersions(rootDir);
    return;
  }
  if (command === "set") {
    if (!arg) {
      throw new Error("Missing version. Usage: version:set -- 1.2.3");
    }
    syncWorkspaceVersion(arg, rootDir);
    return;
  }
  if (command === "bump") {
    const nextVersion = bumpVersion(getRootVersion(rootDir), arg ?? "patch");
    syncWorkspaceVersion(nextVersion, rootDir);
    return;
  }
  throw new Error(`Unknown command "${command}"`);
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  usage();
}
