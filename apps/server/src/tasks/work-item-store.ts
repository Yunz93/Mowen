import { mkdir, open, readFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  WORK_ITEM_SCHEMA_VERSION,
  workItemSchema,
  type WorkItem,
  type WorkItemColumn,
} from "@mowen/protocol";

type PersistedState = {
  schemaVersion: number;
  items: WorkItem[];
};

const emptyState = (): PersistedState => ({
  schemaVersion: WORK_ITEM_SCHEMA_VERSION,
  items: [],
});

export class WorkItemStore {
  private state: PersistedState = emptyState();
  private readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "work-items.json");
  }

  list(): WorkItem[] {
    return this.state.items
      .slice()
      .sort((a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt))
      .map((item) => ({ ...item }));
  }

  get(id: string): WorkItem | undefined {
    const item = this.state.items.find((entry) => entry.id === id);
    return item ? { ...item } : undefined;
  }

  findByTaskId(taskId: string): WorkItem[] {
    return this.state.items.filter((item) => item.taskId === taskId).map((item) => ({ ...item }));
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedState;
      const items = Array.isArray(parsed.items)
        ? parsed.items.map((item) => workItemSchema.parse({ ...item, schemaVersion: WORK_ITEM_SCHEMA_VERSION }))
        : [];
      this.state = { schemaVersion: WORK_ITEM_SCHEMA_VERSION, items };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.state = emptyState();
        return;
      }
      throw error;
    }
  }

  async create(input: {
    title: string;
    description?: string;
    cwd: string;
    column?: WorkItemColumn;
  }): Promise<WorkItem> {
    const now = new Date().toISOString();
    const column = input.column ?? "todo";
    const item = workItemSchema.parse({
      schemaVersion: WORK_ITEM_SCHEMA_VERSION,
      id: randomUUID(),
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      cwd: input.cwd,
      column,
      rank: nextRank(this.state.items, column),
      taskId: null,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      pendingRun: false,
    });
    this.state.items.push(item);
    await this.flush();
    return { ...item };
  }

  async update(id: string, patch: Partial<Pick<WorkItem, "title" | "description" | "taskId" | "lastRunAt" | "pendingRun">>): Promise<WorkItem> {
    const index = this.state.items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("找不到这个工作项");
    const current = this.state.items[index]!;
    const next = workItemSchema.parse({
      ...current,
      ...patch,
      title: patch.title != null ? patch.title.trim() : current.title,
      description: patch.description != null ? patch.description : current.description,
      updatedAt: new Date().toISOString(),
    });
    this.state.items[index] = next;
    await this.flush();
    return { ...next };
  }

  async move(id: string, column: WorkItemColumn, beforeId?: string | null): Promise<WorkItem> {
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item) throw new Error("找不到这个工作项");
    const others = this.state.items
      .filter((entry) => entry.id !== id && entry.column === column)
      .sort((a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt));
    const found = beforeId == null ? -1 : others.findIndex((entry) => entry.id === beforeId);
    const insertAt = beforeId == null || found < 0 ? others.length : found;
    const ordered = [...others];
    ordered.splice(insertAt, 0, { ...item, column });
    const now = new Date().toISOString();
    for (const [rank, entry] of ordered.entries()) {
      const index = this.state.items.findIndex((candidate) => candidate.id === entry.id);
      if (index < 0) continue;
      this.state.items[index] = {
        ...this.state.items[index]!,
        column: entry.column,
        rank,
        updatedAt: now,
      };
    }
    await this.flush();
    return this.get(id)!;
  }

  private async flush(): Promise<void> {
    this.writeChain = this.writeChain.then(() => this.flushNow(), () => this.flushNow());
    await this.writeChain;
  }

  private async flushNow(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`;
    const handle = await open(tmp, "w");
    try {
      await handle.writeFile(JSON.stringify(this.state, null, 2), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(tmp, this.filePath);
  }
}

function nextRank(items: WorkItem[], column: WorkItemColumn): number {
  let max = -1;
  for (const item of items) {
    if (item.column === column && item.rank > max) max = item.rank;
  }
  return max + 1;
}
