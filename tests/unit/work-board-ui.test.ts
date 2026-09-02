import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("agent-native work mode", () => {
  it("exposes /board with explicit goal and execution actions", () => {
    const router = readFileSync(path.resolve("apps/web/src/app/router.tsx"), "utf8");
    const layout = readFileSync(path.resolve("apps/web/src/layouts/WorkbenchLayout.tsx"), "utf8");
    const mode = readFileSync(path.resolve("apps/web/src/components/app/ModeSwitcher.tsx"), "utf8");
    const board = readFileSync(path.resolve("apps/web/src/pages/BoardPage.tsx"), "utf8");
    const dashboard = readFileSync(path.resolve("apps/web/src/components/board/WorkDashboard.tsx"), "utf8");
    const panel = readFileSync(path.resolve("apps/web/src/components/board/WorkObjectivePanel.tsx"), "utf8");

    expect(router).toMatch(/path="\/board"/);
    expect(layout).toMatch(/ModeSwitcher/);
    expect(layout).toMatch(/工作 · /);
    expect(mode).toMatch(/对话/);
    expect(mode).toMatch(/工作/);
    expect(board).toMatch(/启动项目/);
    expect(board).toMatch(/新建目标/);
    expect(dashboard).toMatch(/需要你处理/);
    expect(dashboard).toMatch(/开始执行/);
    expect(dashboard).toMatch(/接受并完成/);
    expect(panel).toMatch(/补充要求并继续/);
    expect(panel).toMatch(/执行记录/);
    expect(dashboard).not.toMatch(/<select/);
  });
});
