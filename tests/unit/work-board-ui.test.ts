import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("work board routes", () => {
  it("exposes /board and a workbench shortcut", () => {
    const router = readFileSync(path.resolve("apps/web/src/app/router.tsx"), "utf8");
    const layout = readFileSync(path.resolve("apps/web/src/layouts/WorkbenchLayout.tsx"), "utf8");
    expect(router).toMatch(/path="\/board"/);
    expect(layout).toMatch(/to="\/board"/);
    expect(layout).toMatch(/>\s*看板\s*</);
    expect(layout).toMatch(/看板 · /);
    const board = readFileSync(path.resolve("apps/web/src/pages/BoardPage.tsx"), "utf8");
    expect(board).toMatch(/显示归档/);
    const confirm = readFileSync(
      path.resolve("apps/web/src/components/board/ConfirmStartWorkItemDialog.tsx"),
      "utf8",
    );
    expect(confirm).toMatch(/开始执行/);
    const cards = readFileSync(path.resolve("apps/web/src/components/board/WorkBoard.tsx"), "utf8");
    expect(cards).toMatch(/打开对话/);
    expect(cards).toMatch(/等待你确认 · 去处理/);
  });
});
