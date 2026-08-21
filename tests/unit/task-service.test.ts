import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../apps/server/src/config.ts";
import { TaskService } from "../../apps/server/src/tasks/task-service.ts";
import { TaskStore } from "../../apps/server/src/tasks/task-store.ts";
import type { TaskRecord } from "@ohmypi/protocol";

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
    errorMessage: null,
  };
}

describe("task service process reservations", () => {
  it("boots a task once and reserves the process slot before awaiting", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mypi-service-"));
    const store = new TaskStore(root);
    await store.load();
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";
    await store.upsert(task(firstId, root));
    await store.upsert(task(secondId, root));
    const config: AppConfig = {
      host: "127.0.0.1",
      port: 0,
      piBin: "pi",
      piCommand: "pi",
      piPrefixArgs: [],
      piExtraEnv: {},
      dataDir: root,
      allowedRoots: [root],
      maxProcesses: 1,
      mutations: "approval",
      nodeEnv: "test",
      approvalTimeoutMs: 1000,
      allowedOrigins: [],
      webDistDir: root,
      approvalExtensionPath: path.join(root, "approval.ts"),
      homeDir: root,
      piBundled: false,
    };
    const service = new TaskService(config, store, "test", null);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const boot = vi.spyOn(service.supervisor, "boot").mockImplementation(async () => {
      await gate;
      return { sessionPath: null, model: null, thinkingLevel: "off" };
    });
    vi.spyOn(service.supervisor, "rpcData").mockResolvedValue({});

    const first = service.activate(firstId);
    const duplicate = service.activate(firstId);
    await vi.waitFor(() => expect(boot).toHaveBeenCalledTimes(1));
    await service.activate(secondId);
    expect(store.get(secondId)?.status).toBe("queued");

    release();
    await Promise.all([first, duplicate]);
    expect(boot).toHaveBeenCalledTimes(1);
  });
});
