# Manual Service Management

This guide covers the new `aibrowser service ...` commands and the dedicated foreground daemon entrypoint `aibrowserd`.

## Foreground daemon

Run the service manually in the foreground with:

```bash
AIBROWSER_AUTH_TOKEN=smoke-token \
AIBROWSER_CONTROL_PORT=18888 \
bun run packages/browser-cli/src/aibrowserd.ts run
```

Expected:

- The daemon prints `aibrowserd listening on http://127.0.0.1:18888/`.
- `Ctrl+C` stops the browser control server cleanly.

## Service command family

```bash
bun run packages/browser-cli/src/index.ts service --help
```

Available commands:

- `install`
- `uninstall`
- `start`
- `stop`
- `restart`
- `status`

## Managed environment

The service installer captures the current environment for:

- `AIBROWSER_*`
- `OPENCLAW_GATEWAY_TOKEN`
- `CLAWDBOT_GATEWAY_TOKEN`

Run `install` from the directory you want the service to use as its working directory.

## macOS launchd

Install:

```bash
AIBROWSER_AUTH_TOKEN=smoke-token \
AIBROWSER_CONTROL_PORT=18888 \
bun run packages/browser-cli/src/index.ts service install
```

Generated files:

- `~/Library/LaunchAgents/com.aibrowser.aibrowserd.plist`
- `~/.aibrowser/service/logs/`

Lifecycle:

```bash
bun run packages/browser-cli/src/index.ts service status
bun run packages/browser-cli/src/index.ts service start
bun run packages/browser-cli/src/index.ts service stop
bun run packages/browser-cli/src/index.ts service restart
bun run packages/browser-cli/src/index.ts service uninstall
```

Notes:

- Install uses `launchctl bootstrap gui/<uid> ...`
- Start uses `launchctl start`
- Stop uses `launchctl stop`
- Restart uses `launchctl kickstart -k`
- Uninstall uses `launchctl bootout`

## Linux systemd user service

Install:

```bash
AIBROWSER_AUTH_TOKEN=smoke-token \
AIBROWSER_CONTROL_PORT=18888 \
bun run packages/browser-cli/src/index.ts service install
```

Generated files:

- `~/.config/systemd/user/aibrowser.service`
- `~/.local/state/aibrowser/service/logs/`

Lifecycle:

```bash
bun run packages/browser-cli/src/index.ts service status
bun run packages/browser-cli/src/index.ts service start
bun run packages/browser-cli/src/index.ts service stop
bun run packages/browser-cli/src/index.ts service restart
bun run packages/browser-cli/src/index.ts service uninstall
```

Notes:

- Install runs `systemctl --user daemon-reload`
- Install enables and starts the unit with `systemctl --user enable --now aibrowser.service`

## Windows with WinSW wrapper

Windows service support uses a WinSW wrapper executable. Provide the wrapper path during install:

```powershell
$env:AIBROWSER_AUTH_TOKEN="smoke-token"
$env:AIBROWSER_CONTROL_PORT="18888"
bun run packages/browser-cli/src/index.ts service install --winsw-exe "D:\tools\winsw.exe"
```

Generated files:

- `%LOCALAPPDATA%\aibrowser\service\aibrowser-service.exe`
- `%LOCALAPPDATA%\aibrowser\service\aibrowser.xml`
- `%LOCALAPPDATA%\aibrowser\service\logs\`

Lifecycle:

```powershell
bun run packages/browser-cli/src/index.ts service status
bun run packages/browser-cli/src/index.ts service start
bun run packages/browser-cli/src/index.ts service stop
bun run packages/browser-cli/src/index.ts service restart
bun run packages/browser-cli/src/index.ts service uninstall
```

Notes:

- Install copies the provided WinSW executable into the managed service directory.
- The wrapper then manages `aibrowserd` as a Windows service.
- This avoids needing a custom native Windows service host in this repo.
