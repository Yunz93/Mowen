import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportFileUrl } from "../../apps/web/src/lib/open-export.ts";

describe("desktop setup menu and export open", () => {
  it("preload exposes openPath and onOpenSetup", () => {
    const src = readFileSync(path.resolve("apps/desktop/src/preload/index.ts"), "utf8");
    expect(src).toMatch(/mowen:open-path/);
    expect(src).toMatch(/mowen:open-setup/);
    expect(src).toMatch(/mowen:notify/);
    expect(src).toMatch(/mowen:check-update/);
  });

  it("main process opens html paths and forwards the setup menu", () => {
    const src = readFileSync(path.resolve("apps/desktop/src/main/index.ts"), "utf8");
    expect(src).toMatch(/mowen:open-path/);
    expect(src).toMatch(/mowen:open-setup/);
    expect(src).toMatch(/再次打开设置/);
    expect(src).toMatch(/检查更新/);
    expect(src).toMatch(/mowen:notify/);
    expect(src).not.toMatch(/extname\(filePath\)\.toLowerCase\(\) !== "\.html"/);
  });

  it("encodes export file URLs", () => {
    expect(exportFileUrl("/tmp/a b.html")).toBe(`/api/exports?path=${encodeURIComponent("/tmp/a b.html")}`);
  });
});
