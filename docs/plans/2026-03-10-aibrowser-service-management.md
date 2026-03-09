# Aibrowser Service Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `aibrowser service <install|uninstall|start|stop|restart|status>` plus a dedicated `aibrowserd` foreground daemon entrypoint, with native launchd/systemd support and WinSW-based Windows wrapper support.

**Architecture:** Keep `aibrowser` as the operator-facing CLI and introduce `aibrowserd` as the stable daemon process invoked by service managers. Service installation writes OS-specific unit definitions that execute `aibrowserd run`, while status/start/stop/restart dispatch to `launchctl`, `systemctl`, or the configured WinSW wrapper executable without changing the browser HTTP contract.

**Tech Stack:** Bun workspaces, TypeScript, Commander, launchd plist generation, systemd unit generation, WinSW XML generation, Bun/Node child-process execution, TDD with Bun/Vitest

---

### Task 1: Add the daemon entrypoint and shared service model

**Files:**
- Modify: `packages/browser-cli/package.json`
- Create: `packages/browser-cli/src/aibrowserd.ts`
- Create: `packages/browser-cli/src/browser-cli-service-shared.ts`
- Test: `packages/browser-cli/src/browser-cli-service-shared.test.ts`

**Step 1: Write the failing shared-model test**

Create tests covering:
- service label naming
- default service file locations per OS
- daemon command generation for `aibrowserd run`

**Step 2: Run the test to verify it fails**

Run: `bun test packages/browser-cli/src/browser-cli-service-shared.test.ts`
Expected: FAIL because shared service helpers do not exist

**Step 3: Add the minimal shared service helpers**

Implement:
- `resolveAibrowserServiceName()`
- `resolveServicePlatform()`
- `resolveServicePaths()`
- `resolveDaemonCommand()`

Add `aibrowserd` as a second bin in `packages/browser-cli/package.json`.

**Step 4: Add the foreground daemon entrypoint**

Create `packages/browser-cli/src/aibrowserd.ts` that:
- exposes `run`
- starts `startBrowserControlServerFromConfig()`
- blocks in foreground until terminated
- shuts down cleanly on `SIGINT` and `SIGTERM`

**Step 5: Run the tests**

Run: `bun test packages/browser-cli/src/browser-cli-service-shared.test.ts`
Expected: PASS

**Step 6: Typecheck**

Run: `bunx tsc -p packages/browser-cli/tsconfig.json --noEmit`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/browser-cli/package.json packages/browser-cli/src/aibrowserd.ts packages/browser-cli/src/browser-cli-service-shared.ts packages/browser-cli/src/browser-cli-service-shared.test.ts
git commit -m "feat: add aibrowser daemon entrypoint"
```

### Task 2: Add launchd/systemd/WinSW config rendering

**Files:**
- Create: `packages/browser-cli/src/browser-cli-service-render.ts`
- Test: `packages/browser-cli/src/browser-cli-service-render.test.ts`

**Step 1: Write the failing renderer test**

Cover:
- launchd plist contains label, program arguments, and env vars
- systemd unit contains `ExecStart=`, `Environment=`, `WorkingDirectory=`
- WinSW XML contains id, name, executable, arguments, env, and log path

**Step 2: Run the test to verify it fails**

Run: `bun test packages/browser-cli/src/browser-cli-service-render.test.ts`
Expected: FAIL because render helpers do not exist

**Step 3: Implement minimal renderers**

Implement:
- `renderLaunchdPlist()`
- `renderSystemdUnit()`
- `renderWinSwXml()`

Keep output deterministic and text-based so tests can compare exact fragments.

**Step 4: Run renderer tests**

Run: `bun test packages/browser-cli/src/browser-cli-service-render.test.ts`
Expected: PASS

**Step 5: Typecheck**

Run: `bunx tsc -p packages/browser-cli/tsconfig.json --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/browser-cli/src/browser-cli-service-render.ts packages/browser-cli/src/browser-cli-service-render.test.ts
git commit -m "feat: render service manager definitions"
```

### Task 3: Add service install/uninstall/status command logic

**Files:**
- Modify: `packages/browser-cli/src/browser-cli.ts`
- Create: `packages/browser-cli/src/browser-cli-service.ts`
- Test: `packages/browser-cli/src/browser-cli-service.test.ts`

**Step 1: Write the failing service command test**

Cover:
- `aibrowser service install`
- `aibrowser service uninstall`
- `aibrowser service status`
- help output includes the new subcommands

Mock child-process execution and filesystem writes.

**Step 2: Run the test to verify it fails**

Run: `bun test packages/browser-cli/src/browser-cli-service.test.ts`
Expected: FAIL because service commands are not registered

**Step 3: Implement service command registration**

Add `registerBrowserServiceCommands()` under `aibrowser service`.

Install should:
- write the OS-specific service definition
- invoke `launchctl bootstrap`, `systemctl daemon-reload`, or WinSW `install`

Uninstall should:
- stop/disable where needed
- remove generated files
- invoke `launchctl bootout`, `systemctl disable --now`, or WinSW `uninstall`

Status should:
- query the OS service manager or WinSW wrapper
- preserve `--json` output support

**Step 4: Run tests**

Run: `bun test packages/browser-cli/src/browser-cli-service.test.ts packages/browser-cli/src/index.test.ts`
Expected: PASS

**Step 5: Typecheck**

Run: `bunx tsc -p packages/browser-cli/tsconfig.json --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/browser-cli/src/browser-cli.ts packages/browser-cli/src/browser-cli-service.ts packages/browser-cli/src/browser-cli-service.test.ts packages/browser-cli/src/index.test.ts
git commit -m "feat: add service install and status commands"
```

### Task 4: Add start/stop/restart execution paths

**Files:**
- Modify: `packages/browser-cli/src/browser-cli-service.ts`
- Test: `packages/browser-cli/src/browser-cli-service.test.ts`

**Step 1: Write failing start/stop/restart tests**

Cover:
- launchd `kickstart` / `bootout`
- systemd `start` / `stop` / `restart`
- WinSW `start` / `stop` / `restart`

**Step 2: Run tests to verify they fail**

Run: `bun test packages/browser-cli/src/browser-cli-service.test.ts`
Expected: FAIL on the new cases

**Step 3: Implement the minimal action handlers**

Add command handlers for:
- `aibrowser service start`
- `aibrowser service stop`
- `aibrowser service restart`

Return useful human output and structured JSON output.

**Step 4: Run tests**

Run: `bun test packages/browser-cli/src/browser-cli-service.test.ts`
Expected: PASS

**Step 5: Typecheck**

Run: `bunx tsc -p packages/browser-cli/tsconfig.json --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/browser-cli/src/browser-cli-service.ts packages/browser-cli/src/browser-cli-service.test.ts
git commit -m "feat: add service lifecycle commands"
```

### Task 5: Document service management and wrapper expectations

**Files:**
- Modify: `docs/testing/manual-browser-smoke.md`
- Create: `docs/testing/manual-service-management.md`

**Step 1: Write service documentation**

Document:
- `aibrowserd`
- `aibrowser service install|uninstall|start|stop|restart|status`
- launchd paths
- systemd paths
- WinSW wrapper expectation on Windows
- required env vars for service mode

**Step 2: Verify docs against the CLI**

Run:
- `bun run packages/browser-cli/src/index.ts service --help`
- `bun run packages/browser-cli/src/index.ts service install --help`

Expected: help output matches the documented command names

**Step 3: Commit**

```bash
git add docs/testing/manual-browser-smoke.md docs/testing/manual-service-management.md
git commit -m "docs: add service management guide"
```

### Task 6: Final verification

**Files:**
- Verify only

**Step 1: Run focused CLI tests**

Run:
- `bun test packages/browser-cli/src/browser-cli-service-shared.test.ts`
- `bun test packages/browser-cli/src/browser-cli-service-render.test.ts`
- `bun test packages/browser-cli/src/browser-cli-service.test.ts`
- `bun test packages/browser-cli/src/index.test.ts`

Expected: PASS

**Step 2: Run broader package verification**

Run:
- `bunx tsc -p packages/browser-cli/tsconfig.json --noEmit`
- `bun run packages/browser-cli/src/index.ts service --help`
- `bun run packages/browser-cli/src/aibrowserd.ts --help`

Expected: PASS

**Step 3: Commit final fixes if needed**

```bash
git add packages/browser-cli docs/testing
git commit -m "feat: add cross-platform browser service management"
```
