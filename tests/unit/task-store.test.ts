import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TaskStore } from "../../apps/server/src/tasks/task-store.ts";
import type { TaskRecord } from "@ohmypi/protocol";

function sample(id: string): TaskRecord {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id,
    title: "Demo",
    cwd: "/tmp/ohmypi-sample-project",
    sessionPath: null,
    status: "stopped",
    model: null,
    thinkingLevel: "off",
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    archivedAt: null,
    unreadCount: 0,
  };
}

describe("task store", () => {
  it("writes metadata atomically", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ohmypi-store-"));
    const store = new TaskStore(dir);
    await store.load();
    const task = sample("11111111-1111-4111-8111-111111111111");
    await store.upsert(task);
    const raw = await readFile(path.join(dir, "state.json"), "utf8");
    expect(raw).toContain(task.id);
    const again = new TaskStore(dir);
    await again.load();
    expect(again.get(task.id)?.title).toBe("Demo");
  });
});
