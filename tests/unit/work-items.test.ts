import { describe, expect, it } from "vitest";
import { workItemMoveAbortsRun, workItemMoveStartsRun, workItemPrompt, WORK_ITEM_COLUMNS } from "../../packages/protocol/src/work-items.ts";

describe("work item prompt", () => {
  it("uses the title when there is no description", () => {
    expect(workItemPrompt({ title: "fix login" })).toBe("请完成工作项：fix login");
  });

  it("includes title and description", () => {
    expect(workItemPrompt({ title: "fix login", description: "handle 401" })).toContain("标题：fix login");
    expect(workItemPrompt({ title: "fix login", description: "handle 401" })).toContain("handle 401");
  });

  it("keeps the five board columns in order", () => {
    expect(WORK_ITEM_COLUMNS.map((item) => item.label)).toEqual(["待办", "执行", "待检视", "已完成", "归档"]);
  });

  it("only aborts a run when leaving 执行 for 待办 or 归档", () => {
    expect(workItemMoveAbortsRun("doing", "todo")).toBe(true);
    expect(workItemMoveAbortsRun("doing", "archived")).toBe(true);
    expect(workItemMoveAbortsRun("doing", "review")).toBe(false);
    expect(workItemMoveAbortsRun("doing", "done")).toBe(false);
    expect(workItemMoveAbortsRun("doing", "doing")).toBe(false);
    expect(workItemMoveAbortsRun("todo", "archived")).toBe(false);
  });

  it("starts a run only when entering 执行 from another column", () => {
    expect(workItemMoveStartsRun("todo", "doing")).toBe(true);
    expect(workItemMoveStartsRun("review", "doing")).toBe(true);
    expect(workItemMoveStartsRun("doing", "doing")).toBe(false);
    expect(workItemMoveStartsRun("todo", "review")).toBe(false);
  });
});
