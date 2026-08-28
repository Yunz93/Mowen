import { describe, expect, it } from "vitest";
import { workItemPrompt, WORK_ITEM_COLUMNS } from "../../packages/protocol/src/work-items.ts";

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
});
