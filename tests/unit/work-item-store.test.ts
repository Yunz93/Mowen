import { mkdir, mkdtemp } from "node:fs/promises";
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
    expect(second.rank).toBeGreaterThan(first.rank);

    await store.move(second.id, "doing");
    await store.move(first.id, "doing", second.id);
    const doing = store.list().filter((item) => item.column === "doing");
    expect(doing.map((item) => item.title)).toEqual(["fix login", "add tests"]);

    const reloaded = new WorkItemStore(root);
    await reloaded.load();
    expect(reloaded.list().map((item) => item.title).sort()).toEqual(["add tests", "fix login"]);
    expect(reloaded.get(second.id)?.column).toBe("doing");
  });
});
