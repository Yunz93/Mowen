import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("work board routes", () => {
  it("exposes /board as 工作 mode with a workbench shortcut", () => {
    const router = readFileSync(path.resolve("apps/web/src/app/router.tsx"), "utf8");
    const layout = readFileSync(path.resolve("apps/web/src/layouts/WorkbenchLayout.tsx"), "utf8");
    const mode = readFileSync(path.resolve("apps/web/src/components/app/ModeSwitcher.tsx"), "utf8");
    expect(router).toMatch(/path="\/board"/);
    expect(layout).toMatch(/ModeSwitcher/);
    expect(layout).toMatch(/工作 · /);
    expect(mode).toMatch(/对话/);
    expect(mode).toMatch(/工作/);
    const board = readFileSync(path.resolve("apps/web/src/pages/BoardPage.tsx"), "utf8");
    expect(board).toMatch(/启动项目/);
    expect(board).toMatch(/新建任务/);
    expect(board).toMatch(/显示归档/);
    const confirm = readFileSync(path.resolve("apps/web/src/components/board/ConfirmWorkDialog.tsx"), "utf8");
    expect(confirm).toMatch(/confirmLabel/);
    const cards = readFileSync(path.resolve("apps/web/src/components/board/WorkBoard.tsx"), "utf8");
    expect(cards).toMatch(/追加/);
    expect(cards).toMatch(/等待你确认 · 去处理/);
  });
});
