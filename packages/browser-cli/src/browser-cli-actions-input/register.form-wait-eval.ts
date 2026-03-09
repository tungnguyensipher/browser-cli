import type { Command } from "commander";
import { danger } from "../globals.js";
import { defaultRuntime } from "../runtime.js";
import type { BrowserParentOpts } from "../browser-cli-shared.js";
import {
  callBrowserAct,
  logBrowserActionResult,
  readFields,
  resolveBrowserActionContext,
} from "./shared.js";

export function registerBrowserFormWaitEvalCommands(
  browser: Command,
  parentOpts: (cmd: Command) => BrowserParentOpts,
) {
  browser
    .command("fill")
    .description("Fill a form with JSON field descriptors")
    .option("--fields <json>", "JSON array of field objects")
    .option("--fields-file <path>", "Read JSON array from a file")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (opts, cmd) => {
      const { parent, profile } = resolveBrowserActionContext(cmd, parentOpts);
      try {
        const fields = await readFields({
          fields: opts.fields,
          fieldsFile: opts.fieldsFile,
        });
        const result = await callBrowserAct<{ result?: unknown }>({
          parent,
          profile,
          body: {
            kind: "fill",
            fields,
            targetId: opts.targetId?.trim() || undefined,
          },
        });
        logBrowserActionResult(parent, result, `filled ${fields.length} field(s)`);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("wait")
    .description("Wait for time, selector, URL, load state, or JS conditions")
    .argument("[selector]", "CSS selector to wait for (visible)")
    .option("--time-ms <ms>", "Wait for N milliseconds", (v: string) => Number(v))
    .option("--text <value>", "Wait for text to appear")
    .option("--text-gone <value>", "Wait for text to disappear")
    .option("--url <pattern>", "Wait for URL (supports globs like **/dash)")
    .option("--load-state <load|domcontentloaded|networkidle>", "Wait for load state")
    .option("--fn <js>", "Wait for JS condition (passed to waitForFunction)")
    .option(
      "--timeout-ms <ms>",
      "How long to wait for each condition (default: 20000)",
      (v: string) => Number(v),
    )
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .action(async (selector: string | undefined, opts, cmd) => {
        const { parent, profile } = resolveBrowserActionContext(cmd, parentOpts);
        try {
          const sel = selector?.trim() || undefined;
          const load =
          opts.loadState === "load" ||
          opts.loadState === "domcontentloaded" ||
          opts.loadState === "networkidle"
            ? (opts.loadState as "load" | "domcontentloaded" | "networkidle")
            : undefined;
        const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : undefined;
        const result = await callBrowserAct<{ result?: unknown }>({
          parent,
          profile,
          body: {
            kind: "wait",
            timeMs: Number.isFinite(opts.timeMs) ? opts.timeMs : undefined,
            text: opts.text?.trim() || undefined,
            textGone: opts.textGone?.trim() || undefined,
            selector: sel,
            url: opts.url?.trim() || undefined,
            loadState: load,
            fn: opts.fn?.trim() || undefined,
            targetId: opts.targetId?.trim() || undefined,
            timeoutMs,
          },
          timeoutMs,
        });
        logBrowserActionResult(parent, result, "wait complete");
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("evaluate")
    .description("Evaluate a function against the page or a ref")
    .option("--fn <code>", "Function source, e.g. (el) => el.textContent")
    .option("--ref <id>", "Ref from snapshot")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .option("--timeout-ms <ms>", "How long to wait for evaluation", (v: string) => Number(v))
    .action(async (opts, cmd) => {
      const { parent, profile } = resolveBrowserActionContext(cmd, parentOpts);
      if (!opts.fn) {
        defaultRuntime.error(danger("Missing --fn"));
        defaultRuntime.exit(1);
        return;
      }
      try {
        const result = await callBrowserAct<{ result?: unknown }>({
          parent,
          profile,
          body: {
            kind: "evaluate",
            fn: opts.fn,
            ref: opts.ref?.trim() || undefined,
            targetId: opts.targetId?.trim() || undefined,
            timeoutMs: Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : undefined,
          },
          timeoutMs: Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : undefined,
        });
        if (parent?.json) {
          defaultRuntime.log(JSON.stringify(result, null, 2));
          return;
        }
        defaultRuntime.log(JSON.stringify(result.result ?? null, null, 2));
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  browser
    .command("act")
    .description("Send a raw browser action request")
    .requiredOption("--kind <kind>", "Action kind")
    .option("--ref <id>", "Ref from snapshot")
    .option("--text <value>", "Text payload")
    .option("--key <value>", "Key to press")
    .option("--target-id <id>", "CDP target id (or unique prefix)")
    .option("--timeout-ms <ms>", "Action timeout", (v: string) => Number(v))
    .option("--double", "Double click", false)
    .option("--button <left|right|middle>", "Mouse button to use")
    .option("--submit", "Submit after typing", false)
    .option("--slowly", "Type slowly", false)
    .option("--delay-ms <ms>", "Delay between keydown/keyup", (v: string) => Number(v))
    .option("--start-ref <id>", "Drag start ref")
    .option("--end-ref <id>", "Drag end ref")
    .option("--value <value...>", "Select value(s)")
    .option("--fields <json>", "JSON array of fields")
    .option("--fields-file <path>", "Read JSON array of fields from a file")
    .option("--time-ms <ms>", "Wait time in milliseconds", (v: string) => Number(v))
    .option("--text-gone <value>", "Wait for text to disappear")
    .option("--selector <css>", "CSS selector")
    .option("--url <pattern>", "URL or URL pattern")
    .option("--load-state <load|domcontentloaded|networkidle>", "Load state to wait for")
    .option("--fn <js>", "JavaScript function source")
    .option("--width <px>", "Viewport width", (v: string) => Number(v))
    .option("--height <px>", "Viewport height", (v: string) => Number(v))
    .action(async (opts, cmd) => {
      const { parent, profile } = resolveBrowserActionContext(cmd, parentOpts);
      const requestedKind = String(opts.kind ?? "").trim();
      const kind = requestedKind === "scroll-into-view" ? "scrollIntoView" : requestedKind;
      const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : undefined;
      try {
        const body: Record<string, unknown> = {
          kind,
          targetId: opts.targetId?.trim() || undefined,
        };

        switch (kind) {
          case "click":
            body.ref = opts.ref?.trim() || undefined;
            body.doubleClick = Boolean(opts.double);
            body.button = opts.button?.trim() || undefined;
            break;
          case "type":
            body.ref = opts.ref?.trim() || undefined;
            body.text = opts.text ?? "";
            body.submit = Boolean(opts.submit);
            body.slowly = Boolean(opts.slowly);
            break;
          case "press":
            body.key = opts.key ?? "";
            body.delayMs = Number.isFinite(opts.delayMs) ? opts.delayMs : undefined;
            break;
          case "hover":
          case "scrollIntoView":
            body.ref = opts.ref?.trim() || undefined;
            body.timeoutMs = timeoutMs;
            if (kind === "scrollIntoView") {
              body.kind = "scrollIntoView";
            }
            break;
          case "drag":
            body.startRef = opts.startRef?.trim() || undefined;
            body.endRef = opts.endRef?.trim() || undefined;
            body.timeoutMs = timeoutMs;
            break;
          case "select":
            body.ref = opts.ref?.trim() || undefined;
            body.values = Array.isArray(opts.value) ? opts.value : [];
            body.timeoutMs = timeoutMs;
            break;
          case "fill":
            body.fields = await readFields({
              fields: opts.fields,
              fieldsFile: opts.fieldsFile,
            });
            body.timeoutMs = timeoutMs;
            break;
          case "resize":
            body.width = Number.isFinite(opts.width) ? opts.width : undefined;
            body.height = Number.isFinite(opts.height) ? opts.height : undefined;
            break;
          case "wait":
            body.timeMs = Number.isFinite(opts.timeMs) ? opts.timeMs : undefined;
            body.text = opts.text?.trim() || undefined;
            body.textGone = opts.textGone?.trim() || undefined;
            body.selector = opts.selector?.trim() || undefined;
            body.url = opts.url?.trim() || undefined;
            body.loadState =
              opts.loadState === "load" ||
              opts.loadState === "domcontentloaded" ||
              opts.loadState === "networkidle"
                ? opts.loadState
                : undefined;
            body.fn = opts.fn?.trim() || undefined;
            body.timeoutMs = timeoutMs;
            break;
          case "evaluate":
            body.fn = opts.fn?.trim() || undefined;
            body.ref = opts.ref?.trim() || undefined;
            body.timeoutMs = timeoutMs;
            break;
          case "close":
            break;
          default:
            throw new Error(`Unsupported act kind: ${kind}`);
        }

        const result = await callBrowserAct({
          parent,
          profile,
          body,
          timeoutMs,
        });
        logBrowserActionResult(parent, result, `action complete: ${kind}`);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });
}
