import { describe, expect, it } from "vitest";
import { readUiFlag } from "../../apps/web/src/lib/ui-prefs.ts";

describe("ui prefs", () => {
  it("falls back when localStorage is missing", () => {
    expect(readUiFlag("qingzhou.ui.leftPinned", true)).toBe(true);
    expect(readUiFlag("qingzhou.ui.rightPinned", false)).toBe(false);
  });
});
