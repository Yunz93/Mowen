import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CheckpointStore } from "../../apps/server/src/tasks/checkpoints.ts";

describe("checkpoints", () => {
  it("saves a file and restores it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-check-"));
    const project = path.join(root, "project");
    const data = path.join(root, "data");
    await mkdir(project, { recursive: true });
    const file = path.join(project, "note.txt");
    await writeFile(file, "before");
    const store = new CheckpointStore(data);
    const saved = await store.save("task-1", project, "note.txt", "edit");
    expect(saved?.path).toBe("note.txt");
    await writeFile(file, "after");
    await store.restore("task-1", saved!.id, project);
    expect(await readFile(file, "utf8")).toBe("before");
  });
});
