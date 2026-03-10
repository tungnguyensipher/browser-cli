# AIBrowser Chrome Extension

Purpose: attach AIBrowser to an existing Chrome tab so the local relay can automate it through Chrome DevTools Protocol.

## Dev / load unpacked

1. Start the AIBrowser local relay or browser service on this machine.
2. Ensure the relay server is reachable at `http://127.0.0.1:18889/` (default).
3. Install the extension to a stable path:

   ```bash
   aibrowser extension install
   aibrowser extension path
   ```

4. Chrome → `chrome://extensions` → enable “Developer mode”.
5. “Load unpacked” → select the path printed above.
6. Pin the extension. Click the icon on a tab to attach/detach.

## Options

- `Relay port`: defaults to `18889`.
- `Relay token`: required. Usually this should match `AIBROWSER_AUTH_TOKEN`.
  Compatibility env vars `OPENCLAW_GATEWAY_TOKEN` and `CLAWDBOT_GATEWAY_TOKEN` also work.
