import type { Command } from "commander";
import { registerBrowserActionInputCommands } from "./browser-cli-actions-input.js";
import { registerBrowserActionObserveCommands } from "./browser-cli-actions-observe.js";
import { registerBrowserDebugCommands } from "./browser-cli-debug.js";
import { registerBrowserExtensionCommands } from "./browser-cli-extension.js";
import { registerBrowserInspectCommands } from "./browser-cli-inspect.js";
import { registerBrowserManageCommands } from "./browser-cli-manage.js";
import type { BrowserParentOpts } from "./browser-cli-shared.js";
import { registerBrowserStateCommands } from "./browser-cli-state.js";

export function registerBrowserCli(program: Command) {
  program
    .name("aibrowser")
    .description("Standalone browser runtime CLI")
    .option("--json", "Output machine-readable JSON", false)
    .option("--base-url <url>", "Browser service base URL")
    .option("--auth-token <token>", "Bearer token for the browser service")
    .option("--browser-profile <name>", "Browser profile name (default from config)");

  const parentOpts = (cmd: Command) => cmd.optsWithGlobals() as BrowserParentOpts;

  registerBrowserManageCommands(program, parentOpts);
  registerBrowserExtensionCommands(program, parentOpts);
  registerBrowserInspectCommands(program, parentOpts);
  registerBrowserActionInputCommands(program, parentOpts);
  registerBrowserActionObserveCommands(program, parentOpts);
  registerBrowserDebugCommands(program, parentOpts);
  registerBrowserStateCommands(program, parentOpts);
}
