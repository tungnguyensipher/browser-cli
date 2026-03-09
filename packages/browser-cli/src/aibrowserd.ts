import { Command } from "commander";

type BrowserServiceModule = {
  startBrowserControlServerFromConfig: () => Promise<{ port: number } | null>;
  stopBrowserControlServer: () => Promise<void>;
};

async function loadBrowserServiceModule(): Promise<BrowserServiceModule> {
  const serviceModuleUrl = new URL("../../browser-service/src/server.ts", import.meta.url).href;
  return (await import(serviceModuleUrl)) as BrowserServiceModule;
}

export async function runDaemon(): Promise<void> {
  const service = await loadBrowserServiceModule();
  const state = await service.startBrowserControlServerFromConfig();
  if (!state) {
    throw new Error("Browser control service is disabled or failed to start.");
  }

  console.log(`aibrowserd listening on http://127.0.0.1:${state.port}/`);
  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve();
    };

    const onSignal = () => {
      void service.stopBrowserControlServer()
        .catch(() => {})
        .finally(finish);
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });
}

export function createDaemonProgram(): Command {
  const program = new Command();
  program.name("aibrowserd").description("Foreground daemon for aibrowser service managers");
  program
    .command("run")
    .description("Run the browser control service in the foreground")
    .action(async () => {
      await runDaemon();
    });
  return program;
}

export async function run(argv = process.argv): Promise<void> {
  const program = createDaemonProgram();
  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }
  await program.parseAsync(argv);
}

if (import.meta.main) {
  await run();
}
