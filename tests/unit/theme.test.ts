import { describe, expect, it } from "vitest";
import { readTheme, toggleTheme } from "../../apps/web/src/lib/theme.ts";

describe("theme", () => {
  it("defaults to light when storage and system preference are unavailable", () => {
    expect(readTheme()).toBe("light");
  });

  it("toggles between dark and light", () => {
    expect(toggleTheme("dark")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
  });
});
