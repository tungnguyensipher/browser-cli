import { describe, expect, it } from "bun:test";

describe("browser service renderers", () => {
  it("renders a launchd plist with label, arguments, env, and log paths", async () => {
    const { renderLaunchdPlist } = await import("./browser-cli-service-render.js");

    const plist = renderLaunchdPlist({
      label: "com.aibrowser.aibrowserd",
      command: "/opt/homebrew/bin/bun",
      args: ["run", "/repo/packages/browser-cli/src/aibrowserd.ts", "run"],
      workingDirectory: "/repo",
      env: {
        AIBROWSER_AUTH_TOKEN: "smoke-token",
        AIBROWSER_CONTROL_PORT: "18888",
      },
      stdoutPath: "/Users/tester/.aibrowser/service/logs/stdout.log",
      stderrPath: "/Users/tester/.aibrowser/service/logs/stderr.log",
    });

    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("<string>com.aibrowser.aibrowserd</string>");
    expect(plist).toContain("<key>ProgramArguments</key>");
    expect(plist).toContain("<string>/opt/homebrew/bin/bun</string>");
    expect(plist).toContain("<string>run</string>");
    expect(plist).toContain("<key>WorkingDirectory</key>");
    expect(plist).toContain("<string>/repo</string>");
    expect(plist).toContain("<key>EnvironmentVariables</key>");
    expect(plist).toContain("<key>AIBROWSER_CONTROL_PORT</key>");
    expect(plist).toContain("/Users/tester/.aibrowser/service/logs/stdout.log");
  });

  it("renders a systemd user unit with exec start, env, and working directory", async () => {
    const { renderSystemdUnit } = await import("./browser-cli-service-render.js");

    const unit = renderSystemdUnit({
      description: "AIBrowser Service",
      command: "/opt/homebrew/bin/bun",
      args: ["run", "/repo/packages/browser-cli/src/aibrowserd.ts", "run"],
      workingDirectory: "/repo",
      env: {
        AIBROWSER_AUTH_TOKEN: "smoke-token",
        AIBROWSER_CONTROL_PORT: "18888",
      },
    });

    expect(unit).toContain("[Unit]");
    expect(unit).toContain("Description=AIBrowser Service");
    expect(unit).toContain("[Service]");
    expect(unit).toContain("Type=simple");
    expect(unit).toContain("WorkingDirectory=/repo");
    expect(unit).toContain(
      'ExecStart=/opt/homebrew/bin/bun run /repo/packages/browser-cli/src/aibrowserd.ts run',
    );
    expect(unit).toContain('Environment="AIBROWSER_AUTH_TOKEN=smoke-token"');
    expect(unit).toContain("[Install]");
    expect(unit).toContain("WantedBy=default.target");
  });

  it("renders a WinSW XML wrapper config with executable, arguments, env, and logs", async () => {
    const { renderWinSwXml } = await import("./browser-cli-service-render.js");

    const xml = renderWinSwXml({
      id: "aibrowser",
      name: "AIBrowser",
      description: "AIBrowser background service",
      command: "C:\\Program Files\\Bun\\bun.exe",
      args: ["run", "C:\\repo\\packages\\browser-cli\\src\\aibrowserd.ts", "run"],
      workingDirectory: "C:\\repo",
      env: {
        AIBROWSER_AUTH_TOKEN: "smoke-token",
        AIBROWSER_CONTROL_PORT: "18888",
      },
      logsDir: "C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\logs",
    });

    expect(xml).toContain("<service>");
    expect(xml).toContain("<id>aibrowser</id>");
    expect(xml).toContain("<name>AIBrowser</name>");
    expect(xml).toContain("<description>AIBrowser background service</description>");
    expect(xml).toContain("<executable>C:\\Program Files\\Bun\\bun.exe</executable>");
    expect(xml).toContain(
      "<arguments>run C:\\repo\\packages\\browser-cli\\src\\aibrowserd.ts run</arguments>",
    );
    expect(xml).toContain('<env name="AIBROWSER_CONTROL_PORT" value="18888" />');
    expect(xml).toContain("<logpath>C:\\Users\\tester\\AppData\\Local\\aibrowser\\service\\logs</logpath>");
  });
});
