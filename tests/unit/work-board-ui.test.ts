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
    expect(layout).toMatch(/任务 · /);
    expect(mode).toMatch(/对话/);
    expect(mode).toMatch(/工作/);
    expect(board).toMatch(/启动项目/);
    expect(board).toMatch(/新建任务/);
    expect(board).toMatch(/work-project-select/);
    expect(board).not.toMatch(/field work-project-select/);
    expect(board).toMatch(/work-head-spacer/);
    expect(board).not.toMatch(/max-w-\[240px\]/);
    const styles = readFileSync(path.resolve("apps/web/src/styles/app.css"), "utf8");
    expect(styles).toMatch(/\.work-project-row[\s\S]*margin-left:\s*auto/);
    expect(styles).toMatch(/\.work-project-select[\s\S]*appearance:\s*auto/);
    expect(styles).toMatch(/\.work-project-select[\s\S]*-webkit-appearance:\s*menulist/);
    expect(styles).toMatch(/\.work-project-select[\s\S]*field-sizing:\s*content/);
    expect(styles).toMatch(/\.work-project-select[\s\S]*max-width:\s*12rem/);
    expect(board).toMatch(/__new__/);
    expect(board).toMatch(/新项目…/);
    expect(board).not.toMatch(/btn btn-ghost h-7[\s\S]*新项目/);
    expect(styles).not.toMatch(/\.work-project-row select \{\s*max-width:\s*none/);
    expect(dashboard).toMatch(/需要你处理/);
    expect(dashboard).toMatch(/开始执行/);
    expect(dashboard).toMatch(/接受并完成/);
    expect(panel).toMatch(/补充要求并继续/);
    expect(panel).toMatch(/执行记录/);
    expect(dashboard).not.toMatch(/<select/);
  });

  it("keeps work sessions in the conversation sidebar after switching", () => {
    const layout = readFileSync(path.resolve("apps/web/src/layouts/WorkbenchLayout.tsx"), "utf8");
    const sidebar = readFileSync(path.resolve("apps/web/src/components/tasks/TaskSidebar.tsx"), "utf8");
    const board = readFileSync(path.resolve("apps/web/src/pages/BoardPage.tsx"), "utf8");

    expect(layout).toMatch(/tasks=\{tasks\}/);
    expect(layout).toMatch(/workTaskIds=\{workTaskIds\}/);
    expect(layout).not.toMatch(/!workTaskIds\.has/);
    expect(layout).not.toMatch(/conversationTasks/);
    expect(sidebar).toMatch(/workTaskIds\.has\(task\.id\)/);
    expect(sidebar).toMatch(/>任务</);
    expect(sidebar).toMatch(/打开工作台/);
    expect(sidebar).not.toMatch(/任务中的会话/);
    expect(board).toMatch(/setActiveTask\(taskId\)/);
    expect(board).toMatch(/requestId: interaction.requestId/);
    expect(board).toMatch(/snapshot\.request/);
    expect(board).toMatch(/sr-only/);
    expect(board).not.toMatch(/text-\[22px\] font-semibold tracking-tight">\{project\.name\}/);
    expect(board).not.toMatch(/folderName\(project\.cwd\)/);
  });
});
