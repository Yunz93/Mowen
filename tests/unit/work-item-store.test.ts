import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { WorkItemStore } from "../../apps/server/src/tasks/work-item-store.ts";

describe("WorkItemStore", () => {
  it("creates open objectives and persists their rank and acceptance criteria", async () => {
    const root = await tempRoot();
    const store = new WorkItemStore(root);
    await store.load();
    const first = await store.create({
      title: "fix login",
      cwd: root,
      description: "handle 401",
      acceptanceCriteria: "tests pass",
    });
    const second = await store.create({ title: "add tests", cwd: root });
    expect(first.state).toBe("open");
    expect(first.acceptanceCriteria).toBe("tests pass");
    expect(first.projectId).toBeTruthy();
    expect(second.projectId).toBe(first.projectId);
    expect(second.rank).toBeGreaterThan(first.rank);

    await store.reorder(second.id, first.id);
    expect(store.list().map((item) => item.title)).toEqual(["add tests", "fix login"]);

    const reloaded = new WorkItemStore(root);
    await reloaded.load();
    expect(reloaded.get(first.id)?.acceptanceCriteria).toBe("tests pass");
    expect(reloaded.list().map((item) => item.title)).toEqual(["add tests", "fix login"]);
  });

  it("stores feedback and immutable run history separately from the objective", async () => {
    const root = await tempRoot();
    const store = new WorkItemStore(root);
    await store.load();
    const item = await store.create({ title: "fix login", cwd: root });
    const feedback = await store.addFeedback(item.id, "also handle 403");
    const run = await store.createRun({
      objectiveId: item.id,
      taskId: "33333333-3333-4333-8333-333333333333",
      kind: "feedback",
      instruction: "continue",
    });
    await store.markFeedbackDelivered([feedback.id], run.id);
    await store.updateRun(run.id, { status: "running" });
    await store.updateRun(run.id, { status: "succeeded", resultSummary: "tests pass" });

    const details = store.getDetails(item.id);
    expect(details?.feedback[0]).toMatchObject({ text: "also handle 403", runId: run.id });
    expect(details?.feedback[0]?.deliveredAt).toBeTruthy();
    expect(details?.runs[0]).toMatchObject({ status: "succeeded", resultSummary: "tests pass" });
    expect(store.getSummary(item.id)).toMatchObject({ runCount: 1, feedbackCount: 1 });

    await store.setState(item.id, "completed");
    await expect(store.addFeedback(item.id, "too late")).rejects.toThrow(/重新打开/);
    expect(store.get(item.id)?.completedAt).toBeTruthy();
  });

  it("migrates the v2 board into objectives and runs while preserving a backup", async () => {
    const root = await tempRoot();
    const legacy = {
      schemaVersion: 2,
      items: [
        {
          schemaVersion: 2,
          id: "11111111-1111-4111-8111-111111111111",
          title: "legacy",
          description: "keep this",
          cwd: root,
          column: "review",
          rank: 0,
          taskId: "33333333-3333-4333-8333-333333333333",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          lastRunAt: "2026-01-02T00:00:00.000Z",
          pendingRun: false,
          closedAt: null,
          notes: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              text: "preserve feedback",
              createdAt: "2026-01-01T12:00:00.000Z",
              sentAt: null,
            },
          ],
        },
      ],
    };
    await writeFile(path.join(root, "work-items.json"), JSON.stringify(legacy));

    const store = new WorkItemStore(root);
    await store.load();
    expect(store.listProjects()).toHaveLength(1);
    expect(store.list()[0]).toMatchObject({ title: "legacy", state: "open", runCount: 1, feedbackCount: 1 });
    expect(store.list()[0]?.latestRun?.status).toBe("succeeded");
    expect(store.getDetails(legacy.items[0]!.id)?.feedback[0]?.text).toBe("preserve feedback");
    expect(JSON.parse(await readFile(path.join(root, "work-items.v2.backup.json"), "utf8"))).toEqual(legacy);
    expect(JSON.parse(await readFile(path.join(root, "work-items.json"), "utf8")).schemaVersion).toBe(3);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mowen-work-items-"));
  await mkdir(root, { recursive: true });
  return root;
}
