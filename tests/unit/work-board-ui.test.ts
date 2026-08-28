import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("work board routes", () => {
  it("exposes /board and a workbench shortcut", () => {
    const router = readFileSync(path.resolve("apps/web/src/app/router.tsx"), "utf8");
    const layout = readFileSync(path.resolve("apps/web/src/layouts/WorkbenchLayout.tsx"), "utf8");
    expect(router).toMatch(/path="\/board"/);
    expect(layout).toMatch(/to="\/board"/);
    expect(layout).toMatch(/aria-label="看板"/);
  });
});
