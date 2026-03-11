import type { Command } from "commander";
import { danger } from "../globals.js";
import { defaultRuntime } from "../runtime.js";
import { callBrowserRequest, type BrowserParentOpts } from "../browser-cli-shared.js";
import { resolveBrowserActionContext } from "./shared.js";

const FIND_ACTIONS = new Set(["click", "fill", "type", "hover", "check", "uncheck", "text"]);

type FindAction = "click" | "fill" | "type" | "hover" | "check" | "uncheck" | "text";
type FindBy = "role" | "text" | "label";

function requireFindAction(action: string): FindAction {
  const normalized = String(action ?? "").trim();
  if (!FIND_ACTIONS.has(normalized)) {
    throw new Error("action must be click|fill|type|hover|check|uncheck|text");
  }
  return normalized as FindAction;
}

function requireFindInput(action: FindAction, value?: string): string | undefined {
  if (action !== "fill" && action !== "type") {
    return undefined;
  }
  const input = typeof value === "string" ? value : "";
  if (!input.length) {
    throw new Error("value is required for fill and type");
  }
  return input;
}

async function runFind(params: {
  cmd: Command;
  parentOpts: (cmd: Command) => BrowserParentOpts;
  by: FindBy;
  value: string;
  action: string;
  input?: string;
  name?: string;
  targetId?: string;
}) {
  const { parent, profile } = resolveBrowserActionContext(params.cmd, params.parentOpts);
  const findAction = requireFindAction(params.action);
  const input = requireFindInput(findAction, params.input);
  const body = {
    by: params.by,
    value: params.value,
    action: findAction,
    input,
    name: params.name,
    targetId: params.targetId,
  };
  const result = await callBrowserRequest<{ text?: string | null }>(
    parent,
    {
      method: "POST",
      path: "/find",
      query: profile ? { profile } : undefined,
      body,
    },
    { timeoutMs: 20000 },
  );

  if (parent?.json) {
    defaultRuntime.log(JSON.stringify(result, null, 2));
    return;
  }
  if (findAction === "text") {
    defaultRuntime.log(result.text ?? "");
    return;
  }
  defaultRuntime.log(`${params.by} ${findAction} ok`);
}

export function registerBrowserFindCommands(
  browser: Command,
  parentOpts: (cmd: Command) => BrowserParentOpts,
) {
  const find = browser.command("find").description("Find an element semantically and act on it");

  find
    .command("role")
    .description("Find by ARIA role")
    .argument("<role>", "ARIA role to match")
    .argument("<action>", "Action: click|fill|type|hover|check|uncheck|text")
    .argument("[value]", "Input value for fill/type")
    .option("--name <text>", "Accessible name for the role match")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (role: string, action: string, value: string | undefined, opts, cmd) => {
      try {
        await runFind({
          cmd,
          parentOpts,
          by: "role",
          value: role,
          action,
          input: value,
          name: opts.name?.trim() || undefined,
          targetId: opts.targetId?.trim() || undefined,
        });
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  find
    .command("text")
    .description("Find by visible text")
    .argument("<text>", "Visible text to match")
    .argument("<action>", "Action: click|fill|type|hover|check|uncheck|text")
    .argument("[value]", "Input value for fill/type")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (text: string, action: string, value: string | undefined, opts, cmd) => {
      try {
        await runFind({
          cmd,
          parentOpts,
          by: "text",
          value: text,
          action,
          input: value,
          targetId: opts.targetId?.trim() || undefined,
        });
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  find
    .command("label")
    .description("Find by form label")
    .argument("<label>", "Label text to match")
    .argument("<action>", "Action: click|fill|type|hover|check|uncheck|text")
    .argument("[value]", "Input value for fill/type")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (label: string, action: string, value: string | undefined, opts, cmd) => {
      try {
        await runFind({
          cmd,
          parentOpts,
          by: "label",
          value: label,
          action,
          input: value,
          targetId: opts.targetId?.trim() || undefined,
        });
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });
}
