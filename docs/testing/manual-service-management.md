# Manual Service Management

This guide covers the new `browser-cli service ...` commands and the dedicated foreground daemon entrypoint `browser-clid`.

## Foreground daemon

Run the service manually in the foreground with:

```bash
BROWSER_CLI_AUTH_TOKEN=private-token \
BROWSER_CLI_CONTROL_PORT=18888 \
bun run packages/browser-cli/src/browser-clid.ts run
```

Expected:

- The daemon prints `browser-clid listening on http://127.0.0.1:18888/`.
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

- `BROWSER_CLI_*`

Run `install` from the directory you want the service to use as its working directory.

## macOS launchd

Install:

```bash
BROWSER_CLI_AUTH_TOKEN=private-token \
BROWSER_CLI_CONTROL_PORT=18888 \
bun run packages/browser-cli/src/index.ts service install
```

Generated files:

- `~/Library/LaunchAgents/com.browsercli.browser-clid.plist`
- `~/.browser-cli/service/logs/`

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
BROWSER_CLI_AUTH_TOKEN=private-token \
BROWSER_CLI_CONTROL_PORT=18888 \
bun run packages/browser-cli/src/index.ts service install
```

Generated files:

- `~/.config/systemd/user/browser-cli.service`
- `~/.local/state/browser-cli/service/logs/`

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
- Install enables and starts the unit with `systemctl --user enable --now browser-cli.service`

## Windows with WinSW wrapper

Windows service support uses a WinSW wrapper executable. Provide the wrapper path during install:

```powershell
$env:BROWSER_CLI_AUTH_TOKEN="private-token"
$env:BROWSER_CLI_CONTROL_PORT="18888"
bun run packages/browser-cli/src/index.ts service install --winsw-exe "D:\tools\winsw.exe"
```

Generated files:

- `%LOCALAPPDATA%\browser-cli\service\browser-cli-service.exe`
- `%LOCALAPPDATA%\browser-cli\service\browser-cli.xml`
- `%LOCALAPPDATA%\browser-cli\service\logs\`

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
- The wrapper then manages `browser-clid` as a Windows service.
- This avoids needing a custom native Windows service host in this repo.
