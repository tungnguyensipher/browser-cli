import { describe, expect, it } from "bun:test";

describe("browser auth commands", () => {
  it("regenerates a token and preserves other auth fields", async () => {
    const { createBrowserAuthController } = await import("./browser-cli-auth.js");
    const writes: Array<Record<string, string>> = [];
    const controller = createBrowserAuthController({
      readAuth: () => ({ token: "old-token", password: "saved-password" }),
      writeAuth: (auth) => {
        writes.push(auth);
      },
      generateSecret: () => "new-secret",
      resolveAuthPath: () => "/Users/tester/.browser-cli/auth.json",
      copyToClipboard: async () => {},
    });

    const result = await controller.regenerate();

    expect(result).toEqual({
      authPath: "/Users/tester/.browser-cli/auth.json",
      token: "new-secret",
    });
    expect(writes).toEqual([{ token: "new-secret", password: "saved-password" }]);
  });

  it("sets the provided token and preserves other auth fields", async () => {
    const { createBrowserAuthController } = await import("./browser-cli-auth.js");
    const writes: Array<Record<string, string>> = [];
    const controller = createBrowserAuthController({
      readAuth: () => ({ password: "saved-password" }),
      writeAuth: (auth) => {
        writes.push(auth);
      },
      generateSecret: () => "unused-secret",
      resolveAuthPath: () => "/Users/tester/.browser-cli/auth.json",
      copyToClipboard: async () => {},
    });

    const result = await controller.set("chosen-secret");

    expect(result).toEqual({
      authPath: "/Users/tester/.browser-cli/auth.json",
      token: "chosen-secret",
    });
    expect(writes).toEqual([{ token: "chosen-secret", password: "saved-password" }]);
  });

  it("copies the current token to the clipboard", async () => {
    const { createBrowserAuthController } = await import("./browser-cli-auth.js");
    const copies: string[] = [];
    const controller = createBrowserAuthController({
      readAuth: () => ({ token: "current-secret" }),
      writeAuth: () => {},
      generateSecret: () => "unused-secret",
      resolveAuthPath: () => "/Users/tester/.browser-cli/auth.json",
      copyToClipboard: async (value) => {
        copies.push(value);
      },
    });

    const result = await controller.copy();

    expect(result).toEqual({
      authPath: "/Users/tester/.browser-cli/auth.json",
      token: "current-secret",
    });
    expect(copies).toEqual(["current-secret"]);
  });
});
