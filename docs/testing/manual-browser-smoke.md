# Manual Browser Smoke

This smoke path validates the standalone browser service and CLI in Node-first mode while keeping the public contracts unchanged.

## Current runtime stance

- Run the browser service under Bun.
- Run Playwright-backed browser actions through the Node worker bridge.
- Keep CLI, browser HTTP routes, and `snapshot -> refs -> act` behavior unchanged.
- Defer Bun-native `connectOverCDP()` work until the Bun/runtime issue is revisited.

## Prerequisites

- Install workspace dependencies with `bun install`.
- Have Google Chrome installed locally.
- Use an auth token for the browser service.

## Start the service

```bash
AIBROWSER_AUTH_TOKEN=smoke-token \
AIBROWSER_CONTROL_PORT=18888 \
bun --eval 'import { startBrowserControlServerFromConfig } from "./packages/browser-service/src/server.ts"; const state = await startBrowserControlServerFromConfig(); console.log(state ? `STARTED:${state.port}` : "NOT_STARTED"); setInterval(() => {}, 1 << 30);'
```

Expected:

- The process prints `STARTED:18888`.
- Requests without auth fail closed.

```bash
curl -i http://127.0.0.1:18888/
```

Expected: `401 Unauthorized`

## Lifecycle smoke

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json status
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json start
```

Expected:

- `status` reports `running: false` before start.
- `start` reports `running: true`, `cdpReady: true`, and `cdpHttp: true`.

## Snapshot -> refs -> act smoke

Open a page:

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json open https://example.com
```

Save the returned `targetId`, then snapshot with refs:

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json snapshot --format ai --refs aria --target-id <targetId>
```

Expected:

- Snapshot succeeds.
- Refs include the `Learn more` link as `e6`.

Act on a stable ref:

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json click e6 --target-id <targetId>
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json tabs
```

Expected:

- `click` succeeds.
- `tabs` shows the same `targetId` navigated to `https://www.iana.org/help/example-domains`.

## Media smoke

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json screenshot --target-id <targetId>
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json pdf --target-id <targetId>
```

Expected:

- Both commands return `ok: true`.
- Both responses include a saved media `path` under `.aibrowser/media/`.

## Navigate + type + evaluate smoke

Open a page with a text field:

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json open https://www.wikipedia.org/
```

Save the returned `targetId`, then snapshot:

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json snapshot --format ai --refs aria --target-id <targetId>
```

Expected:

- The search box appears as ref `e62` in the current snapshot.

Type and verify:

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json type e62 'OpenAI' --target-id <targetId>
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json evaluate --fn '() => document.activeElement?.value ?? null' --target-id <targetId>
```

Expected:

- `type` returns `ok: true`.
- `evaluate` returns `result: "OpenAI"`.

## Stop

```bash
bun run packages/browser-cli/src/index.ts --base-url http://127.0.0.1:18888 --auth-token smoke-token --json stop
```

Expected: `running: false`

## Relay and extension note

- The standalone relay package and auth behavior are covered by package tests.
- Full relay + Chrome extension end-to-end validation is intentionally deferred until the unpacked extension is installed in Chrome for this repo.
- Once the extension is installed, add manual checks for:
  - `GET /extension/status`
  - `GET /json/version`
  - `GET /json/list`
  - `WS /extension`
  - `WS /cdp`
