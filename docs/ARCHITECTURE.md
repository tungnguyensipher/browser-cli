# Browser CLI Architecture

## Overview

Browser CLI is a standalone browser automation runtime with a service-oriented architecture. It exposes browser control via HTTP API and provides a CLI for local interaction.

## Core Principles

- **Service-first**: The browser runs as a persistent service that clients connect to
- **Stable contracts**: HTTP API for control, CDP for browser communication
- **LLM-friendly**: The `snapshot → refs → act` workflow is designed for AI agents
- **Multi-profile**: Support for multiple isolated browser profiles

## System Architecture

```
┌─────────────────┐     HTTP      ┌──────────────────┐     CDP      ┌─────────────┐
│   CLI Client    │ ◄────────────► │  Browser Service │ ◄───────────►│   Chrome    │
│  (browser-cli)  │                │ (browser-clid)   │              │  (CDP Port) │
└─────────────────┘                └──────────────────┘              └──────┬──────┘
       │                              │                                     │
       │                              │    ┌─────────────────┐              │
       │                              └───►│  Playwright     │◄─────────────┘
       │                                 │  (Node Worker)    │
       │                                 └─────────────────┘
       │
       │                              ┌──────────────────┐
       └─────────────────────────────►│  Chrome Extension│◄──── WebSocket
                                      │   (Relay Port)   │      (Browser)
                                      └──────────────────┘
```

## Package Structure

### `@tungthedev/browser-cli` (Published)

The CLI package users install. Contains:

- **`browser-cli`**: Main CLI for interacting with the browser service
- **`browser-clid`**: Foreground daemon entrypoint

Key modules:
- `browser-cli.ts` - CLI registration and root command setup
- `browser-clid.ts` - Daemon entrypoint
- `browser-cli-*.ts` - Command implementations organized by category:
  - `manage`: status, start, stop, tabs, profiles
  - `service`: OS service management (launchd/systemd/WinSW)
  - `extension`: Chrome extension helpers
  - `inspect`: screenshot, snapshot
  - `actions-input`: click, type, navigate, fill, wait, evaluate
  - `actions-observe`: console, pdf, responsebody
  - `debug`: highlight, errors, requests, trace
  - `state`: cookies, storage, set (viewport, offline, headers, etc.)

### `@aibrowser/browser-service` (Private)

The HTTP service that orchestrates browser automation.

Key responsibilities:
- HTTP server with auth middleware
- Browser lifecycle management (start/stop Chrome)
- CDP connection handling
- Playwright integration via Node worker bridge
- Profile management

Key modules:
- `server.ts` - Express server setup and route registration
- `chrome.ts` - Chrome executable detection and launch
- `profiles.ts` / `profiles-service.ts` - Profile CRUD operations
- `pw-ai.ts` / `pw-ai-module.ts` - Playwright integration
- `extension-relay.ts` - WebSocket relay for Chrome extension
- `routes/agent*.ts` - HTTP route handlers for browser actions

### `@aibrowser/browser-engine-playwright` (Private)

Playwright-specific browser automation primitives.

Exposes:
- Page action implementations (click, type, navigate, etc.)
- Snapshot generation (AI format, ARIA tree)
- Screenshot capture
- CDP session management

### `@aibrowser/browser-relay` (Private)

WebSocket relay for Chrome DevTools Protocol.

Used by:
- Chrome extension to expose browser to external tools
- Service to communicate with Chrome via CDP

### `@aibrowser/browser-client` (Private)

HTTP client for the browser service API.

Used by:
- CLI to make requests to the service
- Other packages needing service communication

### `@aibrowser/browser-shared` (Private)

Shared types, utilities, and constants.

### `@aibrowser/chrome-extension` (Private)

Unpacked Chrome extension for browser relay.

- Connects to browser's CDP
- Exposes WebSocket endpoint for external control
- Default relay port: 18889

## Data Flow

### Snapshot → Refs → Act Workflow

The primary workflow for browser automation:

1. **Navigate**: Client opens a URL, receives `targetId`
   ```bash
   browser-cli open https://example.com
   # Returns: { targetId: "ABC123...", url: "...", title: "..." }
   ```

2. **Snapshot**: Client captures page state with element refs
   ```bash
   browser-cli snapshot --format ai --refs aria --target-id ABC123
   # Returns: { snapshot: "- link \"Sign in\" [e5]...", imagePath: "..." }
   ```

3. **Act**: Client performs action using ref from snapshot
   ```bash
   browser-cli click e5 --target-id ABC123
   ```

### AI Snapshot Format

The AI format is optimized for LLM consumption:

```
- heading "Example Domain" [e2]
- paragraph [e3]
  - text "This domain is for use in illustrative examples..."
- link "More information..." [e5]
```

Each element gets a stable ref (e.g., `e5`) that can be used in subsequent actions.

## Browser Profiles

Profiles provide isolated browser instances with separate:
- User data directories
- CDP ports
- Running Chrome processes

### Profile Types

1. **Local (openclaw)**: Service launches and manages Chrome
2. **Remote**: Connects to existing Chrome via CDP URL
3. **Extension**: Uses Chrome extension relay instead of direct CDP

### Profile Configuration

Stored in `~/.browser-cli/profiles.json`:

```json
{
  "profiles": [
    {
      "name": "default",
      "color": "#0066CC",
      "cdpPort": 9222,
      "isDefault": true
    },
    {
      "name": "remote-chrome",
      "color": "#CC6600",
      "cdpUrl": "http://192.168.1.100:9222",
      "isRemote": true
    }
  ]
}
```

## Configuration Resolution

Configuration is resolved in priority order (highest wins):

1. CLI flags (`--base-url`, `--auth-token`, `--browser-profile`)
2. Environment variables (`BROWSER_CLI_*`)
3. Project config (`.browser-cli.json` in cwd)
4. Machine config (`~/.browser-cli/auth.json` for auth token)
5. Defaults

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `BROWSER_CLI_AUTH_TOKEN` | Bearer token for service auth |
| `BROWSER_CLI_CONTROL_PORT` | HTTP service port (default: 18888) |
| `BROWSER_CLI_RELAY_PORT` | Extension relay port (default: 18889) |

### Project Config (`.browser-cli.json`)

```json
{
  "baseUrl": "http://127.0.0.1:18888",
  "browserProfile": "default",
  "json": true,
  "authToken": "optional-token"
}
```

## Security Model

### Authentication

- All service endpoints require Bearer token auth
- Auth token resolved from flags → env → config files
- Unauthenticated requests return 401

### CDP Security

- Local profiles bind CDP to localhost only
- Remote profiles can specify external CDP URLs
- Extension relay adds authentication layer

### File System

- User data in `~/.browser-cli/`
- Media outputs in `~/.browser-cli/media/`
- Profile reset moves data to Trash (not deleted)

## Chrome Extension Relay

The Chrome extension provides an alternative control path:

```
┌──────────────┐     WebSocket     ┌─────────────────┐     CDP      ┌────────┐
│ CLI / Client │ ◄────────────────►│ Chrome Extension│◄───────────►│ Chrome │
└──────────────┘                   │  (WS Port 18889)│              └────────┘
                                   └─────────────────┘
```

Use cases:
- Controlling Chrome instances you can't launch directly
- Remote browser automation
- Bypassing certain automation detections

## Service Management

The service can run as:

1. **Foreground process**: `browser-clid run` (development)
2. **OS service**: `browser-cli service install` (production)

Supported service managers:
- macOS: `launchd`
- Linux: `systemd --user`
- Windows: WinSW wrapper

## Action Types

### Navigation
- `navigate` - Navigate to URL
- `resize` - Resize viewport
- `close` - Close tab

### Element Interaction
- `click` - Click element by ref
- `type` - Type text into element
- `press` - Press key
- `hover` - Hover over element
- `scrollIntoView` - Scroll element into view
- `drag` - Drag between elements
- `select` - Select options in dropdown

### Form Handling
- `fill` - Fill multiple form fields

### Waiting
- `wait` - Wait for selector, text, URL, load state, or JS condition

### Evaluation
- `evaluate` - Execute JS in page context

## HTTP API Endpoints

### Status
- `GET /` - Service status
- `GET /profiles` - List profiles
- `GET /tabs` - List tabs

### Browser Control
- `POST /start` - Start browser
- `POST /stop` - Stop browser
- `POST /reset-profile` - Reset profile data

### Tabs
- `POST /tabs/open` - Open new tab
- `POST /tabs/action` - Tab actions (new/select/close)
- `POST /tabs/focus` - Focus tab by targetId
- `DELETE /tabs/:targetId` - Close specific tab

### Actions
- `POST /act` - Execute browser action
- `POST /navigate` - Navigate to URL

### Inspection
- `GET /snapshot` - Capture page snapshot
- `POST /screenshot` - Capture screenshot
- `POST /pdf` - Save as PDF
- `GET /console` - Get console messages

### Debug
- `GET /errors` - Get page errors
- `GET /requests` - Get network requests
- `POST /trace/start` - Start Playwright trace
- `POST /trace/stop` - Stop Playwright trace

### State
- `GET /cookies` - Get cookies
- `POST /cookies/set` - Set cookie
- `POST /cookies/clear` - Clear cookies
- `GET /storage/:kind` - Get local/session storage
- `POST /storage/:kind/set` - Set storage key
- `POST /storage/:kind/clear` - Clear storage
- `POST /set/*` - Set viewport, offline mode, headers, etc.

## Development Notes

### Node Worker Bridge

Playwright operations run in a Node worker process to maintain compatibility with Playwright's Node.js requirements while the service runs under Bun.

### CDP Timeouts

Configurable timeouts for CDP operations to handle slow pages or network conditions.

### Profile Decoration

Profiles get a `.openclaw-profile-decorated` marker file after Chrome launches successfully the first time.

## Extension Points

### Custom Profiles

Implement custom profile drivers by extending the profile configuration schema.

### Action Kinds

New action types can be added to:
- `browser-service/src/routes/agent.act.ts` (service handler)
- `browser-engine-playwright/src/actions.ts` (implementation)
- `browser-cli/src/browser-cli-actions-input/*.ts` (CLI commands)
