# @tungthedev/browser-cli

Standalone browser runtime CLI and daemon for Browser CLI.

## Install

```bash
npm install -g @tungthedev/browser-cli
```

Installed binaries:

- `browser-cli`
- `browser-clid`

## Quick Start

Start the daemon:

```bash
BROWSER_CLI_AUTH_TOKEN=smoke-token \
BROWSER_CLI_CONTROL_PORT=18888 \
browser-clid run
```

Then use the CLI:

```bash
browser-cli status
browser-cli start
browser-cli open https://example.com
browser-cli snapshot --format ai --refs aria
```

Default local behavior:

- base URL: `http://127.0.0.1:18888`
- default browser profile: `openclaw`
- auth token resolution:
  `--auth-token` -> `BROWSER_CLI_AUTH_TOKEN` -> `.browser-cli.json` -> `~/.browser-cli/auth.json`

Project-local config example:

```json
{
  "baseUrl": "http://127.0.0.1:18888",
  "browserProfile": "openclaw",
  "json": true,
  "authToken": "optional-project-token"
}
```

## Service Commands

```bash
browser-cli service install
browser-cli service status
browser-cli service restart
```

Supported service managers:

- `launchd`
- `systemd --user`
- WinSW wrapper on Windows

## Chrome Extension

```bash
browser-cli extension install
browser-cli extension path
```

The extension defaults to relay port `18889`.

## Attribution

This package is a focused extraction of the standalone browser runtime work originally developed in OpenClaw.

Protocol-critical and UX-critical pieces were copied first from the OpenClaw implementation and then adapted for Browser CLI-specific host glue, packaging, service management, and branding.

## License

MIT
