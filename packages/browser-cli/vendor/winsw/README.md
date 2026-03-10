# WinSW (Windows Service Wrapper)

This directory contains WinSW executables bundled with the browser-cli package for Windows service management.

## Files

- `winsw-x64.exe` - 64-bit Intel/AMD processors
- `winsw-x86.exe` - 32-bit Intel/AMD processors
- `version.txt` - Version of bundled WinSW

Note: ARM64 support will be added when WinSW v3 (with ARM64 builds) reaches stable release.

## Source

WinSW is an open-source project by WinSW Contributors:
- Repository: https://github.com/winsw/winsw
- License: MIT (compatible with browser-cli's MIT license)
- Releases: https://github.com/winsw/winsw/releases

## Updating

To update to a new WinSW version:

1. Update `WINSW_VERSION` in `scripts/download-winsw.mjs`
2. Run `npm run download-winsw`
3. Verify the new executables work correctly

## Usage

The browser-cli service install command automatically selects the appropriate executable based on the system architecture. Users can override with `--winsw-exe` if needed:

```powershell
browser-cli service install --winsw-exe "C:\path\to\custom\winsw.exe"
```
