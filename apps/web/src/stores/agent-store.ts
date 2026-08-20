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
  serverInstanceId: string | null;
  // Per-task last processed sequence, used to drop replayed events after a
  // reconnect or duplicate broadcast. Single WS channel is ordered, so keeping
  // the max per task is sufficient (unlike a per-event map, this doesn't grow).
  lastSeen: Record<string, number>;
  applyEvent: (event: ServerEvent) => void;
  applySnapshot: (payload: SnapshotPayload, taskId?: string) => void;
  setConnection: (status: ConnectionStatus) => void;
  setActiveTask: (taskId: string | null) => void;
  clearRequestError: () => void;
};

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
  serverInstanceId: null,
  lastSeen: {},
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
    let current = get();
    if (current.serverInstanceId !== event.serverInstanceId) {
      set({ serverInstanceId: event.serverInstanceId, lastSeen: {} });
      current = get();
    }
    const last = current.lastSeen[event.taskId] ?? -1;
    // Single ordered WS channel: drop replays (sequence <= last) and record
    // the new max. No unbounded per-event bookkeeping.
    if (event.sequence <= last) return;
    const lastSeen = { ...current.lastSeen, [event.taskId]: event.sequence };

    switch (event.type) {
      case "snapshot":
        set({
          lastSeen,
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
        set({ lastSeen, tasks: upsertTask(current.tasks, event.payload.task), activeTaskId: event.payload.task.id });
        break;
      case "task.updated":
        set({ lastSeen, tasks: upsertTask(current.tasks, event.payload.task) });
        break;
      case "task.archived":
        set({
          lastSeen,
          tasks: current.tasks.filter((task) => task.id !== event.payload.taskId),
          activeTaskId: current.activeTaskId === event.payload.taskId ? null : current.activeTaskId,
        });
        break;
      case "agent.status":
        set({
          lastSeen,
          tasks: current.tasks.map((task) =>
            task.id === event.taskId
              ? { ...task, status: event.payload.status as TaskStatus, errorMessage: event.payload.errorMessage }
              : task,
          ),
        });
        break;
      case "message.started":
        if (event.taskId !== current.activeTaskId) {
          set({ lastSeen });
          break;
        }
        set({
          lastSeen,
          messages: current.messages.some((item) => item.id === event.payload.message.id)
            ? current.messages
            : [...current.messages, event.payload.message],
        });
        break;
      case "message.delta":
        if (event.taskId !== current.activeTaskId) {
          set({ lastSeen });
          break;
        }
        set({
          lastSeen,
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
          set({ lastSeen });
          break;
        }
        set({
          lastSeen,
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
          set({ lastSeen });
          break;
        }
        set({
          lastSeen,
          tools: [
            ...current.tools.filter((tool) => tool.toolCallId !== event.payload.tool.toolCallId),
            event.payload.tool,
          ],
        });
        break;
      case "approval.requested":
        if (event.taskId === current.activeTaskId) {
          set({ lastSeen, approval: event.payload.approval });
        } else {
          set({ lastSeen });
        }
        break;
      case "approval.resolved":
        set({
          lastSeen,
          approval:
            current.approval?.requestId === event.payload.requestId ? null : current.approval,
        });
        break;
      case "session.stats":
        if (event.taskId === current.activeTaskId) {
          set({ lastSeen, stats: event.payload.stats });
        } else set({ lastSeen });
        break;
      case "connection.status":
        set({
          lastSeen,
          connection:
            event.payload.status === "connected"
              ? "open"
              : event.payload.status === "reconnecting"
                ? "connecting"
                : "closed",
        });
        break;
      case "request.failed":
        set({ lastSeen, requestError: event.payload.error });
        break;
      case "request.succeeded":
        set({ lastSeen, requestError: null });
        break;
      case "server.error":
        set({
          lastSeen,
          serverError: event.payload.message,
          authHint: Boolean(event.payload.authHint),
        });
        break;
      case "files.tree":
        set({ lastSeen, fileEntries: event.payload.entries });
        break;
      case "files.preview":
        set({ lastSeen, filePreview: event.payload });
        break;
      case "models.updated":
        set({
          lastSeen,
          models: event.payload.models,
          thinkingLevels: event.payload.thinkingLevels,
        });
        break;
      default:
        set({ lastSeen });
    }
  },
}));

export function activeTask(): TaskRecord | undefined {
  const { tasks, activeTaskId } = useAgentStore.getState();
  return tasks.find((task) => task.id === activeTaskId);
}
