import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("native terminal and in-app updates", () => {
  it("renders the inspector terminal with xterm.js", () => {
    const src = readFileSync(path.resolve("apps/web/src/components/inspector/InspectorTerminal.tsx"), "utf8");
    expect(src).toContain("@xterm/xterm");
    expect(src).toContain("addon-fit");
    expect(src).toContain('aria-label", "终端"');
    expect(src).not.toContain("term-input");
  });

  it("checks for updates on launch and from the desktop menu", () => {
    const banner = readFileSync(path.resolve("apps/web/src/components/app/UpdateBanner.tsx"), "utf8");
    const bridge = readFileSync(path.resolve("apps/web/src/components/desktop/DesktopMenuBridge.tsx"), "utf8");
    const store = readFileSync(path.resolve("apps/web/src/stores/update-store.ts"), "utf8");
    expect(banner).toContain("更新并重启");
    expect(bridge).toContain("onCheckUpdate");
    expect(bridge).toContain("check()");
    expect(store).toContain("/api/update/install");
  });
});
