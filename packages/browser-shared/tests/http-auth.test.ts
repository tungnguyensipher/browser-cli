import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "bun:test";
import { isAuthorizedBrowserRequest } from "../src/http-auth.ts";

function requestWithHeaders(
  headers: IncomingMessage["headers"],
): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe("http auth", () => {
  it("accepts matching bearer tokens", () => {
    const authorized = isAuthorizedBrowserRequest(
      requestWithHeaders({
        authorization: "Bearer gateway-token",
      }),
      { token: "gateway-token" },
    );

    expect(authorized).toBe(true);
  });

  it("accepts matching passwords from basic auth and the relay password header", () => {
    const basicAuthorized = isAuthorizedBrowserRequest(
      requestWithHeaders({
        authorization: `Basic ${Buffer.from("user:secret-password").toString("base64")}`,
      }),
      { password: "secret-password" },
    );
    const headerAuthorized = isAuthorizedBrowserRequest(
      requestWithHeaders({
        "x-openclaw-password": "secret-password",
      }),
      { password: "secret-password" },
    );

    expect(basicAuthorized).toBe(true);
    expect(headerAuthorized).toBe(true);
  });

  it("rejects incorrect credentials", () => {
    const authorized = isAuthorizedBrowserRequest(
      requestWithHeaders({
        authorization: "Bearer wrong-token",
      }),
      { token: "gateway-token", password: "secret-password" },
    );

    expect(authorized).toBe(false);
  });
});
