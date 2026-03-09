function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeSystemd(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function renderLaunchdPlist(params: {
  label: string;
  command: string;
  args: string[];
  workingDirectory: string;
  env?: Record<string, string>;
  stdoutPath: string;
  stderrPath: string;
}): string {
  const programArgs = [params.command, ...params.args]
    .map((value) => `    <string>${escapeXml(value)}</string>`)
    .join("\n");
  const env = Object.entries(params.env ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) =>
        `      <key>${escapeXml(key)}</key>\n      <string>${escapeXml(value)}</string>`,
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
    "  <key>Label</key>",
    `  <string>${escapeXml(params.label)}</string>`,
    "  <key>ProgramArguments</key>",
    "  <array>",
    programArgs,
    "  </array>",
    "  <key>WorkingDirectory</key>",
    `  <string>${escapeXml(params.workingDirectory)}</string>`,
    "  <key>RunAtLoad</key>",
    "  <true/>",
    "  <key>KeepAlive</key>",
    "  <true/>",
    ...(env
      ? [
          "  <key>EnvironmentVariables</key>",
          "  <dict>",
          env,
          "  </dict>",
        ]
      : []),
    "  <key>StandardOutPath</key>",
    `  <string>${escapeXml(params.stdoutPath)}</string>`,
    "  <key>StandardErrorPath</key>",
    `  <string>${escapeXml(params.stderrPath)}</string>`,
    "</dict>",
    "</plist>",
    "",
  ].join("\n");
}

export function renderSystemdUnit(params: {
  description: string;
  command: string;
  args: string[];
  workingDirectory: string;
  env?: Record<string, string>;
}): string {
  const envLines = Object.entries(params.env ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `Environment="${escapeSystemd(key)}=${escapeSystemd(value)}"`);

  return [
    "[Unit]",
    `Description=${params.description}`,
    "",
    "[Service]",
    "Type=simple",
    `WorkingDirectory=${params.workingDirectory}`,
    `ExecStart=${[params.command, ...params.args].join(" ")}`,
    ...envLines,
    "Restart=on-failure",
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

export function renderWinSwXml(params: {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  workingDirectory: string;
  env?: Record<string, string>;
  logsDir: string;
}): string {
  const env = Object.entries(params.env ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) => `  <env name="${escapeXml(key)}" value="${escapeXml(value)}" />`,
    )
    .join("\n");

  return [
    "<service>",
    `  <id>${escapeXml(params.id)}</id>`,
    `  <name>${escapeXml(params.name)}</name>`,
    `  <description>${escapeXml(params.description)}</description>`,
    `  <executable>${escapeXml(params.command)}</executable>`,
    `  <arguments>${escapeXml(params.args.join(" "))}</arguments>`,
    `  <workingdirectory>${escapeXml(params.workingDirectory)}</workingdirectory>`,
    ...(env ? [env] : []),
    `  <logpath>${escapeXml(params.logsDir)}</logpath>`,
    "  <log mode=\"roll\" />",
    "</service>",
    "",
  ].join("\n");
}
