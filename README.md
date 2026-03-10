# Browser CLI

A standalone browser runtime and CLI for local browser automation.

Designed for AI agents and automation scripts, Browser CLI exposes browser control via a stable HTTP API. It powers the `snapshot → refs → act` workflow used by LLM-based tools to see and interact with web pages.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design and component details.

## Install

Runtime: Node.js 20.19+ recommended for the published CLI package.

```bash
npm install -g @tungthedev/browser-cli
```

This installs two binaries:

- `browser-cli` — CLI for browser automation
- `browser-clid` — Foreground daemon (run in a separate terminal)

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

## Common Commands

```bash
# Browser lifecycle
browser-cli start                           # Start browser
browser-cli stop                            # Stop browser
browser-cli status                          # Show browser status

# Navigation and tabs
browser-cli open https://example.com        # Open URL in new tab
browser-cli tabs                            # List open tabs
browser-cli navigate https://example.com    # Navigate current tab

# Snapshot and interaction (the "snapshot → refs → act" workflow)
browser-cli snapshot --format ai            # Get page snapshot with element refs
browser-cli click e5                        # Click element by ref from snapshot
browser-cli type e12 "hello" --submit       # Type text and submit
browser-cli press Enter                     # Press a key

# Capture and debug
browser-cli screenshot                      # Capture screenshot
browser-cli pdf                             # Save page as PDF
browser-cli console                         # Get recent console messages
```

## Configuration

Resolution order (highest priority wins):

1. CLI flags (`--base-url`, `--auth-token`, `--browser-profile`)
2. Environment variables (`BROWSER_CLI_*`)
3. Project config (`.browser-cli.json` in working directory)
4. Machine config (`~/.browser-cli/auth.json`)

Common environment variables:

| Variable | Description |
|----------|-------------|
| `BROWSER_CLI_AUTH_TOKEN` | Bearer token for service authentication |
| `BROWSER_CLI_CONTROL_PORT` | HTTP service port (default: 18888) |
| `BROWSER_CLI_RELAY_PORT` | Extension relay port (default: 18889) |

Project config file (`.browser-cli.json`):

```json
{
  "baseUrl": "http://127.0.0.1:18888",
  "authToken": "optional-token",
  "browserProfile": "default",
  "json": true
}
```

## Multiple Profiles

Profiles provide isolated browser instances with separate user data and CDP ports.

```bash
browser-cli profiles                                    # List all profiles
browser-cli create-profile --name work --color "#FF6600" # Create new profile
browser-cli --browser-profile work start                # Use specific profile
browser-cli delete-profile --name work                  # Delete a profile
browser-cli reset-profile                               # Reset profile data (moves to Trash)
```

Profile types:

- **Local** (default): Service launches and manages Chrome
- **Remote**: Connect to existing Chrome via CDP URL (`--cdp-url`)
- **Extension**: Use Chrome extension relay for external browser control

## Service Management

Install the daemon into the local OS service manager:

```bash
browser-cli service install
```

Supported service managers:

- `launchd` on macOS
- `systemd --user` on Linux
- WinSW wrapper on Windows (x64, x86, ARM64)

On Windows, a compatible WinSW executable is bundled with the package. To use a custom WinSW version:

```bash
browser-cli service install --winsw-exe "C:\path\to\winsw.exe"
```

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

The extension connects to relay port `18889` for external browser control.

More detail: [docs/testing/manual-browser-smoke.md](docs/testing/manual-browser-smoke.md)

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) — System design, components, and data flow
- [Manual Service Management](docs/testing/manual-service-management.md) — Service installation and lifecycle
- [Manual Browser Smoke Tests](docs/testing/manual-browser-smoke.md) — End-to-end validation guide

## Versioning and Release

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
- Release publishes `@tungthedev/browser-cli` when the root `package.json` version changes on `main`
- Manual release reruns are supported through `workflow_dispatch`

## Attribution

Browser CLI is a focused extraction of the standalone browser runtime work originally developed in [OpenClaw](https://github.com/openclaw/openclaw).

## License

MIT. See [LICENSE](LICENSE).
