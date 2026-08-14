import { create } from "zustand";
import type {
  ApprovalRequest,
  ModelRef,
  ServerEvent,
  SessionStats,
  SnapshotPayload,
  TaskRecord,
  TaskStatus,
  ThinkingLevel,
  TimelineMessage,
  ToolExecution,
} from "@mypi/protocol";

export type ConnectionStatus = "connecting" | "open" | "closed";

type AgentState = {
  connection: ConnectionStatus;
  tasks: TaskRecord[];
  activeTaskId: string | null;
  messages: TimelineMessage[];
  tools: ToolExecution[];
  approval: ApprovalRequest | null;
  models: ModelRef[];
  thinkingLevels: ThinkingLevel[];
  stats: SessionStats | null;
  piVersion: string | null;
  piAvailable: boolean;
  piError: string | null;
  mutations: "approval" | "disabled";
  allowedRoots: string[];
  dataDir: string;
  maxProcesses: number;
  requestError: string | null;
  serverError: string | null;
  authHint: boolean;
  fileEntries: Array<{ path: string; name: string; kind: "file" | "dir" }>;
  filePreview: { path: string; content: string; truncated: boolean; language?: string } | null;
  seen: Record<string, number>;
  applyEvent: (event: ServerEvent) => void;
  applySnapshot: (payload: SnapshotPayload, taskId?: string) => void;
  setConnection: (status: ConnectionStatus) => void;
  setActiveTask: (taskId: string | null) => void;
  clearRequestError: () => void;
};

function seenKey(taskId: string, sequence: number): string {
  return `${taskId}:${sequence}`;
}

function upsertTask(tasks: TaskRecord[], task: TaskRecord): TaskRecord[] {
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) return [task, ...tasks];
  const next = tasks.slice();
  next[index] = task;
  return next;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  connection: "connecting",
  tasks: [],
  activeTaskId: null,
  messages: [],
  tools: [],
  approval: null,
  models: [],
  thinkingLevels: ["off"],
  stats: null,
  piVersion: null,
  piAvailable: true,
  piError: null,
  mutations: "approval",
  allowedRoots: [],
  dataDir: "",
  maxProcesses: 3,
  requestError: null,
  serverError: null,
  authHint: false,
  fileEntries: [],
  filePreview: null,
  seen: {},
  setConnection: (connection) => set({ connection }),
  setActiveTask: (activeTaskId) => set({ activeTaskId }),
  clearRequestError: () => set({ requestError: null, serverError: null }),
  applySnapshot: (payload, taskId) =>
    set({
      tasks: payload.tasks,
      activeTaskId: taskId ?? payload.activeTaskId,
      messages: payload.messages,
      tools: payload.tools,
      approval: payload.approval,
      models: payload.models,
      thinkingLevels: payload.thinkingLevels,
      stats: payload.stats,
      piVersion: payload.piVersion,
      piAvailable: payload.piAvailable,
      piError: payload.piError,
      mutations: payload.mutations,
      allowedRoots: payload.allowedRoots,
      dataDir: payload.dataDir,
      maxProcesses: payload.maxProcesses,
    }),
  applyEvent: (event) => {
    const key = seenKey(event.taskId, event.sequence);
    const current = get();
    if (current.seen[key] !== undefined) return;
    const seen = { ...current.seen, [key]: event.sequence };

    switch (event.type) {
      case "snapshot":
        set({
          seen,
          tasks: event.payload.tasks,
          activeTaskId: event.payload.activeTaskId ?? current.activeTaskId,
          messages: event.payload.messages,
          tools: event.payload.tools,
          approval: event.payload.approval,
          models: event.payload.models,
          thinkingLevels: event.payload.thinkingLevels,
          stats: event.payload.stats,
          piVersion: event.payload.piVersion,
          piAvailable: event.payload.piAvailable,
          piError: event.payload.piError,
          mutations: event.payload.mutations,
          allowedRoots: event.payload.allowedRoots,
          dataDir: event.payload.dataDir,
          maxProcesses: event.payload.maxProcesses,
        });
        break;
      case "task.created":
        set({ seen, tasks: upsertTask(current.tasks, event.payload.task), activeTaskId: event.payload.task.id });
        break;
      case "task.updated":
        set({ seen, tasks: upsertTask(current.tasks, event.payload.task) });
        break;
      case "task.archived":
        set({
          seen,
          tasks: current.tasks.filter((task) => task.id !== event.payload.taskId),
          activeTaskId: current.activeTaskId === event.payload.taskId ? null : current.activeTaskId,
        });
        break;
      case "agent.status":
        set({
          seen,
          tasks: current.tasks.map((task) =>
            task.id === event.taskId
              ? { ...task, status: event.payload.status as TaskStatus, errorMessage: event.payload.errorMessage }
              : task,
          ),
        });
        break;
      case "message.started":
        if (event.taskId !== current.activeTaskId) {
          set({ seen });
          break;
        }
        set({
          seen,
          messages: current.messages.some((item) => item.id === event.payload.message.id)
            ? current.messages
            : [...current.messages, event.payload.message],
        });
        break;
      case "message.delta":
        if (event.taskId !== current.activeTaskId) {
          set({ seen });
          break;
        }
        set({
          seen,
          messages: current.messages.map((item) => {
            if (item.id !== event.payload.messageId) return item;
            if (event.payload.field === "thinking") {
              return { ...item, thinking: `${item.thinking ?? ""}${event.payload.delta}` };
            }
            return { ...item, text: item.text + event.payload.delta };
          }),
        });
        break;
      case "message.completed":
        if (event.taskId !== current.activeTaskId) {
          set({ seen });
          break;
        }
        set({
          seen,
          messages: current.messages.some((item) => item.id === event.payload.message.id)
            ? current.messages.map((item) =>
                item.id === event.payload.message.id ? event.payload.message : item,
              )
            : [...current.messages, event.payload.message],
        });
        break;
      case "tool.started":
      case "tool.updated":
      case "tool.completed":
        if (event.taskId !== current.activeTaskId) {
          set({ seen });
          break;
        }
        set({
          seen,
          tools: [
            ...current.tools.filter((tool) => tool.toolCallId !== event.payload.tool.toolCallId),
            event.payload.tool,
          ],
        });
        break;
      case "approval.requested":
        if (event.taskId === current.activeTaskId) {
          set({ seen, approval: event.payload.approval });
        } else {
          set({ seen });
        }
        break;
      case "approval.resolved":
        set({
          seen,
          approval:
            current.approval?.requestId === event.payload.requestId ? null : current.approval,
        });
        break;
      case "session.stats":
        if (event.taskId === current.activeTaskId) {
          set({ seen, stats: event.payload.stats });
        } else set({ seen });
        break;
      case "connection.status":
        set({
          seen,
          connection:
            event.payload.status === "connected"
              ? "open"
              : event.payload.status === "reconnecting"
                ? "connecting"
                : "closed",
        });
        break;
      case "request.failed":
        set({ seen, requestError: event.payload.error });
        break;
      case "request.succeeded":
        set({ seen, requestError: null });
        break;
      case "server.error":
        set({
          seen,
          serverError: event.payload.message,
          authHint: Boolean(event.payload.authHint),
        });
        break;
      case "files.tree":
        set({ seen, fileEntries: event.payload.entries });
        break;
      case "files.preview":
        set({ seen, filePreview: event.payload });
        break;
      case "models.updated":
        set({
          seen,
          models: event.payload.models,
          thinkingLevels: event.payload.thinkingLevels,
        });
        break;
      default:
        set({ seen });
    }
  },
}));

export function activeTask(): TaskRecord | undefined {
  const { tasks, activeTaskId } = useAgentStore.getState();
  return tasks.find((task) => task.id === activeTaskId);
}
