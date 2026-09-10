import { describe, expect, it } from "vitest";
import type { TaskRecord } from "@qingzhou/protocol";
import { groupTasksByProject, moveTaskInGroup, tasksInSidebarOrder } from "../../apps/web/src/lib/task-list.ts";

function task(id: string, cwd: string): TaskRecord {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id,
    title: id,
    cwd,
    sessionPath: null,
    status: "stopped",
    model: null,
    thinkingLevel: "off",
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    archivedAt: null,
    unreadCount: 0,
    mode: "agent",
    approvalPolicy: "ask",
  };
}

describe("task list order", () => {
  it("walks sidebar groups instead of the flat array", () => {
    const a1 = task("a1", "/tmp/a");
    const b1 = task("b1", "/tmp/b");
    const a2 = task("a2", "/tmp/a");
    const tasks = [a1, b1, a2];
    expect(groupTasksByProject(tasks).map(([cwd, items]) => [cwd, items.map((item) => item.id)])).toEqual([
      ["/tmp/a", ["a1", "a2"]],
      ["/tmp/b", ["b1"]],
    ]);
    expect(tasksInSidebarOrder(tasks).map((item) => item.id)).toEqual(["a1", "a2", "b1"]);
  });

  it("moves a session within one project group", () => {
    expect(moveTaskInGroup(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveTaskInGroup(["a", "b"], "a", "a")).toBeNull();
  });
});
