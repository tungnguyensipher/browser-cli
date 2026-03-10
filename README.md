# Browser CLI

A standalone browser runtime and CLI for local browser automation.

It keeps the browser service HTTP contract stable, preserves the Chrome relay contract, and keeps the Playwright-backed `snapshot -> refs -> act` workflow intact.

## Install

Runtime: Node.js 20.19+ recommended for the published CLI package.

```bash
npm install -g @tungthedev/browser-cli
```

This installs two binaries:

- `browser-cli`
- `browser-clid`

## Quick Start

Start the foreground daemon:

```bash
BROWSER_CLI_AUTH_TOKEN=private-token \
BROWSER_CLI_CONTROL_PORT=18888 \
browser-clid run
```

In another shell:

```bash
browser-cli status
browser-cli start
browser-cli open https://example.com
browser-cli snapshot --format ai --refs aria
```

Local CLI defaults:

- `--base-url` defaults to `http://127.0.0.1:18888`
- `--browser-profile` defaults to `openclaw`
- `--json` defaults to `true` from local config, otherwise normal CLI output
- auth token resolution order:
  `--auth-token` -> `BROWSER_CLI_AUTH_TOKEN` -> `.browser-cli.json` -> `~/.browser-cli/auth.json`

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
~/.browser-cli/auth.json
```

## Service Management

Install the daemon into the local OS service manager:

```bash
browser-cli service install
```

Supported service managers:

- `launchd` on macOS
- `systemd --user` on Linux
- WinSW wrapper on Windows

Lifecycle commands:

```bash
browser-cli service status
browser-cli service start
browser-cli service stop
browser-cli service restart
browser-cli service uninstall
```

More detail: [docs/testing/manual-service-management.md](docs/testing/manual-service-management.md)

## Chrome Extension

Install the unpacked extension to a stable local path:

```bash
browser-cli extension install
browser-cli extension path
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

Browser CLI is a focused extraction of the standalone browser runtime work originally developed in [OpenClaw](https://github.com/openclaw/openclaw).

## License

MIT. See [LICENSE](LICENSE).
