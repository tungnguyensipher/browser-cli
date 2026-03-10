#!/usr/bin/env node

import { Command } from "commander";
import { registerBrowserCli } from "./browser-cli.js";

export function createProgram(): Command {
  const program = new Command();
  program.showHelpAfterError();
  program.showSuggestionAfterError();
  registerBrowserCli(program);
  return program;
}

export async function run(argv = process.argv): Promise<void> {
  const program = createProgram();
  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }
  await program.parseAsync(argv);
}

if (import.meta.main) {
  await run();
}
