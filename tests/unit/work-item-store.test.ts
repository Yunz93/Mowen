import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkItemStore } from "../../apps/server/src/tasks/work-item-store.ts";

describe("WorkItemStore", () => {
  it("creates items in 待办 and can reorder across columns", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-work-items-"));
    await mkdir(root, { recursive: true });
    const store = new WorkItemStore(root);
    await store.load();
    const first = await store.create({ title: "fix login", cwd: root, description: "handle 401" });
    const second = await store.create({ title: "add tests", cwd: root });
    expect(first.column).toBe("todo");
    expect(first.projectId).toBeTruthy();
    expect(store.listProjects()).toHaveLength(1);
    expect(second.projectId).toBe(first.projectId);
    expect(second.rank).toBeGreaterThan(first.rank);

    await store.move(second.id, "doing");
    await store.move(first.id, "doing", second.id);
    const doing = store.list().filter((item) => item.column === "doing");
    expect(doing.map((item) => item.title)).toEqual(["fix login", "add tests"]);

    const reloaded = new WorkItemStore(root);
    await reloaded.load();
    expect(reloaded.list().map((item) => item.title).sort()).toEqual(["add tests", "fix login"]);
    expect(reloaded.get(second.id)?.column).toBe("doing");
    expect(reloaded.listProjects()).toHaveLength(1);
  });

  it("appends notes until a task is closed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-work-items-"));
    await mkdir(root, { recursive: true });
    const store = new WorkItemStore(root);
    await store.load();
    const item = await store.create({ title: "fix login", cwd: root });
    const appended = await store.appendNote(item.id, "also handle 403");
    expect(appended.notes).toHaveLength(1);
    expect(appended.notes[0]?.text).toBe("also handle 403");
    expect(appended.notes[0]?.sentAt).toBeNull();
    await store.move(item.id, "done");
    await expect(store.appendNote(item.id, "too late")).rejects.toThrow(/闭环/);
    expect(store.get(item.id)?.closedAt).toBeTruthy();
  });

  it("migrates legacy items without a project into one", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-work-items-"));
    await mkdir(root, { recursive: true });
    await writeFile(
      path.join(root, "work-items.json"),
      JSON.stringify({
        schemaVersion: 1,
        items: [
          {
            schemaVersion: 1,
            id: "11111111-1111-4111-8111-111111111111",
            title: "legacy",
            description: "",
            cwd: root,
            column: "todo",
            rank: 0,
            taskId: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            lastRunAt: null,
            pendingRun: false,
          },
        ],
      }),
    );
    const store = new WorkItemStore(root);
    await store.load();
    expect(store.listProjects()).toHaveLength(1);
    expect(store.list()[0]?.projectId).toBe(store.listProjects()[0]?.id);
    expect(store.list()[0]?.title).toBe("legacy");
  });
});
