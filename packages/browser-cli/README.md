# @tungthedev/browser-cli

Standalone browser runtime CLI and daemon for AIBrowser.

## Install

```bash
npm install -g @tungthedev/browser-cli
```

Installed binaries:

- `aibrowser`
- `aibrowserd`

## Quick Start

Start the daemon:

```bash
AIBROWSER_AUTH_TOKEN=smoke-token \
AIBROWSER_CONTROL_PORT=18888 \
aibrowserd run
```

Then use the CLI:

```bash
aibrowser status
aibrowser start
aibrowser open https://example.com
aibrowser snapshot --format ai --refs aria
```

Default local behavior:

- base URL: `http://127.0.0.1:18888`
- default browser profile: `openclaw`
- auth token resolution:
  `--auth-token` -> `AIBROWSER_AUTH_TOKEN` -> `.aibrowser.json` -> `~/.aibrowser/auth.json`

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
aibrowser service install
aibrowser service status
aibrowser service restart
```

Supported service managers:

- `launchd`
- `systemd --user`
- WinSW wrapper on Windows

## Chrome Extension

```bash
aibrowser extension install
aibrowser extension path
```

The extension defaults to relay port `18889`.

## Attribution

This package is a focused extraction of the standalone browser runtime work originally developed in OpenClaw.

Protocol-critical and UX-critical pieces were copied first from the OpenClaw implementation and then adapted for AIBrowser-specific host glue, packaging, service management, and branding.

## License

MIT
