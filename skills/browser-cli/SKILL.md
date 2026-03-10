---
name: browser-cli
description: Standalone browser runtime CLI for local browser automation. Use when the user needs to start/stop browsers, navigate pages, take snapshots with element refs for AI interaction, click/type on elements, capture screenshots/PDFs, or automate browser tasks locally. Triggers include requests to "start browser", "open a URL", "take a snapshot", "click an element", "type in a field", "capture screenshot", or any task requiring local browser control via HTTP API.
allowed-tools: Bash(browser-cli), Bash(browser-clid)
---

# Browser CLI Skill

Browser CLI provides local browser automation with an HTTP API service. It uses the `snapshot → refs → act` workflow where snapshots return numbered element references that can be used for interactions.

## Prerequisites

The browser-clid daemon must be running:

```bash
# Check status
browser-cli service status

# Start service (if installed)
browser-cli service start

# Or run daemon in foreground
browser-clid run
```

## Core Workflow

1. **Start Browser**: `browser-cli start`
2. **Open URL**: `browser-cli open <url>`
3. **Snapshot**: `browser-cli snapshot --format ai --refs aria` (get element refs like `e1`, `e2`)
4. **Interact**: Use refs to click or type
5. **Re-snapshot**: After navigation or DOM changes, get fresh refs

## Essential Commands

### Browser Lifecycle

| Command | Description |
|---------|-------------|
| `browser-cli start` | Start browser instance |
| `browser-cli stop` | Stop browser instance |
| `browser-cli status` | Show browser status |

### Navigation and Tabs

| Command | Description |
|---------|-------------|
| `browser-cli open <url>` | Open URL in new tab |
| `browser-cli navigate <url>` | Navigate current tab |
| `browser-cli tabs` | List open tabs |

### Snapshot (Core AI Workflow)

| Command | Description |
|---------|-------------|
| `browser-cli snapshot --format ai --refs aria` | Get snapshot with AI-friendly output and ARIA refs |
| `browser-cli snapshot --format ai --refs generated` | Use generated refs (e1, e2, ...) |
| `browser-cli snapshot --full` | Full page snapshot |

### Interaction (Use Refs from Snapshot)

| Command | Description |
|---------|-------------|
| `browser-cli click <ref>` | Click element by ref |
| `browser-cli type <ref> "text" --submit` | Type text and submit form |
| `browser-cli press <key>` | Press a key (Enter, Escape, etc.) |
| `browser-cli scroll` | Scroll page |

### Capture and Debug

| Command | Description |
|---------|-------------|
| `browser-cli screenshot` | Capture screenshot |
| `browser-cli pdf` | Save page as PDF |
| `browser-cli console` | Get recent console messages |

## Key Patterns

### Form Submission

```bash
browser-cli open https://example.com/login
browser-cli snapshot --format ai --refs generated
# Parse refs from output, then:
browser-cli type e5 "username"
browser-cli type e6 "password"
browser-cli click e7  # submit button
```

### Taking Screenshots

```bash
browser-cli open https://example.com
browser-cli screenshot
```

### Working with Tabs

```bash
browser-cli tabs                    # List tabs
browser-cli click e3 --target tab   # Open in new tab
browser-cli tabs                    # Get new tab ID
browser-cli --target <id> snapshot  # Snapshot specific tab
```

## Configuration

Resolution order (highest priority wins):

1. CLI flags (`--base-url`, `--auth-token`, `--browser-profile`)
2. Environment variables (`BROWSER_CLI_*`)
3. Project config (`.browser-cli.json` in working directory)
4. Machine config (`~/.browser-cli/auth.json`)

### Common Environment Variables

| Variable | Description |
|----------|-------------|
| `BROWSER_CLI_AUTH_TOKEN` | Bearer token for service authentication |
| `BROWSER_CLI_CONTROL_PORT` | HTTP service port (default: 18888) |
| `BROWSER_CLI_RELAY_PORT` | Extension relay port (default: 18889) |

### Project Config (`.browser-cli.json`)

```json
{
  "baseUrl": "http://127.0.0.1:18888",
  "browserProfile": "default",
  "json": true
}
```

## Multiple Profiles

Profiles provide isolated browser instances:

```bash
browser-cli profiles                                    # List profiles
browser-cli create-profile --name work --color "#FF6600" # Create profile
browser-cli --browser-profile work start                # Use profile
browser-cli delete-profile --name work                  # Delete profile
```

## Service Management

Install daemon as OS service:

```bash
browser-cli service install              # Install with node (default)
browser-cli service install --runtime bun # Install with bun
browser-cli service install --runtime /path/to/bun  # Custom runtime

browser-cli service status
browser-cli service start
browser-cli service stop
browser-cli service restart
browser-cli service uninstall
```

## Ref Lifecycle

- **Refs are ephemeral** - They change when DOM updates
- **Always re-snapshot after**: navigation, form submission, dynamic content loading
- **Use `--refs aria`** for stable ARIA-based refs when available
- **Use `--refs generated`** for numbered refs (e1, e2, ...)

## Security

- Auth token stored in `~/.browser-cli/auth.json` (machine-level)
- Service only binds to localhost by default
- Use `BROWSER_CLI_AUTH_TOKEN` for service authentication

## Chrome Extension

For external browser control:

```bash
browser-cli extension install   # Install unpacked extension
browser-cli extension path      # Show extension path
```

Load extension in Chrome and it will connect to relay port 18889.
