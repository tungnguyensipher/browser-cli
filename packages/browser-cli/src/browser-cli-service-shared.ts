import os from "node:os";
import path from "node:path";

export type ServicePlatform = "launchd" | "systemd" | "windows";

export type ServicePaths = {
  serviceDir: string | null;
  serviceFile: string | null;
  logsDir: string;
  wrapperDir: string | null;
  wrapperConfigFile: string | null;
  wrapperExecutable: string | null;
};

export type DaemonCommand = {
  command: string;
  args: string[];
  displayCommand: string;
};

export function resolveServicePlatform(platform = process.platform): ServicePlatform {
  if (platform === "darwin") {
    return "launchd";
  }
  if (platform === "linux") {
    return "systemd";
  }
  if (platform === "win32") {
    return "windows";
  }
  throw new Error(`Unsupported service platform: ${platform}`);
}

export function resolveBrowserCliServiceName() {
  return {
    launchdLabel: "com.browsercli.browser-clid",
    systemdUnit: "browser-cli.service",
    windowsServiceName: "browser-cli",
  };
}

export function resolveServicePaths(params?: {
  platform?: ServicePlatform;
  homeDir?: string;
  localAppDataDir?: string;
}): ServicePaths {
  const platform = params?.platform ?? resolveServicePlatform();
  const homeDir = params?.homeDir ?? os.homedir();
  const localAppDataDir =
    params?.localAppDataDir ??
    process.env.LOCALAPPDATA ??
    path.join(homeDir, "AppData", "Local");
  const names = resolveBrowserCliServiceName();

  if (platform === "launchd") {
    return {
      serviceDir: path.join(homeDir, "Library", "LaunchAgents"),
      serviceFile: path.join(homeDir, "Library", "LaunchAgents", `${names.launchdLabel}.plist`),
      logsDir: path.join(homeDir, ".browser-cli", "service", "logs"),
      wrapperDir: null,
      wrapperConfigFile: null,
      wrapperExecutable: null,
    };
  }

  if (platform === "systemd") {
    return {
      serviceDir: path.join(homeDir, ".config", "systemd", "user"),
      serviceFile: path.join(homeDir, ".config", "systemd", "user", names.systemdUnit),
      logsDir: path.join(homeDir, ".local", "state", "browser-cli", "service", "logs"),
      wrapperDir: null,
      wrapperConfigFile: null,
      wrapperExecutable: null,
    };
  }

  const wrapperDir = path.win32.join(localAppDataDir, "browser-cli", "service");
  return {
    serviceDir: null,
    serviceFile: null,
    logsDir: path.win32.join(wrapperDir, "logs"),
    wrapperDir,
    wrapperConfigFile: path.win32.join(wrapperDir, "browser-cli.xml"),
    wrapperExecutable: path.win32.join(wrapperDir, "browser-cli-service.exe"),
  };
}

export function resolveDaemonCommand(params?: {
  daemonBin?: string;
  daemonEntry?: string;
  runtimeExecutable?: string;
  mode?: "bin" | "source";
}): DaemonCommand {
  if (params?.daemonBin?.trim()) {
    return {
      command: params.daemonBin.trim(),
      args: ["run"],
      displayCommand: "browser-clid run",
    };
  }

  const daemonEntry = params?.daemonEntry?.trim();
  if (!daemonEntry) {
    throw new Error("daemonEntry is required when daemonBin is not provided");
  }

  const runtimeExecutable = params?.runtimeExecutable?.trim() || process.execPath;

  return {
    command: runtimeExecutable,
    args: [daemonEntry, "run"],
    displayCommand: "browser-clid run",
  };
}
