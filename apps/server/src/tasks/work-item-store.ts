import { mkdir, open, readFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  WORK_ITEM_SCHEMA_VERSION,
  workItemIsClosed,
  workItemSchema,
  workProjectSchema,
  type WorkItem,
  type WorkItemColumn,
  type WorkItemNote,
  type WorkProject,
} from "@mowen/protocol";

type PersistedState = {
  schemaVersion: number;
  activeProjectId: string | null;
  projects: WorkProject[];
  items: WorkItem[];
};

const emptyState = (): PersistedState => ({
  schemaVersion: WORK_ITEM_SCHEMA_VERSION,
  activeProjectId: null,
  projects: [],
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
      .map((item) => ({ ...item, notes: item.notes.map((note) => ({ ...note })) }));
  }

  listByProject(projectId: string): WorkItem[] {
    return this.list().filter((item) => item.projectId === projectId);
  }

  listProjects(): WorkProject[] {
    return this.state.projects
      .filter((project) => !project.archivedAt)
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((project) => ({ ...project }));
  }

  get(id: string): WorkItem | undefined {
    const item = this.state.items.find((entry) => entry.id === id);
    return item ? { ...item, notes: item.notes.map((note) => ({ ...note })) } : undefined;
  }

  getProject(id: string): WorkProject | undefined {
    const project = this.state.projects.find((entry) => entry.id === id);
    return project ? { ...project } : undefined;
  }

  findProjectByCwd(cwd: string): WorkProject | undefined {
    const project = this.state.projects.find((entry) => entry.cwd === cwd && !entry.archivedAt);
    return project ? { ...project } : undefined;
  }

  getActiveProjectId(): string | null {
    const id = this.state.activeProjectId;
    if (id) {
      const current = this.getProject(id);
      if (current && !current.archivedAt) return id;
    }
    return this.listProjects()[0]?.id ?? null;
  }

  findByTaskId(taskId: string): WorkItem[] {
    return this.state.items.filter((item) => item.taskId === taskId).map((item) => this.get(item.id)!);
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = migratePersisted(JSON.parse(raw) as Record<string, unknown>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.state = emptyState();
        return;
      }
      throw error;
    }
  }

  async createProject(input: { name: string; cwd: string }): Promise<WorkProject> {
    const now = new Date().toISOString();
    const project = workProjectSchema.parse({
      schemaVersion: WORK_ITEM_SCHEMA_VERSION,
      id: randomUUID(),
      name: input.name.trim() || folderName(input.cwd),
      cwd: input.cwd,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    this.state.projects.push(project);
    this.state.activeProjectId = project.id;
    await this.flush();
    return { ...project };
  }

  async selectProject(id: string): Promise<WorkProject> {
    const project = this.getProject(id);
    if (!project || project.archivedAt) throw new Error("找不到这个项目");
    this.state.activeProjectId = id;
    await this.flush();
    return project;
  }

  async create(input: {
    title: string;
    description?: string;
    cwd: string;
    projectId?: string;
    column?: WorkItemColumn;
  }): Promise<WorkItem> {
    let projectId = input.projectId;
    if (!projectId) {
      const existing = this.findProjectByCwd(input.cwd);
      projectId = existing
        ? existing.id
        : (await this.createProject({ name: folderName(input.cwd), cwd: input.cwd })).id;
    }
    const project = this.getProject(projectId);
    if (!project) throw new Error("找不到这个项目");
    const now = new Date().toISOString();
    const column = input.column ?? "todo";
    const item = workItemSchema.parse({
      schemaVersion: WORK_ITEM_SCHEMA_VERSION,
      id: randomUUID(),
      projectId,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      notes: [],
      cwd: project.cwd,
      column,
      rank: nextRank(this.state.items, column, projectId),
      taskId: null,
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      pendingRun: false,
      closedAt: null,
    });
    this.state.items.push(item);
    if (!this.state.activeProjectId) this.state.activeProjectId = projectId;
    await this.flush();
    return this.get(item.id)!;
  }

  async update(
    id: string,
    patch: Partial<Pick<WorkItem, "title" | "description" | "taskId" | "lastRunAt" | "pendingRun" | "closedAt">>,
  ): Promise<WorkItem> {
    const index = this.state.items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("找不到这个任务");
    const current = this.state.items[index]!;
    const next = workItemSchema.parse({
      ...current,
      ...patch,
      title: patch.title != null ? patch.title.trim() : current.title,
      description: patch.description != null ? patch.description : current.description,
      notes: current.notes,
      updatedAt: new Date().toISOString(),
    });
    this.state.items[index] = next;
    await this.flush();
    return this.get(id)!;
  }

  async appendNote(id: string, text: string): Promise<WorkItem> {
    const index = this.state.items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("找不到这个任务");
    const current = this.state.items[index]!;
    if (workItemIsClosed(current.column)) throw new Error("这个任务已经闭环，不能再追加。");
    const trimmed = text.trim();
    if (!trimmed) throw new Error("请填写要追加的内容。");
    const note: WorkItemNote = {
      id: randomUUID(),
      text: trimmed,
      createdAt: new Date().toISOString(),
      sentAt: null,
    };
    const next = workItemSchema.parse({
      ...current,
      notes: [...current.notes, note],
      updatedAt: new Date().toISOString(),
    });
    this.state.items[index] = next;
    await this.flush();
    return this.get(id)!;
  }

  async markNotesSent(id: string, noteIds?: string[]): Promise<WorkItem> {
    const index = this.state.items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("找不到这个任务");
    const current = this.state.items[index]!;
    const now = new Date().toISOString();
    const selected = noteIds ? new Set(noteIds) : null;
    const next = workItemSchema.parse({
      ...current,
      notes: current.notes.map((note) => {
        if (note.sentAt) return note;
        if (selected && !selected.has(note.id)) return note;
        return { ...note, sentAt: now };
      }),
      updatedAt: now,
    });
    this.state.items[index] = next;
    await this.flush();
    return this.get(id)!;
  }

  async move(id: string, column: WorkItemColumn, beforeId?: string | null): Promise<WorkItem> {
    const item = this.state.items.find((entry) => entry.id === id);
    if (!item) throw new Error("找不到这个任务");
    const others = this.state.items
      .filter((entry) => entry.id !== id && entry.column === column && entry.projectId === item.projectId)
      .sort((a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt));
    const found = beforeId == null ? -1 : others.findIndex((entry) => entry.id === beforeId);
    const insertAt = beforeId == null || found < 0 ? others.length : found;
    const ordered = [...others];
    ordered.splice(insertAt, 0, { ...item, column });
    const now = new Date().toISOString();
    const closed = workItemIsClosed(column);
    for (const [rank, entry] of ordered.entries()) {
      const index = this.state.items.findIndex((candidate) => candidate.id === entry.id);
      if (index < 0) continue;
      const current = this.state.items[index]!;
      this.state.items[index] = {
        ...current,
        column: entry.column,
        rank,
        updatedAt: now,
        closedAt: current.id === id ? (closed ? (current.closedAt ?? now) : null) : current.closedAt,
      };
    }
    await this.flush();
    return this.get(id)!;
  }

  private async flush(): Promise<void> {
    this.writeChain = this.writeChain.then(
      () => this.flushNow(),
      () => this.flushNow(),
    );
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

function migratePersisted(raw: Record<string, unknown>): PersistedState {
  const rawProjects = Array.isArray(raw.projects) ? raw.projects : [];
  const projects: WorkProject[] = rawProjects.map((project) =>
    workProjectSchema.parse({ ...(project as object), schemaVersion: WORK_ITEM_SCHEMA_VERSION }),
  );
  const rawItems = Array.isArray(raw.items) ? (raw.items as Array<Record<string, unknown>>) : [];
  const items: WorkItem[] = [];
  for (const rawItem of rawItems) {
    let projectId = typeof rawItem.projectId === "string" ? rawItem.projectId : "";
    const cwd = typeof rawItem.cwd === "string" ? rawItem.cwd : "";
    if (!projectId) {
      let project = projects.find((entry) => entry.cwd === cwd && !entry.archivedAt);
      if (!project && cwd) {
        const now = new Date().toISOString();
        project = workProjectSchema.parse({
          schemaVersion: WORK_ITEM_SCHEMA_VERSION,
          id: randomUUID(),
          name: folderName(cwd),
          cwd,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });
        projects.push(project);
      }
      projectId = project?.id ?? "";
    }
    items.push(
      workItemSchema.parse({
        ...rawItem,
        schemaVersion: WORK_ITEM_SCHEMA_VERSION,
        projectId,
        notes: Array.isArray(rawItem.notes) ? rawItem.notes : [],
        closedAt: rawItem.closedAt ?? (rawItem.column === "done" || rawItem.column === "archived" ? rawItem.updatedAt : null),
      }),
    );
  }
  const active =
    typeof raw.activeProjectId === "string" && projects.some((project) => project.id === raw.activeProjectId)
      ? raw.activeProjectId
      : (projects[0]?.id ?? null);
  return {
    schemaVersion: WORK_ITEM_SCHEMA_VERSION,
    activeProjectId: active,
    projects,
    items,
  };
}

function nextRank(items: WorkItem[], column: WorkItemColumn, projectId: string): number {
  let max = -1;
  for (const item of items) {
    if (item.column === column && item.projectId === projectId && item.rank > max) max = item.rank;
  }
  return max + 1;
}

function folderName(cwd: string): string {
  const parts = cwd.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}
