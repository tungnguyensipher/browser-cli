import { describe, expect, it } from "bun:test";
import { applyScreenshotLabelOverlayInPage } from "./pw-tools-core.interactions.js";

describe("screenshot label overlay helper", () => {
  it("serializes without Bun helper references", () => {
    expect(String(applyScreenshotLabelOverlayInPage)).not.toContain("__name");
  });
});
