# Bun Browser Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Bun-based standalone browser runtime that keeps the Chrome relay interface, browser HTTP API, and Playwright `snapshot -> refs -> act` UX intact while removing OpenClaw-specific config, gateway, runtime, and CLI glue.

**Architecture:** Keep the external contracts stable and treat the extraction as protocol-first. Copy the Chrome extension assets, relay protocol, browser route handlers, and Playwright ref/snapshot engine from `../openclaw` where they already encode the desired behavior. Rewrite the host-specific layers: config loading, auth bootstrap, HTTP transport, CLI transport, filesystem layout, and product-branded messaging.

**Tech Stack:** Bun workspaces, TypeScript, Bun runtime, Playwright, Chrome MV3 extension, HTTP/WebSocket server, copy-first extraction from `../openclaw`

---

## Guardrails

- Keep the browser service HTTP paths and request/response shapes unchanged.
- Keep the relay endpoints and relay-token derivation format unchanged.
- Keep `snapshot -> refs -> act` semantics unchanged, including AI snapshots, aria snapshots, stable refs, and ref-based actions.
- Prefer copy-first extraction from `../openclaw` for protocol-critical and UX-critical modules.
- Rewrite OpenClaw-only config/auth/runtime/CLI layers instead of dragging their dependencies into this repo.
- Stop and report immediately if copied code pulls in a hidden dependency that changes one of the stable external contracts above.

## Target Workspace Layout

```text
package.json
bunfig.toml
tsconfig.json
docs/plans/2026-03-09-bun-browser-runtime.md
docs/testing/manual-browser-smoke.md
packages/
  browser-shared/
  browser-relay/
  browser-service/
  browser-engine-playwright/
  browser-client/
  browser-cli/
  chrome-extension/
```

## Package Responsibilities

- `packages/browser-shared`
  - Shared browser types, constants, config normalization, standalone runtime config/auth helpers, CDP helpers, navigation guard logic, target-id helpers, HTTP auth helpers, and profile helper utilities.
- `packages/browser-relay`
  - Chrome extension relay server and relay auth helpers, preserving the current `/json/*`, `/cdp`, and `/extension` behavior.
- `packages/browser-service`
  - Standalone browser runtime state, profile lifecycle, Chrome launch/attach helpers, route handlers, HTTP middleware, output/media helpers needed by the current API, and service bootstrap.
- `packages/browser-engine-playwright`
  - Playwright-over-CDP session management, ref persistence, snapshots, actions, screenshots, waits, evaluate, and the debug/state helpers that power current browser-tool behavior.
- `packages/browser-client`
  - Pure HTTP client SDK with flat compatibility exports and a small transport abstraction. No in-process dispatcher fallback.
- `packages/browser-cli`
  - Bun CLI built directly on `browser-client`, preserving the browser tool command surface and JSON UX while dropping gateway RPC and OpenClaw host concerns.
- `packages/chrome-extension`
  - Unpacked MV3 extension copied from OpenClaw.

## Copy/Rewrite Boundaries

### Copy largely intact

- `../openclaw/assets/chrome-extension/**`
- `src/browser/extension-relay.ts`
- `src/browser/cdp.ts`
- `src/browser/cdp.helpers.ts`
- `src/browser/cdp-timeouts.ts`
- `src/browser/target-id.ts`
- `src/browser/navigation-guard.ts`
- `src/browser/pw-role-snapshot.ts`
- `src/browser/pw-session.ts`
- `src/browser/pw-session.page-cdp.ts`
- `src/browser/pw-tools-core.ts`
- `src/browser/pw-tools-core.*.ts`
- `src/browser/routes/basic.ts`
- `src/browser/routes/tabs.ts`
- `src/browser/routes/agent.ts`
- `src/browser/routes/agent.shared.ts`
- `src/browser/routes/agent.snapshot.ts`
- `src/browser/routes/agent.snapshot.plan.ts`
- `src/browser/routes/agent.act.ts`
- `src/browser/routes/agent.act.*.ts`
- `src/browser/routes/agent.debug.ts`
- `src/browser/routes/agent.storage.ts`
- `src/browser/routes/index.ts`
- `src/browser/routes/types.ts`
- `src/browser/routes/utils.ts`

### Copy and adapt

- `src/browser/config.ts`
- `src/browser/profile-capabilities.ts`
- `src/browser/constants.ts`
- `src/browser/errors.ts`
- `src/browser/chrome.ts`
- `src/browser/chrome.executables.ts`
- `src/browser/chrome.profile-decoration.ts`
- `src/browser/profiles.ts`
- `src/browser/server-context.ts`
- `src/browser/server-context.types.ts`
- `src/browser/server-context.availability.ts`
- `src/browser/server-context.selection.ts`
- `src/browser/server-context.tab-ops.ts`
- `src/browser/server-context.reset.ts`
- `src/browser/resolved-config-refresh.ts`
- `src/browser/runtime-lifecycle.ts`
- `src/browser/server-lifecycle.ts`
- `src/browser/profiles-service.ts`
- `src/browser/form-fields.ts`
- `src/browser/screenshot.ts`
- `src/browser/client.ts`
- `src/browser/client-actions.ts`
- `src/browser/client-actions-core.ts`
- `src/browser/client-actions-observe.ts`
- `src/browser/client-actions-state.ts`
- `src/browser/client-actions-types.ts`
- `src/browser/paths.ts`
- `src/browser/output-atomic.ts`
- `src/browser/safe-filename.ts`

### Rewrite for standalone runtime

- `src/browser/server.ts`
- `src/browser/control-auth.ts`
- `src/browser/http-auth.ts`
- `src/browser/server-middleware.ts`
- `src/browser/extension-relay-auth.ts`
- `src/browser/client-fetch.ts`
- `src/cli/browser-cli.ts`
- `src/cli/browser-cli-*.ts`
- `src/cli/browser-cli-actions-input/**`
- Any OpenClaw config loader, gateway RPC, logging, globals, terminal UI, docs-link, clipboard, and runtime wrappers

## Stable External Contracts

### Browser service endpoints

- `GET /`
- `POST /start`
- `POST /stop`
- `POST /reset-profile`
- `GET /profiles`
- `POST /profiles/create`
- `DELETE /profiles/:name`
- `GET /tabs`
- `POST /tabs/open`
- `POST /tabs/focus`
- `DELETE /tabs/:targetId`
- `POST /tabs/action`
- `POST /navigate`
- `GET /snapshot`
- `POST /screenshot`
- `POST /act`
- `GET /console`
- `POST /pdf`
- `POST /hooks/dialog`
- `POST /hooks/file-chooser`

### Relay endpoints

- `GET /`
- `HEAD /`
- `GET /extension/status`
- `GET /json/version`
- `GET /json/list`
- `GET|PUT /json/activate/:targetId`
- `GET|PUT /json/close/:targetId`
- `WS /cdp`
- `WS /extension`

### CLI contract

Global flags:

- `--json`
- `--base-url <url>`
- `--auth-token <token>`
- `--browser-profile <name>`

Lifecycle and profile commands:

- `aibrowser status`
- `aibrowser start`
- `aibrowser stop`
- `aibrowser reset-profile`
- `aibrowser profiles`
- `aibrowser create-profile --name <name> [--color <hex>] [--cdp-url <url>] [--driver openclaw|extension]`
- `aibrowser delete-profile --name <name>`
- `aibrowser extension install`
- `aibrowser extension path`

Tab commands:

- `aibrowser tabs`
- `aibrowser tab`
- `aibrowser tab new`
- `aibrowser tab select <index>`
- `aibrowser tab close <index>`
- `aibrowser open <url>`
- `aibrowser focus <targetId>`
- `aibrowser close <targetId>`

Observe commands:

- `aibrowser snapshot [--format ai|aria] [--refs role|aria] [--interactive] [--compact] [--depth <n>] [--selector <css>] [--frame <css>] [--labels] [--mode efficient] [--target-id <id>]`
- `aibrowser screenshot [--target-id <id>] [--full-page] [--ref <ref>] [--element <css>] [--type png|jpeg]`
- `aibrowser console [--level error|warn|log] [--target-id <id>]`
- `aibrowser pdf [--target-id <id>]`

Action commands:

- `aibrowser navigate <url> [--target-id <id>]`
- `aibrowser click <ref> [--target-id <id>] [--double] [--button left|right|middle]`
- `aibrowser type <ref> <text> [--target-id <id>] [--submit] [--slowly]`
- `aibrowser press <key> [--target-id <id>] [--delay-ms <n>]`
- `aibrowser hover <ref> [--target-id <id>]`
- `aibrowser scroll-into-view <ref> [--target-id <id>]`
- `aibrowser drag <startRef> <endRef> [--target-id <id>]`
- `aibrowser select <ref> <value...> [--target-id <id>]`
- `aibrowser fill --fields '<json>' [--target-id <id>]`
- `aibrowser resize <width> <height> [--target-id <id>]`
- `aibrowser wait [--time-ms <n>] [--text <txt>] [--text-gone <txt>] [--selector <css>] [--url <pattern>] [--load-state load|domcontentloaded|networkidle] [--fn <js>] [--target-id <id>] [--timeout-ms <n>]`
- `aibrowser evaluate --fn <js> [--ref <ref>] [--target-id <id>] [--timeout-ms <n>]`
- `aibrowser dialog --accept|--dismiss [--prompt-text <txt>] [--target-id <id>]`
- `aibrowser upload --paths <file...> [--input-ref <ref>] [--ref <ref>] [--element <css>] [--target-id <id>]`
- `aibrowser act --kind <kind> ...`

## Execution Notes

- If `/Volumes/Data/Projects/exp/auto-browser` is still not a git repository when implementation starts, either run `git init` before Task 1 or skip the commit step text until git is available.
- Prefer package-local tests and typechecks after each extraction milestone.
- When a copied module pulls an unexpected OpenClaw dependency, promote the helper into the appropriate package instead of reaching back into OpenClaw config/runtime code.

## Implementation Tasks

### Task 1: Create the Bun workspace skeleton

**Files:**
- Create: `package.json`
- Create: `bunfig.toml`
- Create: `tsconfig.json`
- Create: `packages/browser-shared/package.json`
- Create: `packages/browser-relay/package.json`
- Create: `packages/browser-service/package.json`
- Create: `packages/browser-engine-playwright/package.json`
- Create: `packages/browser-client/package.json`
- Create: `packages/browser-cli/package.json`
- Create: `packages/chrome-extension/package.json`
- Create: `packages/*/tsconfig.json`

**Step 1: Write the root workspace manifest**

Create a Bun workspace rooted at `package.json` with `"workspaces": ["packages/*"]` and shared `build`, `typecheck`, and `test` scripts.

**Step 2: Add per-package manifests**

Create scoped manifests such as `@aibrowser/browser-service` with only the workspace dependencies they actually need.

**Step 3: Add shared TypeScript configuration**

Create root `tsconfig.json` plus per-package `tsconfig.json` files with package-local `src` roots and declaration output.

**Step 4: Verify the workspace installs**

Run: `bun install`
Expected: `bun.lock` created and workspaces linked without errors

**Step 5: Commit**

```bash
git add package.json bunfig.toml tsconfig.json packages/*/package.json packages/*/tsconfig.json
git commit -m "chore: scaffold bun browser workspace"
```

### Task 2: Copy the Chrome extension package

**Files:**
- Create: `packages/chrome-extension/**`

**Step 1: Copy the unpacked extension assets**

Copy `../openclaw/assets/chrome-extension/**` into `packages/chrome-extension/`.

**Step 2: Add package metadata**

Add a lightweight `packages/chrome-extension/package.json` for packaging and install tooling.

**Step 3: Verify the manifest**

Run: `cat packages/chrome-extension/manifest.json`
Expected: MV3 manifest with `debugger`, `tabs`, `storage`, `alarms`, and `webNavigation`

**Step 4: Commit**

```bash
git add packages/chrome-extension
git commit -m "feat: add chrome extension package"
```

### Task 3: Extract shared standalone foundations

**Files:**
- Create: `packages/browser-shared/src/config.ts`
- Create: `packages/browser-shared/src/profile-capabilities.ts`
- Create: `packages/browser-shared/src/constants.ts`
- Create: `packages/browser-shared/src/errors.ts`
- Create: `packages/browser-shared/src/cdp.ts`
- Create: `packages/browser-shared/src/cdp.helpers.ts`
- Create: `packages/browser-shared/src/cdp-timeouts.ts`
- Create: `packages/browser-shared/src/target-id.ts`
- Create: `packages/browser-shared/src/navigation-guard.ts`
- Create: `packages/browser-shared/src/runtime-config.ts`
- Create: `packages/browser-shared/src/http-auth.ts`
- Create: `packages/browser-shared/src/profiles.ts`
- Create: `packages/browser-shared/src/network-security.ts`
- Create: `packages/browser-shared/src/index.ts`

**Step 1: Copy the protocol and navigation primitives**

Copy the shared modules listed in the copy-first sections above.

**Step 2: Promote hidden helpers into standalone files**

Add standalone replacements for config loading, auth/header parsing, loopback checks, SSRF policy plumbing, and profile helpers so the copied modules no longer import OpenClaw config or gateway code.

**Step 3: Preserve config semantics**

Keep the current `defaultProfile`, built-in `"openclaw"` and `"chrome"` profile behavior, and relay-at-`controlPort + 1` convention while moving config sources to env vars plus one local runtime config file.

**Step 4: Export the shared surface**

Create `src/index.ts` exporting config helpers, auth helpers, CDP helpers, constants, errors, profile helpers, and target-id helpers.

**Step 5: Verify shared package typecheck**

Run: `bunx tsc -p packages/browser-shared/tsconfig.json --noEmit`
Expected: no type errors

**Step 6: Commit**

```bash
git add packages/browser-shared
git commit -m "feat: extract standalone browser shared foundations"
```

### Task 4: Extract the relay server without gateway coupling

**Files:**
- Create: `packages/browser-relay/src/extension-relay.ts`
- Create: `packages/browser-relay/src/extension-relay-auth.ts`
- Create: `packages/browser-relay/src/index.ts`
- Test: `packages/browser-relay/src/*.test.ts`

**Step 1: Copy the relay runtime**

Copy `extension-relay.ts` from OpenClaw and rewrite imports to `@aibrowser/browser-shared` and local relay helpers.

**Step 2: Rewrite relay auth loading only**

Keep the relay-token derivation format and accepted header/query behavior unchanged, but replace OpenClaw secret/config resolution with standalone config/env resolution.

**Step 3: Export the stable relay API**

Expose:
- `ensureChromeExtensionRelayServer()`
- `stopChromeExtensionRelayServer()`
- `getChromeExtensionRelayAuthHeaders()`

**Step 4: Verify relay behavior**

Run: `bun test packages/browser-relay`
Expected: relay tests pass or, if tests are still being ported, the package at least compiles cleanly

**Step 5: Commit**

```bash
git add packages/browser-relay
git commit -m "feat: extract standalone chrome relay"
```

### Task 5: Extract runtime, profile, and Chrome lifecycle helpers

**Files:**
- Create: `packages/browser-service/src/chrome.ts`
- Create: `packages/browser-service/src/chrome.executables.ts`
- Create: `packages/browser-service/src/chrome.profile-decoration.ts`
- Create: `packages/browser-service/src/server-context.ts`
- Create: `packages/browser-service/src/server-context.types.ts`
- Create: `packages/browser-service/src/server-context.availability.ts`
- Create: `packages/browser-service/src/server-context.selection.ts`
- Create: `packages/browser-service/src/server-context.tab-ops.ts`
- Create: `packages/browser-service/src/server-context.reset.ts`
- Create: `packages/browser-service/src/resolved-config-refresh.ts`
- Create: `packages/browser-service/src/runtime-lifecycle.ts`
- Create: `packages/browser-service/src/server-lifecycle.ts`
- Create: `packages/browser-service/src/profiles-service.ts`
- Create: `packages/browser-service/src/index.ts`

**Step 1: Copy the profile/runtime modules**

Copy the files above from OpenClaw into `packages/browser-service/src/`.

**Step 2: Replace OpenClaw-only dependencies**

Swap OpenClaw config I/O, paths, logging, and trash helpers for standalone runtime-config access plus local filesystem helpers.

**Step 3: Preserve runtime behavior**

Keep the current per-profile state model, availability checks, attach-only behavior, target selection behavior, remote-CDP handling, and extension-profile handling.

**Step 4: Make Chrome launch concerns optional**

Keep managed Chrome launch support, but isolate executable discovery, profile decoration, and user-data path decisions behind local helpers so extension-backed and remote-CDP flows can reuse the runtime without dragging product-specific paths everywhere.

**Step 5: Verify service runtime typecheck**

Run: `bunx tsc -p packages/browser-service/tsconfig.json --noEmit`
Expected: no type errors for runtime and profile modules

**Step 6: Commit**

```bash
git add packages/browser-service
git commit -m "feat: extract browser runtime and profile lifecycle"
```

### Task 6: Extract the HTTP service layer and keep the API contract unchanged

**Files:**
- Create: `packages/browser-service/src/server.ts`
- Create: `packages/browser-service/src/server-middleware.ts`
- Create: `packages/browser-service/src/auth.ts`
- Create: `packages/browser-service/src/routes/**`
- Create: `packages/browser-service/src/media-store.ts`
- Create: `packages/browser-service/src/output-paths.ts`
- Create: `packages/browser-service/src/output-atomic.ts`
- Create: `packages/browser-service/src/paths.ts`
- Create: `packages/browser-service/src/safe-filename.ts`

**Step 1: Copy the route handlers**

Copy the route files from OpenClaw that define the stable browser-service API.

**Step 2: Rewrite service bootstrap and middleware**

Replace `server.ts`, auth bootstrap, and HTTP middleware with standalone versions that preserve loopback bind, fail-closed auth behavior, and current request parsing semantics.

**Step 3: Keep browser-service payloads unchanged**

Do not rename endpoints, alter response field names, or change how profile/target-id selection works.

**Step 4: Localize artifact/output helpers**

Keep the current screenshot/pdf/trace/download outputs working, but move their path and storage logic under `packages/browser-service` instead of OpenClaw media/runtime modules.

**Step 5: Verify service contract**

Run: `bunx tsc -p packages/browser-service/tsconfig.json --noEmit`
Expected: no type errors

**Step 6: Add a small contract smoke test**

Run: `bun test packages/browser-service`
Expected: route registration or handler tests pass for at least `/`, `/tabs`, `/snapshot`, `/act`, `/console`, and `/pdf`

**Step 7: Commit**

```bash
git add packages/browser-service
git commit -m "feat: extract standalone browser http service"
```

### Task 7: Extract the Playwright engine core first

**Files:**
- Create: `packages/browser-engine-playwright/src/pw-session.ts`
- Create: `packages/browser-engine-playwright/src/pw-session.page-cdp.ts`
- Create: `packages/browser-engine-playwright/src/pw-role-snapshot.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.shared.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.interactions.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.snapshot.ts`
- Create: `packages/browser-engine-playwright/src/index.ts`

**Step 1: Copy the ref and snapshot engine**

Copy the files that implement role snapshots, AI snapshots, target-scoped ref caching, `refLocator()`, and the ref-based interaction helpers.

**Step 2: Preserve the `snapshot -> refs -> act` contract**

Keep stable refs, aria refs, selector/frame limitations, and the current target-based ref persistence behavior.

**Step 3: Rewire dependencies**

Move shared helpers to `@aibrowser/browser-shared` and keep the engine independent from service bootstrap code.

**Step 4: Verify engine core**

Run: `bunx tsc -p packages/browser-engine-playwright/tsconfig.json --noEmit`
Expected: no type errors

**Step 5: Commit**

```bash
git add packages/browser-engine-playwright
git commit -m "feat: extract playwright ref and snapshot engine"
```

### Task 8: Add the remaining Playwright-backed behaviors

**Files:**
- Create: `packages/browser-engine-playwright/src/pw-ai.ts`
- Create: `packages/browser-engine-playwright/src/pw-ai-module.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.activity.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.downloads.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.responses.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.state.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.storage.ts`
- Create: `packages/browser-engine-playwright/src/pw-tools-core.trace.ts`
- Create: `packages/browser-engine-playwright/src/form-fields.ts`
- Create: `packages/browser-engine-playwright/src/screenshot.ts`

**Step 1: Copy the optional-but-currently-supported engine helpers**

Copy the modules that power console/errors/requests, cookies/storage, uploads/downloads, trace, and screenshot normalization hooks needed by the current API.

**Step 2: Keep current browser-tool behavior**

Preserve `wait`, `evaluate`, `dialog`, `upload`, `pdf`, debug routes, and smart screenshot routing.

**Step 3: Isolate host-only IO**

Keep filesystem-specific code in small local helpers so the engine remains mostly transport-neutral.

**Step 4: Verify full engine package**

Run: `bunx tsc -p packages/browser-engine-playwright/tsconfig.json --noEmit`
Expected: no type errors

**Step 5: Commit**

```bash
git add packages/browser-engine-playwright
git commit -m "feat: extract remaining playwright browser helpers"
```

### Task 9: Build a pure HTTP browser client SDK

**Files:**
- Create: `packages/browser-client/src/client.ts`
- Create: `packages/browser-client/src/client-actions.ts`
- Create: `packages/browser-client/src/client-actions-core.ts`
- Create: `packages/browser-client/src/client-actions-observe.ts`
- Create: `packages/browser-client/src/client-actions-state.ts`
- Create: `packages/browser-client/src/client-actions-types.ts`
- Create: `packages/browser-client/src/client-fetch.ts`
- Create: `packages/browser-client/src/index.ts`

**Step 1: Copy the typed client surface**

Copy the typed client files from OpenClaw.

**Step 2: Rewrite transport only**

Replace `client-fetch.ts` with a standalone HTTP transport that supports base URL, auth headers, timeouts, and default profile selection, but does not auto-start the service or dispatch requests in-process.

**Step 3: Keep compatibility exports**

Expose the current flat helper functions plus a `createBrowserClient()` entrypoint backed by the same request shapes.

**Step 4: Verify client typecheck**

Run: `bunx tsc -p packages/browser-client/tsconfig.json --noEmit`
Expected: no type errors

**Step 5: Commit**

```bash
git add packages/browser-client
git commit -m "feat: extract standalone browser client sdk"
```

### Task 10: Rewrite the CLI on top of the standalone client

**Files:**
- Create: `packages/browser-cli/src/browser-cli.ts`
- Create: `packages/browser-cli/src/browser-cli-*.ts`
- Create: `packages/browser-cli/src/browser-cli-actions-input/**`
- Create: `packages/browser-cli/src/index.ts`

**Step 1: Port the browser CLI command layout**

Copy the command grouping and verb-oriented UX from OpenClaw CLI modules.

**Step 2: Drop OpenClaw host integration**

Replace gateway RPC, runtime/globals, themed output, docs links, clipboard helpers, and OpenClaw extension-install assumptions with direct `browser-client` calls and small Bun-native helpers.

**Step 3: Preserve user-visible browser UX**

Keep `--json`, `--browser-profile`, `--target-id`, index-based tab shortcuts, and the current browser command names.

**Step 4: Add the Bun entrypoint**

Create `packages/browser-cli/src/index.ts` as the executable wrapper.

**Step 5: Verify CLI help output**

Run: `bun run packages/browser-cli/src/index.ts --help`
Expected: help output lists lifecycle, profile, tab, snapshot, screenshot, navigate, action, and extension commands

**Step 6: Commit**

```bash
git add packages/browser-cli
git commit -m "feat: add standalone bun browser cli"
```

### Task 11: Add standalone auth/config wiring and end-to-end validation

**Files:**
- Modify: `packages/browser-shared/src/runtime-config.ts`
- Modify: `packages/browser-service/src/auth.ts`
- Modify: `packages/browser-relay/src/extension-relay-auth.ts`
- Modify: `packages/browser-client/src/client-fetch.ts`
- Create: `docs/testing/manual-browser-smoke.md`

**Step 1: Finalize standalone config sources**

Support env vars and one local config file for:
- service bind address
- auth token and optional password
- default profile
- relay bind host
- browser profiles
- output/media directories

**Step 2: Verify auth behavior**

Confirm the browser service stays fail-closed without valid auth and that the relay still accepts the same derived token/header/query semantics.

**Step 3: Run local end-to-end validation**

Verify:
- service startup
- relay startup
- extension connection
- `/json/list`
- `tabs`
- `snapshot`
- `click`
- `type`
- `navigate`
- `screenshot`

**Step 4: Document the manual smoke path**

Write the exact setup steps and commands to `docs/testing/manual-browser-smoke.md`.

**Step 5: Commit**

```bash
git add packages/browser-shared packages/browser-service packages/browser-relay packages/browser-client docs/testing/manual-browser-smoke.md
git commit -m "feat: finalize standalone browser runtime wiring"
```
