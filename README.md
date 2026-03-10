# AIBrowser

A standalone browser runtime and CLI for local browser automation.

It keeps the browser service HTTP contract stable, preserves the Chrome relay contract, and keeps the Playwright-backed `snapshot -> refs -> act` workflow intact.

## Install

Runtime: Node.js 20.19+ recommended for the published CLI package.

```bash
npm install -g @tungthedev/browser-cli
```

This installs two binaries:

- `aibrowser`
- `aibrowserd`

## Quick Start

Start the foreground daemon:

```bash
AIBROWSER_AUTH_TOKEN=smoke-token \
AIBROWSER_CONTROL_PORT=18888 \
aibrowserd run
```

In another shell:

```bash
aibrowser status
aibrowser start
aibrowser open https://example.com
aibrowser snapshot --format ai --refs aria
```

Local CLI defaults:

- `--base-url` defaults to `http://127.0.0.1:18888`
- `--browser-profile` defaults to `openclaw`
- `--json` defaults to `true` from local config, otherwise normal CLI output
- auth token resolution order:
  `--auth-token` -> `AIBROWSER_AUTH_TOKEN` -> `.aibrowser.json` -> `~/.aibrowser/auth.json`

Project-local config is optional:

```json
{
  "baseUrl": "http://127.0.0.1:18888",
  "browserProfile": "openclaw",
  "json": true,
  "authToken": "optional-project-token"
}
```

Machine-local shared auth file:

```json
{
  "token": "machine-token"
}
```

Default path:

```text
~/.aibrowser/auth.json
```

## Service Management

Install the daemon into the local OS service manager:

```bash
aibrowser service install
```

Supported service managers:

- `launchd` on macOS
- `systemd --user` on Linux
- WinSW wrapper on Windows

Lifecycle commands:

```bash
aibrowser service status
aibrowser service start
aibrowser service stop
aibrowser service restart
aibrowser service uninstall
```

More detail: [docs/testing/manual-service-management.md](docs/testing/manual-service-management.md)

## Chrome Extension

Install the unpacked extension to a stable local path:

```bash
aibrowser extension install
aibrowser extension path
```

The extension defaults to relay port `18889`.

More detail: [docs/testing/manual-browser-smoke.md](docs/testing/manual-browser-smoke.md)

## Versioning And Release

This repo keeps one shared version across the root and all workspace packages.

Useful commands:

```bash
bun run version:check
bun run version:set -- 0.1.0
bun run version:bump:patch
bun run version:bump:minor
bun run version:bump:major
```

GitHub Actions:

- CI runs install, version check, typecheck, test, build, and `npm pack --dry-run`
- release publishes `@tungthedev/browser-cli` when the root `package.json` version changes on `main`
- manual release reruns are supported through `workflow_dispatch`

## Attribution

AIBrowser is a focused extraction of the standalone browser runtime work originally developed in OpenClaw.

Protocol-critical and UX-critical pieces in this repo were copied first from the OpenClaw implementation and then adapted for AIBrowser-specific host glue, packaging, service management, and branding.

Thank you to the OpenClaw maintainers for the original implementation and the foundation it provided.

Related local source during this extraction:

- `../openclaw`

## License

MIT. See [LICENSE](LICENSE).
