export {
  RELAY_AUTH_HEADER,
  deriveRelayAuthToken,
  getChromeExtensionRelayAuthHeaders,
  isAuthorizedBrowserRequest,
  registerChromeExtensionRelayAuthHeaderResolver,
  resolveBrowserControlAuth,
  resolveRelayAcceptedTokensForPort,
  resolveRelayAuthTokenForPort,
  type BrowserControlAuth,
} from "@aibrowser/browser-shared";
