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

export function resolveAibrowserServiceName() {
  return {
    launchdLabel: "com.aibrowser.aibrowserd",
    systemdUnit: "aibrowser.service",
    windowsServiceName: "aibrowser",
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
  const names = resolveAibrowserServiceName();

  if (platform === "launchd") {
    return {
      serviceDir: path.join(homeDir, "Library", "LaunchAgents"),
      serviceFile: path.join(homeDir, "Library", "LaunchAgents", `${names.launchdLabel}.plist`),
      logsDir: path.join(homeDir, ".aibrowser", "service", "logs"),
      wrapperDir: null,
      wrapperConfigFile: null,
      wrapperExecutable: null,
    };
  }

  if (platform === "systemd") {
    return {
      serviceDir: path.join(homeDir, ".config", "systemd", "user"),
      serviceFile: path.join(homeDir, ".config", "systemd", "user", names.systemdUnit),
      logsDir: path.join(homeDir, ".local", "state", "aibrowser", "service", "logs"),
      wrapperDir: null,
      wrapperConfigFile: null,
      wrapperExecutable: null,
    };
  }

  const wrapperDir = path.win32.join(localAppDataDir, "aibrowser", "service");
  return {
    serviceDir: null,
    serviceFile: null,
    logsDir: path.win32.join(wrapperDir, "logs"),
    wrapperDir,
    wrapperConfigFile: path.win32.join(wrapperDir, "aibrowser.xml"),
    wrapperExecutable: path.win32.join(wrapperDir, "aibrowser-service.exe"),
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
      displayCommand: "aibrowserd run",
    };
  }

  const daemonEntry = params?.daemonEntry?.trim();
  if (!daemonEntry) {
    throw new Error("daemonEntry is required when daemonBin is not provided");
  }

  return {
    command: params?.runtimeExecutable?.trim() || process.execPath,
    args: ["run", daemonEntry, "run"],
    displayCommand: "aibrowserd run",
  };
}
