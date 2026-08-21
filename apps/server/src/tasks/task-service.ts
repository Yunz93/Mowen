import { randomUUID } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type {
  ClientCommand,
  ServerEvent,
  TaskRecord,
  TimelineMessage,
} from "@ohmypi/protocol";
import type { AppConfig } from "../config.js";
import { ProcessSupervisor } from "../pi/process-supervisor.js";
import { canTransition, isActiveProcessStatus, isBusyStatus, transition } from "../pi/state-machine.js";
import { assertAllowedCwd, resolveAllowedPath } from "../security/path-policy.js";
import { TaskStore } from "./task-store.js";

type SocketLike = { send: (data: string) => void; closed: boolean };

const IGNORED_DIR_NAMES = new Set(["node_modules", ".git", "dist", ".ohmypi-test"]);

export type SetupHints = {
  authConfigured: boolean;
  configuredProviders: string[];
  needsSetup: boolean;
  homeDir: string;
  workspaceRoot: string | null;
};

export class TaskService {
  readonly supervisor: ProcessSupervisor;
  private readonly sockets = new Set<SocketLike>();
  private readonly queue: string[] = [];
  private activeTaskId: string | null = null;
  readonly uploads = new Map<string, { mimeType: string; data: Buffer }>();
  private setupHints: SetupHints = {
    authConfigured: false,
    configuredProviders: [],
    needsSetup: true,
    homeDir: "",
    workspaceRoot: null,
  };

  constructor(
    private config: AppConfig,
    private readonly store: TaskStore,
    readonly piVersion: string | null,
    readonly piError: string | null,
  ) {
    this.supervisor = new ProcessSupervisor(
      config,
      (taskId, generation, error) => {
        void this.handleUnexpectedExit(taskId, generation, error);
      },
      (taskId) => {
        void this.apply(taskId, "approval_request");
      },
      (taskId) => {
        void this.apply(taskId, "agent_settled");
      },
      (taskId) => {
        void this.apply(taskId, "abort_confirmed");
      },
    );
    this.supervisor.onEvent((event) => {
      this.broadcast(event);
      if (event.type === "approval.resolved") {
        const task = this.store.get(event.taskId);
        if (task?.status === "waiting_approval") {
          void this.apply(event.taskId, "approval_resolved");
        }
      }
      if (event.type === "message.started" || event.type === "tool.started") {
        void this.markUnread(event.taskId);
      }
    });
  }

  updateConfig(config: AppConfig): void {
    this.config = config;
    this.supervisor.updateConfig(config);
  }

  setSetupHints(hints: SetupHints): void {
    this.setupHints = hints;
  }

  addSocket(socket: SocketLike): void {
    this.sockets.add(socket);
  }

  removeSocket(socket: SocketLike): void {
    this.sockets.delete(socket);
    if (this.sockets.size === 0) {
      this.supervisor.denyAllApprovals("Browser disconnected");
    }
  }

  listTasks(): TaskRecord[] {
    return this.store.listVisible().sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  }

  async handleCommand(command: ClientCommand): Promise<unknown> {
    switch (command.type) {
      case "task.create":
        return this.createTask(command.payload.cwd, command.payload.title);
      case "task.activate":
        await this.activate(command.taskId);
        return { task: this.store.get(command.taskId) };
      case "task.rename":
        return this.rename(command.taskId, command.payload.title);
      case "task.archive":
        return this.archive(command.taskId);
      case "prompt.send":
        return this.prompt(command.taskId, command.payload.message, command.payload.imageIds, "prompt");
      case "prompt.steer":
        return this.prompt(command.taskId, command.payload.message, command.payload.imageIds, "steer");
      case "prompt.followUp":
        return this.prompt(command.taskId, command.payload.message, command.payload.imageIds, "follow_up");
      case "agent.abort":
        return this.abort(command.taskId);
      case "model.set":
        await this.supervisor.rpcData(command.taskId, {
          type: "set_model",
          provider: command.payload.provider,
          modelId: command.payload.modelId,
        });
        await this.refreshTaskModel(command.taskId);
        return { ok: true };
      case "thinking.set":
        await this.supervisor.rpcData(command.taskId, {
          type: "set_thinking_level",
          level: command.payload.level,
        });
        await this.refreshTaskModel(command.taskId);
        return { ok: true };
      case "approval.respond": {
        const ok = this.supervisor.respondApproval(command.payload.requestId, command.payload.allow);
        if (!ok) throw new Error("这条确认已经失效");
        return { ok: true };
      }
      case "session.compact":
        await this.supervisor.rpcData(command.taskId, {
          type: "compact",
          customInstructions: command.payload?.customInstructions,
        });
        await this.refreshStats(command.taskId);
        return { ok: true };
      case "snapshot.request":
        return this.buildSnapshot(command.payload?.taskId ?? this.activeTaskId);
      case "files.tree":
        return this.fileTree(command.taskId);
      case "files.read":
        return this.filePreview(command.taskId, command.payload.path);
      case "task.search":
        return {
          tasks: this.listTasks().filter((task) => {
            const q = command.payload.query.trim().toLowerCase();
            if (!q) return true;
            return task.title.toLowerCase().includes(q) || task.cwd.toLowerCase().includes(q);
          }),
        };
      default:
        throw new Error("Unknown command");
    }
  }

  buildSnapshot(taskId: string | null): Record<string, unknown> {
    const tasks = this.listTasks();
    const activeId = taskId && tasks.some((task) => task.id === taskId) ? taskId : this.activeTaskId;
    const runtime = activeId ? this.supervisor.snapshot(activeId) : null;
    const active = activeId ? this.store.get(activeId) : undefined;
    return {
      tasks,
      activeTaskId: activeId,
      messages: runtime?.messages ?? [],
      tools: runtime?.tools ?? [],
      approval: runtime?.approval ?? null,
      models: runtime?.models ?? [],
      thinkingLevels: runtime?.thinkingLevels ?? ["off"],
      stats: runtime?.stats ?? null,
      piVersion: this.piVersion,
      piAvailable: Boolean(this.piVersion) && !this.piError,
      piError: this.piError,
      mutations: this.config.mutations,
      allowedRoots: this.config.allowedRoots,
      dataDir: this.config.dataDir,
      maxProcesses: this.config.maxProcesses,
      authConfigured: this.setupHints.authConfigured,
      configuredProviders: this.setupHints.configuredProviders,
      needsSetup: this.setupHints.needsSetup,
      homeDir: this.setupHints.homeDir || this.config.homeDir,
      workspaceRoot: this.setupHints.workspaceRoot,
      status: active?.status ?? "stopped",
    };
  }

  private async createTask(cwd: string, title?: string): Promise<{ task: TaskRecord }> {
    const resolved = await assertAllowedCwd(cwd, this.config.allowedRoots);
    const now = new Date().toISOString();
    const task: TaskRecord = {
      schemaVersion: 1,
      id: randomUUID(),
      title: title?.trim() || path.basename(resolved) || "新对话",
      cwd: resolved,
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
    await this.store.upsert(task);
    this.activeTaskId = task.id;
    this.emit(task.id, "task.created", { task });
    try {
      await this.activate(task.id);
    } catch {
      // Keep the task even if Pi is unavailable. The UI shows the boot error.
    }
    return { task: this.store.get(task.id) ?? task };
  }

  private async rename(taskId: string, title: string): Promise<{ task: TaskRecord }> {
    const task = this.requireTask(taskId);
    const next = await this.store.upsert({
      ...task,
      title,
      updatedAt: new Date().toISOString(),
    });
    this.emit(taskId, "task.updated", { task: next });
    return { task: next };
  }

  private async archive(taskId: string): Promise<{ ok: true }> {
    const task = this.requireTask(taskId);
    if (this.supervisor.has(taskId)) {
      await this.supervisor.stop(taskId);
    }
    this.removeQueued(taskId);
    const next = await this.store.upsert({
      ...task,
      status: "stopped",
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (this.activeTaskId === taskId) {
      this.activeTaskId = this.listTasks()[0]?.id ?? null;
    }
    this.emit(taskId, "task.archived", { taskId: next.id });
    await this.drainQueue();
    return { ok: true };
  }

  async activate(taskId: string): Promise<void> {
    const task = this.requireTask(taskId);
    this.activeTaskId = taskId;
    await this.store.upsert({
      ...task,
      lastOpenedAt: new Date().toISOString(),
      unreadCount: 0,
    });
    if (this.supervisor.has(taskId)) return;
    if (this.supervisor.runningCount() >= this.config.maxProcesses) {
      if (!this.queue.includes(taskId)) this.queue.push(taskId);
      await this.apply(taskId, "queued");
      return;
    }
    await this.boot(taskId);
  }

  private async boot(taskId: string): Promise<void> {
    await this.apply(taskId, this.store.get(taskId)?.status === "error" ? "restart" : "activate");
    try {
      const task = this.requireTask(taskId);
      const result = await this.supervisor.boot(task);
      const next = await this.store.upsert({
        ...this.requireTask(taskId),
        sessionPath: result.sessionPath,
        model: result.model,
        thinkingLevel: result.thinkingLevel,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      });
      await this.apply(taskId, "pi_ready");
      this.emit(taskId, "task.updated", { task: next });
      const runtime = this.supervisor.snapshot(taskId);
      if (runtime) {
        this.emit(taskId, "models.updated", {
          models: runtime.models,
          thinkingLevels: runtime.thinkingLevels,
        });
      }
      await this.refreshStats(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.apply(taskId, "spawn_failed", message);
      throw error;
    }
  }

  private async prompt(
    taskId: string,
    message: string,
    imageIds: string[] | undefined,
    mode: "prompt" | "steer" | "follow_up",
  ): Promise<{ ok: true }> {
    const task = this.requireTask(taskId);
    if (task.status === "queued") {
      throw new Error("正在排队，请稍等。");
    }
    if (task.status === "stopped" || task.status === "error") {
      await this.activate(taskId);
    }
    const latest = this.requireTask(taskId);
    // Pi queues `follow_up` until a later `prompt`. After settle that queue never
    // drains, so idle "continue the conversation" must be sent as `prompt`.
    const rpcMode: "prompt" | "steer" | "follow_up" =
      mode === "follow_up" && latest.status === "idle" ? "prompt" : mode;
    if (rpcMode === "prompt" && isBusyStatus(latest.status)) {
      throw new Error("正在回复。直接发送即可补充。");
    }
    if (rpcMode === "steer" && latest.status !== "running" && latest.status !== "waiting_approval") {
      throw new Error("只有正在回复时才能补充这条消息。");
    }
    if (rpcMode === "follow_up" && latest.status !== "running" && latest.status !== "waiting_approval") {
      throw new Error("只有正在回复时才能排队下一条消息。");
    }
    if (!this.supervisor.has(taskId)) {
      throw new Error("AI 还没启动");
    }

    const images = (imageIds ?? [])
      .map((id) => this.uploads.get(id))
      .filter((item): item is { mimeType: string; data: Buffer } => Boolean(item))
      .map((item) => ({
        type: "image",
        data: item.data.toString("base64"),
        mimeType: item.mimeType,
      }));

    const payload: Record<string, unknown> & { type: string } = { type: rpcMode, message };
    if (images.length > 0) payload.images = images;

    try {
      await this.supervisor.rpcData(taskId, payload);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const authHint = /api key|auth|login|unauthorized|401/i.test(text);
      this.emit(taskId, "server.error", {
        code: authHint ? "pi.auth" : "pi.prompt",
        message: authHint
          ? "连不上 AI 服务商。打开设置粘贴 API Key。ohMyPi 不会显示完整密钥。"
          : text,
        authHint,
      });
      throw error;
    }

    if (rpcMode === "prompt") {
      await this.apply(taskId, "prompt_accepted");
      if (task.title === path.basename(task.cwd) || task.title === "New task" || task.title === "新对话") {
        const titled = await this.store.upsert({
          ...this.requireTask(taskId),
          title: message.trim().slice(0, 72) || task.title,
          updatedAt: new Date().toISOString(),
        });
        this.emit(taskId, "task.updated", { task: titled });
      }
    }
    return { ok: true };
  }

  private async abort(taskId: string): Promise<{ ok: true }> {
    const task = this.requireTask(taskId);
    if (!isBusyStatus(task.status) && task.status !== "booting") {
      return { ok: true };
    }
    await this.apply(taskId, "abort");
    try {
      await this.supervisor.rpc(taskId, { type: "abort" });
    } finally {
      await this.apply(taskId, "abort_confirmed");
    }
    return { ok: true };
  }

  private async refreshTaskModel(taskId: string): Promise<void> {
    const state = (await this.supervisor.rpcData(taskId, { type: "get_state" })) as Record<string, unknown>;
    const modelObj = state.model as Record<string, unknown> | null;
    const next = await this.store.upsert({
      ...this.requireTask(taskId),
      model: modelObj
        ? {
            provider: String(modelObj.provider ?? "unknown"),
            id: String(modelObj.id ?? "unknown"),
            name: typeof modelObj.name === "string" ? modelObj.name : undefined,
          }
        : null,
      thinkingLevel: (state.thinkingLevel as TaskRecord["thinkingLevel"]) ?? "off",
      updatedAt: new Date().toISOString(),
    });
    this.emit(taskId, "task.updated", { task: next });
    const levels = (await this.supervisor.rpcData(taskId, { type: "get_available_thinking_levels" })) as {
      levels?: TaskRecord["thinkingLevel"][];
    };
    const runtime = this.supervisor.snapshot(taskId);
    this.emit(taskId, "models.updated", {
      models: runtime?.models ?? [],
      thinkingLevels: levels.levels ?? runtime?.thinkingLevels ?? ["off"],
    });
  }

  private async refreshStats(taskId: string): Promise<void> {
    try {
      const stats = await this.supervisor.rpcData(taskId, { type: "get_session_stats" });
      this.emit(taskId, "session.stats", { stats });
    } catch {
      // Stats are optional.
    }
  }

  private async fileTree(taskId: string): Promise<{ entries: Array<{ path: string; name: string; kind: "file" | "dir" }> }> {
    const task = this.requireTask(taskId);
    const entries: Array<{ path: string; name: string; kind: "file" | "dir" }> = [];
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 6 || entries.length > 400) return;
      const names = await readdir(dir);
      for (const name of names) {
        if (name.startsWith(".") || IGNORED_DIR_NAMES.has(name)) continue;
        const full = path.join(dir, name);
        const info = await stat(full);
        const rel = path.relative(task.cwd, full);
        if (info.isDirectory()) {
          entries.push({ path: rel, name, kind: "dir" });
          await walk(full, depth + 1);
        } else {
          entries.push({ path: rel, name, kind: "file" });
        }
      }
    };
    await walk(task.cwd, 0);
    this.emit(taskId, "files.tree", { entries });
    return { entries };
  }

  private async filePreview(taskId: string, relativePath: string): Promise<void> {
    const task = this.requireTask(taskId);
    const resolved = await resolveAllowedPath(relativePath, task.cwd, this.config.allowedRoots);
    const buf = await readFile(resolved);
    const truncated = buf.byteLength > 200_000;
    const content = buf.subarray(0, 200_000).toString("utf8");
    this.emit(taskId, "files.preview", {
      path: relativePath,
      content,
      truncated,
      language: path.extname(relativePath).slice(1),
    });
  }

  private async handleUnexpectedExit(taskId: string, generation: number, error: string): Promise<void> {
    if (this.supervisor.getGeneration(taskId) !== generation && this.supervisor.has(taskId)) {
      return;
    }
    await this.supervisor.stop(taskId, "SIGKILL");
    await this.apply(taskId, "pi_exit", error);
    await this.drainQueue();
  }

  private async drainQueue(): Promise<void> {
    while (this.queue.length > 0 && this.supervisor.runningCount() < this.config.maxProcesses) {
      const nextId = this.queue.shift();
      if (!nextId) break;
      const task = this.store.get(nextId);
      if (!task || task.archivedAt) continue;
      try {
        await this.boot(nextId);
      } catch {
        // boot records error state
      }
    }
  }

  private removeQueued(taskId: string): void {
    const index = this.queue.indexOf(taskId);
    if (index >= 0) this.queue.splice(index, 1);
  }

  private async markUnread(taskId: string): Promise<void> {
    if (this.activeTaskId === taskId) return;
    const task = this.store.get(taskId);
    if (!task) return;
    const next = await this.store.upsert({
      ...task,
      unreadCount: task.unreadCount + 1,
      updatedAt: new Date().toISOString(),
    });
    this.emit(taskId, "task.updated", { task: next });
  }

  private async apply(
    taskId: string,
    event: Parameters<typeof transition>[1],
    errorMessage?: string,
  ): Promise<TaskRecord> {
    const task = this.requireTask(taskId);
    if (!canTransition(task.status, event)) {
      return task;
    }
    const status = transition(task.status, event);
    const next = await this.store.upsert({
      ...task,
      status,
      errorMessage: status === "error" ? errorMessage ?? task.errorMessage ?? "Pi error" : null,
      updatedAt: new Date().toISOString(),
    });
    this.emit(taskId, "agent.status", { status: next.status, errorMessage: next.errorMessage ?? null });
    this.emit(taskId, "task.updated", { task: next });
    if (status === "error" || status === "stopped" || status === "idle") {
      // idle after boot should not drain; only when a process slot is released
    }
    return next;
  }

  private requireTask(taskId: string): TaskRecord {
    const task = this.store.get(taskId);
    if (!task || task.archivedAt) {
      throw new Error("找不到这个对话");
    }
    return task;
  }

  emit(taskId: string, type: ServerEvent["type"], payload: unknown): void {
    const meta = this.supervisor.nextSequence(taskId);
    const event = {
      ...meta,
      taskId,
      type,
      payload,
    } as ServerEvent;
    this.broadcast(event);
  }

  broadcast(event: ServerEvent): void {
    const data = JSON.stringify(event);
    for (const socket of this.sockets) {
      if (!socket.closed) socket.send(data);
    }
  }

  restoredMessages(taskId: string): TimelineMessage[] {
    return this.supervisor.snapshot(taskId)?.messages ?? [];
  }
}

export { isActiveProcessStatus };
