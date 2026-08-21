import { describe, expect, it } from "vitest";
import { readTheme, toggleTheme } from "../../apps/web/src/lib/theme.ts";

describe("theme", () => {
  it("defaults to dark when storage is unavailable", () => {
    expect(readTheme()).toBe("dark");
  });

  it("toggles between dark and light", () => {
    expect(toggleTheme("dark")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
  });
});
