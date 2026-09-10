import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readTheme, toggleTheme } from "../../apps/web/src/lib/theme.ts";
import { termTheme } from "../../apps/web/src/lib/term-theme.ts";

describe("theme", () => {
  it("defaults to light when storage and system preference are unavailable", () => {
    expect(readTheme()).toBe("light");
  });

  it("toggles between dark and light", () => {
    expect(toggleTheme("dark")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
  });

  it("gives the terminal a light palette and a dark palette", () => {
    expect(termTheme("light").background).toBe("#f3f3f6");
    expect(termTheme("dark").background).toBe("#2c2c31");
    expect(termTheme("light").foreground).not.toBe(termTheme("dark").foreground);
    const term = readFileSync(path.resolve("apps/web/src/components/inspector/InspectorTerminal.tsx"), "utf8");
    const styles = readFileSync(path.resolve("apps/web/src/styles/app.css"), "utf8");
    expect(term).toContain("useTheme");
    expect(term).toContain("termTheme(theme)");
    expect(styles).toMatch(/\.term-shell[\s\S]*var\(--color-canvas\)/);
    expect(styles).not.toMatch(/always-dark terminal/);
  });
});

