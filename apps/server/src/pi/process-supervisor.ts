import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  ApprovalRequest,
  ModelRef,
  ServerEvent,
  SessionStats,
  TaskRecord,
  ThinkingLevel,
  TimelineMessage,
  ToolExecution,
} from "@mypi/protocol";
import type { AppConfig } from "../config.js";
import { RpcClient, type RpcEvent } from "./rpc-client.js";
import { normalizePiEvent, piMessagesToTimeline } from "./event-normalizer.js";
import { redactSecrets } from "../security/redact.js";

export type RuntimeSnapshot = {
  messages: TimelineMessage[];
  tools: ToolExecution[];
  approval: ApprovalRequest | null;
  models: ModelRef[];
  thinkingLevels: ThinkingLevel[];
  stats: SessionStats | null;
  generation: number;
};

type ApprovalPending = {
  requestId: string;
  taskId: string;
  generation: number;
  payload: ApprovalRequest;
  timer: ReturnType<typeof setTimeout>;
};

type Listener = (event: ServerEvent) => void;

function parseApprovalMessage(
  requestId: string,
  taskId: string,
  title: string | undefined,
  message: string | undefined,
  timeoutMs: number,
): ApprovalRequest | null {
  if (!message || !message.includes("MYPI_APPROVAL_V1")) {
    if (title?.startsWith("Allow ")) {
      return {
        requestId,
        taskId,
        toolCallId: "",
        toolName: title.replace(/^Allow\s+/, "").replace(/\?$/, ""),
        cwd: "",
        target: message ?? "",
        risk: "This action requires approval.",
        expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
      };
    }
    return null;
  }
  const jsonLine = message
    .split("\n")
    .map((line) => line.trim())
    .find((line, index, lines) => lines[index - 1] === "MYPI_APPROVAL_V1");
  if (!jsonLine) return null;
  try {
    const parsed = JSON.parse(jsonLine) as {
      toolName?: string;
      toolCallId?: string;
      cwd?: string;
      target?: string;
      rawCommand?: string;
      risk?: string;
    };
    return {
      requestId,
      taskId,
      toolCallId: parsed.toolCallId ?? "",
      toolName: parsed.toolName ?? "tool",
      cwd: parsed.cwd ?? "",
      target: parsed.target ?? "",
      rawCommand: parsed.rawCommand,
      risk: parsed.risk ?? "This action requires approval.",
      expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
    };
  } catch {
    return null;
  }
}

export class ProcessSupervisor {
  private readonly runtimes = new Map<
    string,
    {
      generation: number;
      client: RpcClient;
      messages: TimelineMessage[];
      tools: Map<string, ToolExecution>;
      liveAssistantId: string | null;
      approval: ApprovalRequest | null;
      models: ModelRef[];
      thinkingLevels: ThinkingLevel[];
      stats: SessionStats | null;
    }
  >();
  private readonly pendingApprovals = new Map<string, ApprovalPending>();
  private readonly listeners = new Set<Listener>();
  private readonly sequences = new Map<string, number>();

  constructor(
    private config: AppConfig,
    private readonly onUnexpectedExit: (taskId: string, generation: number, error: string) => void,
    private readonly onApprovalNeeded: (taskId: string) => void,
    private readonly onSettled: (taskId: string) => void,
    private readonly onAbortConfirmed: (taskId: string) => void,
  ) {}

  updateConfig(config: AppConfig): void {
    this.config = config;
  }

  onEvent(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  runningCount(): number {
    return this.runtimes.size;
  }

  has(taskId: string): boolean {
    return this.runtimes.has(taskId);
  }

  snapshot(taskId: string): RuntimeSnapshot | null {
    const runtime = this.runtimes.get(taskId);
    if (!runtime) return null;
    return {
      messages: runtime.messages.map((item) => ({ ...item })),
      tools: [...runtime.tools.values()].map((item) => ({ ...item })),
      approval: runtime.approval,
      models: runtime.models,
      thinkingLevels: runtime.thinkingLevels,
      stats: runtime.stats,
      generation: runtime.generation,
    };
  }

  getGeneration(taskId: string): number {
    return this.runtimes.get(taskId)?.generation ?? 0;
  }

  async boot(task: TaskRecord): Promise<{ sessionPath: string | null; model: TaskRecord["model"]; thinkingLevel: ThinkingLevel }> {
    await this.stop(task.id, "SIGTERM");
    const generation = Date.now();
    const sessionDir = path.join(this.config.dataDir, "sessions", task.id);
    await mkdir(sessionDir, { recursive: true });
    const args = ["--mode", "rpc", "--no-extensions", "--extension", this.config.approvalExtensionPath];
    if (task.sessionPath) {
      args.push("--session", task.sessionPath);
    } else {
      args.push("--session-dir", sessionDir);
    }

    const runtime = {
      generation,
      client: null as unknown as RpcClient,
      messages: [] as TimelineMessage[],
      tools: new Map<string, ToolExecution>(),
      liveAssistantId: null as string | null,
      approval: null as ApprovalRequest | null,
      models: [] as ModelRef[],
      thinkingLevels: ["off"] as ThinkingLevel[],
      stats: null as SessionStats | null,
    };

    const client = new RpcClient({
      bin: this.config.piCommand,
      prefixArgs: this.config.piPrefixArgs,
      extraEnv: this.config.piExtraEnv,
      args,
      cwd: task.cwd,
      env: {
        MYPI_MUTATIONS: this.config.mutations,
        MYPI_ALLOWED_ROOTS: this.config.allowedRoots.join(","),
        MYPI_TASK_ID: task.id,
      },
      onEvent: (event) => this.handlePiEvent(task.id, generation, event),
      onStderr: (chunk) => {
        if (chunk.trim()) {
          console.warn(`[pi ${task.id}] ${redactSecrets(chunk.trim())}`);
        }
      },
      onExit: (code, signal) => {
        const current = this.runtimes.get(task.id);
        if (!current || current.generation !== generation) return;
        this.onUnexpectedExit(
          task.id,
          generation,
          `Pi exited unexpectedly (code=${code} signal=${signal}).`,
        );
      },
    });
    runtime.client = client;
    this.runtimes.set(task.id, runtime);

    await client.start();
    const state = await this.rpcData(task.id, { type: "get_state" });
    const messages = await this.rpcData(task.id, { type: "get_messages" });
    const models = await this.rpcData(task.id, { type: "get_available_models" });
    const levels = await this.rpcData(task.id, { type: "get_available_thinking_levels" });

    const stateData = (state ?? {}) as Record<string, unknown>;
    const messageData = (messages ?? {}) as { messages?: unknown[] };
    runtime.messages = piMessagesToTimeline(messageData.messages ?? []);
    runtime.models = Array.isArray((models as { models?: unknown[] })?.models)
      ? ((models as { models: Array<Record<string, unknown>> }).models).map((model) => ({
          provider: String(model.provider ?? "unknown"),
          id: String(model.id ?? "unknown"),
          name: typeof model.name === "string" ? model.name : undefined,
          reasoning: Boolean(model.reasoning),
          contextWindow: typeof model.contextWindow === "number" ? model.contextWindow : undefined,
        }))
      : [];
    runtime.thinkingLevels = Array.isArray((levels as { levels?: unknown[] })?.levels)
      ? ((levels as { levels: string[] }).levels).filter((level): level is ThinkingLevel =>
          ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(level),
        )
      : ["off"];
    if (runtime.thinkingLevels.length === 0) runtime.thinkingLevels = ["off"];

    const modelObj = stateData.model as Record<string, unknown> | null | undefined;
    const model =
      modelObj && typeof modelObj === "object"
        ? {
            provider: String(modelObj.provider ?? "unknown"),
            id: String(modelObj.id ?? "unknown"),
            name: typeof modelObj.name === "string" ? modelObj.name : undefined,
          }
        : null;

    return {
      sessionPath: typeof stateData.sessionFile === "string" ? stateData.sessionFile : null,
      model,
      thinkingLevel: (stateData.thinkingLevel as ThinkingLevel) ?? "off",
    };
  }

  async stop(taskId: string, signal: NodeJS.Signals = "SIGTERM"): Promise<void> {
    const runtime = this.runtimes.get(taskId);
    if (!runtime) return;
    this.runtimes.delete(taskId);
    this.clearApprovalsForTask(taskId, "Task stopped");
    await runtime.client.stop(signal);
  }

  async rpc(taskId: string, command: Record<string, unknown> & { type: string }): Promise<import("./rpc-client.js").RpcResponse> {
    const runtime = this.runtimes.get(taskId);
    if (!runtime) {
      throw new Error("Pi process is not running for this task");
    }
    return runtime.client.send(command);
  }

  async rpcData(taskId: string, command: Record<string, unknown> & { type: string }): Promise<unknown> {
    const response = await this.rpc(taskId, command);
    if (!response.success) {
      throw new Error(response.error ?? `${command.type} failed`);
    }
    return response.data;
  }

  respondApproval(requestId: string, allow: boolean): boolean {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) return false;
    const runtime = this.runtimes.get(pending.taskId);
    if (!runtime || runtime.generation !== pending.generation) {
      this.pendingApprovals.delete(requestId);
      clearTimeout(pending.timer);
      return false;
    }
    runtime.client.sendUiResponse(
      allow
        ? { id: requestId, confirmed: true }
        : { id: requestId, confirmed: false, cancelled: true },
    );
    this.finishApproval(requestId, allow);
    return true;
  }

  denyAllApprovals(reason: string): void {
    for (const requestId of [...this.pendingApprovals.keys()]) {
      this.denyOne(requestId, reason);
    }
  }

  denyApprovalsForTask(taskId: string, reason: string): void {
    this.clearApprovalsForTask(taskId, reason);
  }

  private denyOne(requestId: string, reason: string): void {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) return;
    const runtime = this.runtimes.get(pending.taskId);
    if (runtime && runtime.generation === pending.generation) {
      runtime.client.sendUiResponse({ id: requestId, confirmed: false, cancelled: true });
    }
    this.finishApproval(requestId, false, reason);
  }

  private finishApproval(requestId: string, allow: boolean, reason?: string): void {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingApprovals.delete(requestId);
    const runtime = this.runtimes.get(pending.taskId);
    if (runtime) runtime.approval = null;
    this.emit(pending.taskId, "approval.resolved", { requestId, allow, reason });
  }

  private clearApprovalsForTask(taskId: string, reason: string): void {
    for (const [requestId, pending] of this.pendingApprovals) {
      if (pending.taskId === taskId) {
        this.denyOne(requestId, reason);
      }
    }
  }

  private handlePiEvent(taskId: string, generation: number, event: RpcEvent): void {
    const runtime = this.runtimes.get(taskId);
    if (!runtime || runtime.generation !== generation) return;

    const normalized = normalizePiEvent(event);
    switch (normalized.kind) {
      case "status":
        if (normalized.settled) {
          runtime.liveAssistantId = null;
          this.onSettled(taskId);
        }
        break;
      case "message.started": {
        const message = normalized.message;
        if (message.role === "assistant" && message.streaming) {
          runtime.liveAssistantId = message.id;
        }
        runtime.messages.push(message);
        this.emit(taskId, "message.started", { message });
        break;
      }
      case "message.delta": {
        const id = runtime.liveAssistantId ?? normalized.messageId;
        const existing = runtime.messages.find((item) => item.id === id);
        if (existing) {
          if (normalized.field === "text") existing.text += normalized.delta;
          if (normalized.field === "thinking") {
            existing.thinking = `${existing.thinking ?? ""}${normalized.delta}`;
          }
        }
        this.emit(taskId, "message.delta", {
          messageId: id,
          field: normalized.field,
          delta: normalized.delta,
        });
        break;
      }
      case "message.completed": {
        const id =
          normalized.message.role === "assistant" && runtime.liveAssistantId
            ? runtime.liveAssistantId
            : normalized.message.id;
        const message = { ...normalized.message, id };
        const index = runtime.messages.findIndex((item) => item.id === id);
        if (index >= 0) {
          runtime.messages[index] = message;
        } else {
          runtime.messages.push(message);
        }
        if (normalized.message.role === "assistant") {
          runtime.liveAssistantId = null;
        }
        this.emit(taskId, "message.completed", { message });
        break;
      }
      case "tool.started": {
        runtime.tools.set(normalized.tool.toolCallId, normalized.tool);
        this.emit(taskId, "tool.started", { tool: normalized.tool });
        break;
      }
      case "tool.updated": {
        const current = runtime.tools.get(normalized.tool.toolCallId);
        if (current) {
          const next = { ...current, ...normalized.tool };
          runtime.tools.set(next.toolCallId, next);
          this.emit(taskId, "tool.updated", { tool: next });
        }
        break;
      }
      case "tool.completed": {
        const current = runtime.tools.get(normalized.tool.toolCallId);
        const started = current?.startedAt ? Date.parse(current.startedAt) : Date.now();
        const next = {
          ...(current ?? {
            toolCallId: normalized.tool.toolCallId,
            toolName: "tool",
            status: "failed" as const,
          }),
          ...normalized.tool,
          durationMs: Date.now() - started,
        };
        runtime.tools.set(next.toolCallId, next);
        this.emit(taskId, "tool.completed", { tool: next });
        break;
      }
      case "approval.ui": {
        if (normalized.method !== "confirm") break;
        const approval = parseApprovalMessage(
          normalized.requestId,
          taskId,
          normalized.title,
          normalized.message,
          this.config.approvalTimeoutMs,
        );
        if (!approval) break;
        runtime.approval = approval;
        const tool = [...runtime.tools.values()].find(
          (item) => item.toolCallId === approval.toolCallId || item.status === "running",
        );
        if (tool) {
          tool.status = "waiting_approval";
          this.emit(taskId, "tool.updated", { tool });
        }
        const timer = setTimeout(() => {
          this.denyOne(approval.requestId, "Approval timed out");
        }, this.config.approvalTimeoutMs);
        this.pendingApprovals.set(approval.requestId, {
          requestId: approval.requestId,
          taskId,
          generation,
          payload: approval,
          timer,
        });
        this.emit(taskId, "approval.requested", { approval });
        this.onApprovalNeeded(taskId);
        break;
      }
      case "extension_error":
        this.emit(taskId, "server.error", { code: "extension", message: normalized.error });
        break;
      default:
        break;
    }
  }

  emit(taskId: string, type: ServerEvent["type"], payload: unknown): void {
    const sequence = (this.sequences.get(taskId) ?? 0) + 1;
    this.sequences.set(taskId, sequence);
    const event = {
      eventId: randomUUID(),
      taskId,
      timestamp: new Date().toISOString(),
      sequence,
      type,
      payload,
    } as ServerEvent;
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  nextSequence(taskId: string): { eventId: string; timestamp: string; sequence: number } {
    const sequence = (this.sequences.get(taskId) ?? 0) + 1;
    this.sequences.set(taskId, sequence);
    return { eventId: randomUUID(), timestamp: new Date().toISOString(), sequence };
  }
}
