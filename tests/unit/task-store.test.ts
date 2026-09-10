import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TaskStore, SERVER_RESTART_INTERRUPT_MESSAGE } from "../../apps/server/src/tasks/task-store.ts";
import type { TaskRecord } from "@qingzhou/protocol";

function sample(id: string): TaskRecord {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id,
    title: "Demo",
    cwd: "/tmp/qingzhou-sample-project",
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

describe("task store", () => {
  it("writes metadata atomically", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qingzhou-store-"));
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

  it("restores persisted runtime states as stopped", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mypi-store-restart-"));
    const store = new TaskStore(dir);
    await store.load();
    const task = { ...sample("22222222-2222-4222-8222-222222222222"), status: "running" as const };
    await store.upsert(task);

    const restored = new TaskStore(dir);
    await restored.load();
    const next = restored.get(task.id);
    expect(next?.status).toBe("stopped");
    expect(next?.errorMessage).toBe(SERVER_RESTART_INTERRUPT_MESSAGE);
  });

  it("keeps idle→stopped quiet and preserves real error rows", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mypi-store-idle-"));
    const store = new TaskStore(dir);
    await store.load();
    await store.upsert({ ...sample("33333333-3333-4333-8333-333333333333"), status: "idle" });
    await store.upsert({
      ...sample("44444444-4444-4444-8444-444444444444"),
      status: "error",
      errorMessage: "Pi 进程退出",
    });

    const restored = new TaskStore(dir);
    await restored.load();
    expect(restored.get("33333333-3333-4333-8333-333333333333")?.status).toBe("stopped");
    expect(restored.get("33333333-3333-4333-8333-333333333333")?.errorMessage ?? null).toBeNull();
    expect(restored.get("44444444-4444-4444-8444-444444444444")?.status).toBe("error");
    expect(restored.get("44444444-4444-4444-8444-444444444444")?.errorMessage).toBe("Pi 进程退出");
  });

  it("reorders one cwd group without moving other projects", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "qingzhou-store-reorder-"));
    const store = new TaskStore(dir);
    await store.load();
    const alpha = "/tmp/alpha";
    const beta = "/tmp/beta";
    const a1 = { ...sample("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), title: "a1", cwd: alpha };
    const a2 = { ...sample("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), title: "a2", cwd: alpha };
    const b1 = { ...sample("cccccccc-cccc-4ccc-8ccc-cccccccccccc"), title: "b1", cwd: beta };
    await store.upsert(a1);
    await store.upsert(b1);
    await store.upsert(a2);
    expect(store.listVisible().map((task) => task.id)).toEqual([a2.id, b1.id, a1.id]);

    await store.persistReorder(alpha, [a1.id, a2.id]);
    expect(store.listVisible().map((task) => task.id)).toEqual([a1.id, b1.id, a2.id]);

    const again = new TaskStore(dir);
    await again.load();
    expect(again.listVisible().map((task) => task.id)).toEqual([a1.id, b1.id, a2.id]);
  });
});
