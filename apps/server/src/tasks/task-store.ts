import { copyFile, mkdir, open, readFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { TASK_SCHEMA_VERSION, taskRecordSchema, type TaskRecord } from "@ohmypi/protocol";

export type PersistedState = {
  schemaVersion: number;
  tasks: TaskRecord[];
};

const emptyState = (): PersistedState => ({
  schemaVersion: TASK_SCHEMA_VERSION,
  tasks: [],
});

export class TaskStore {
  private state: PersistedState = emptyState();
  private readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "state.json");
  }

  getSnapshot(): TaskRecord[] {
    return this.state.tasks.map((task) => ({ ...task }));
  }

  get(id: string): TaskRecord | undefined {
    const task = this.state.tasks.find((item) => item.id === id);
    return task ? { ...task } : undefined;
  }

  listVisible(): TaskRecord[] {
    return this.state.tasks.filter((task) => !task.archivedAt).map((task) => ({ ...task }));
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.schemaVersion !== TASK_SCHEMA_VERSION) {
        await copyFile(this.filePath, `${this.filePath}.bak`);
      }
      const tasks = Array.isArray(parsed.tasks)
        ? parsed.tasks.map((task) => taskRecordSchema.parse({ ...task, schemaVersion: TASK_SCHEMA_VERSION }))
        : [];
      this.state = { schemaVersion: TASK_SCHEMA_VERSION, tasks };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.state = emptyState();
        return;
      }
      throw error;
    }
  }

  async upsert(task: TaskRecord): Promise<TaskRecord> {
    const next = taskRecordSchema.parse(task);
    const index = this.state.tasks.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      this.state.tasks[index] = next;
    } else {
      this.state.tasks.push(next);
    }
    await this.flush();
    return { ...next };
  }

  async remove(id: string): Promise<void> {
    this.state.tasks = this.state.tasks.filter((task) => task.id !== id);
    await this.flush();
  }

  private async flush(): Promise<void> {
    this.writeChain = this.writeChain.then(() => this.flushNow(), () => this.flushNow());
    await this.writeChain;
  }

  private async flushNow(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`;
    const payload = JSON.stringify(this.state, null, 2);
    const handle = await open(tmp, "w");
    try {
      await handle.writeFile(payload, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmp, this.filePath);
  }
}
