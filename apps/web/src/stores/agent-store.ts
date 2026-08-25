import { create } from "zustand";
import type {
  ApprovalRequest,
  AuthEntry,
  ModelRef,
  PiResources,
  PiSessionRef,
  RuntimeState,
  ServerEvent,
  SessionStats,
  SessionTreeNode,
  SnapshotPayload,
  TaskRecord,
  TaskStatus,
  ThinkingLevel,
  TimelineMessage,
  ToolExecution,
} from "@mowen/protocol";
import { emptyRuntime } from "@mowen/protocol";

export type AgentCommand = { name: string; description?: string; source?: string };
export type GitSnapshot = {
  branch: string | null;
  dirty: boolean;
  entries: Array<{ path: string; status: string }>;
};
export type CheckpointRecord = {
  id: string;
  taskId: string;
  path: string;
  createdAt: string;
  toolName?: string;
};

export type ConnectionStatus = "connecting" | "open" | "closed";

const WORKBENCH_CACHE_KEY = "mowen.workbench";

type WorkbenchCache = {
  tasks: TaskRecord[];
  activeTaskId: string | null;
  messages: TimelineMessage[];
  tools: ToolExecution[];
};

function readWorkbenchCache(): Partial<WorkbenchCache> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(WORKBENCH_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkbenchCache>;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : undefined,
      activeTaskId: typeof parsed.activeTaskId === "string" || parsed.activeTaskId === null ? parsed.activeTaskId : undefined,
      messages: Array.isArray(parsed.messages) ? parsed.messages : undefined,
      tools: Array.isArray(parsed.tools) ? parsed.tools : undefined,
    };
  } catch {
    return {};
  }
}

function persistWorkbenchCache(state: { tasks: TaskRecord[]; activeTaskId: string | null; messages: TimelineMessage[]; tools: ToolExecution[] }): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: WorkbenchCache = {
      tasks: state.tasks,
      activeTaskId: state.activeTaskId,
      messages: state.messages,
      tools: state.tools,
    };
    sessionStorage.setItem(WORKBENCH_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private-mode failures should not break the live session.
  }
}

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
  needsSetup: boolean;
  authConfigured: boolean;
  configuredProviders: string[];
  homeDir: string;
  workspaceRoot: string | null;
  fileEntries: Array<{ path: string; name: string; kind: "file" | "dir" }>;
  filePreview: { path: string; content: string; truncated: boolean; language?: string } | null;
  pendingApprovals: ApprovalRequest[];
  commands: AgentCommand[];
  git: GitSnapshot | null;
  checkpoints: CheckpointRecord[];
  runtime: RuntimeState;
  resources: PiResources | null;
  sessionTree: SessionTreeNode[];
  sessionLeafId: string | null;
  piSessions: PiSessionRef[];
  authEntries: AuthEntry[];
  trustProject: boolean;
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
  setSetupState: (payload: {
    needsSetup: boolean;
    authConfigured: boolean;
    configuredProviders: string[];
    homeDir: string;
    workspaceRoot: string | null;
    allowedRoots?: string[];
    authEntries?: AuthEntry[];
    trustProject?: boolean;
    piVersion?: string | null;
    piAvailable?: boolean;
    piError?: string | null;
  }) => void;
};

function upsertTask(tasks: TaskRecord[], task: TaskRecord): TaskRecord[] {
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) return [task, ...tasks];
  const next = tasks.slice();
  next[index] = task;
  return next;
}

export const useAgentStore = create<AgentState>((set, get) => {
  const cached = readWorkbenchCache();
  return {
  connection: "connecting",
  tasks: cached.tasks ?? [],
  activeTaskId: cached.activeTaskId ?? null,
  messages: cached.messages ?? [],
  tools: cached.tools ?? [],
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
  needsSetup: false,
  authConfigured: true,
  configuredProviders: [],
  homeDir: "",
  workspaceRoot: null,
  fileEntries: [],
  filePreview: null,
  pendingApprovals: [],
  commands: [],
  git: null,
  checkpoints: [],
  runtime: emptyRuntime(),
  resources: null,
  sessionTree: [],
  sessionLeafId: null,
  piSessions: [],
  authEntries: [],
  trustProject: false,
  serverInstanceId: null,
  lastSeen: {},
  setConnection: (connection) => set({ connection }),
  setActiveTask: (activeTaskId) =>
    set({
      activeTaskId,
      approval: get().pendingApprovals.find((item) => item.taskId === activeTaskId) ?? null,
    }),
  clearRequestError: () => set({ requestError: null, serverError: null }),
  setSetupState: (payload) =>
    set({
      needsSetup: payload.needsSetup,
      authConfigured: payload.authConfigured,
      configuredProviders: payload.configuredProviders,
      homeDir: payload.homeDir,
      workspaceRoot: payload.workspaceRoot,
      allowedRoots: payload.allowedRoots ?? get().allowedRoots,
      authHint: !payload.authConfigured,
      authEntries: payload.authEntries ?? get().authEntries,
      trustProject: payload.trustProject ?? get().trustProject,
      ...(payload.piVersion !== undefined ? { piVersion: payload.piVersion } : {}),
      ...(payload.piAvailable !== undefined ? { piAvailable: payload.piAvailable } : {}),
      ...(payload.piError !== undefined ? { piError: payload.piError } : {}),
    }),
  applySnapshot: (payload, taskId) =>
    set({
      tasks: payload.tasks,
      activeTaskId: taskId ?? payload.activeTaskId,
      messages: payload.messages,
      tools: payload.tools,
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
      authConfigured: payload.authConfigured ?? get().authConfigured,
      configuredProviders: payload.configuredProviders ?? get().configuredProviders,
      needsSetup: payload.needsSetup ?? get().needsSetup,
      homeDir: payload.homeDir ?? get().homeDir,
      workspaceRoot: payload.workspaceRoot ?? get().workspaceRoot,
      authHint: payload.authConfigured === false ? true : get().authHint,
      pendingApprovals: payload.pendingApprovals ?? [],
      commands: payload.commands ?? [],
      git: payload.git ?? null,
      checkpoints: payload.checkpoints ?? [],
      runtime: payload.runtime ?? emptyRuntime(),
      resources: payload.resources ?? null,
      sessionTree: payload.sessionTree ?? [],
      sessionLeafId: payload.sessionLeafId ?? null,
      piSessions: payload.piSessions ?? [],
      authEntries: payload.authEntries ?? [],
      trustProject: payload.trustProject ?? false,
      approval:
        payload.approval ??
        (payload.pendingApprovals ?? []).find((item) => item.taskId === (taskId ?? payload.activeTaskId)) ??
        null,
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
          authConfigured: event.payload.authConfigured ?? current.authConfigured,
          configuredProviders: event.payload.configuredProviders ?? current.configuredProviders,
          needsSetup: event.payload.needsSetup ?? current.needsSetup,
          homeDir: event.payload.homeDir ?? current.homeDir,
          workspaceRoot:
            event.payload.workspaceRoot !== undefined
              ? event.payload.workspaceRoot
              : current.workspaceRoot,
          authHint:
            event.payload.authConfigured === false ? true : current.authHint && event.payload.authConfigured !== true,
          pendingApprovals: event.payload.pendingApprovals ?? current.pendingApprovals,
          commands: event.payload.commands ?? current.commands,
          git: event.payload.git ?? current.git,
          checkpoints: event.payload.checkpoints ?? current.checkpoints,
          runtime: event.payload.runtime ?? current.runtime,
          resources: event.payload.resources ?? current.resources,
          sessionTree: event.payload.sessionTree ?? current.sessionTree,
          sessionLeafId:
            event.payload.sessionLeafId !== undefined ? event.payload.sessionLeafId : current.sessionLeafId,
          piSessions: event.payload.piSessions ?? current.piSessions,
          authEntries: event.payload.authEntries ?? current.authEntries,
          trustProject: event.payload.trustProject ?? current.trustProject,
          approval:
            event.payload.approval ??
            (event.payload.pendingApprovals ?? current.pendingApprovals).find(
              (item) => item.taskId === (event.payload.activeTaskId ?? current.activeTaskId),
            ) ??
            null,
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
      case "approval.requested": {
        const pendingApprovals = [
          ...current.pendingApprovals.filter((item) => item.requestId !== event.payload.approval.requestId),
          event.payload.approval,
        ];
        set({
          lastSeen,
          pendingApprovals,
          approval:
            event.payload.approval.taskId === current.activeTaskId
              ? event.payload.approval
              : current.approval,
        });
        break;
      }
      case "approval.resolved": {
        const pendingApprovals = current.pendingApprovals.filter(
          (item) => item.requestId !== event.payload.requestId,
        );
        set({
          lastSeen,
          pendingApprovals,
          approval:
            current.approval?.requestId === event.payload.requestId
              ? (pendingApprovals.find((item) => item.taskId === current.activeTaskId) ?? null)
              : current.approval,
        });
        break;
      }
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
      case "commands.updated":
        set({ lastSeen, commands: event.payload.commands });
        break;
      case "git.status":
        if (event.taskId === current.activeTaskId) {
          set({ lastSeen, git: event.payload });
        } else set({ lastSeen });
        break;
      case "checkpoints.updated":
        if (event.taskId === current.activeTaskId) {
          set({ lastSeen, checkpoints: event.payload.checkpoints });
        } else set({ lastSeen });
        break;
      case "runtime.status":
        if (!event.taskId || event.taskId === current.activeTaskId) {
          set({ lastSeen, runtime: event.payload });
        } else set({ lastSeen });
        break;
      case "session.tree":
        if (!event.taskId || event.taskId === current.activeTaskId) {
          set({ lastSeen, sessionTree: event.payload.nodes, sessionLeafId: event.payload.leafId });
        } else set({ lastSeen });
        break;
      case "sessions.listed":
        set({ lastSeen, piSessions: event.payload.sessions });
        break;
      case "resources.updated":
        if (!event.taskId || event.taskId === current.activeTaskId) {
          set({ lastSeen, resources: event.payload });
        } else set({ lastSeen });
        break;
      default:
        set({ lastSeen });
    }
  },
  };
});

if (typeof sessionStorage !== "undefined") {
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  useAgentStore.subscribe((state) => {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistWorkbenchCache(state);
    }, 200);
  });
}

export function activeTask(): TaskRecord | undefined {
  const { tasks, activeTaskId } = useAgentStore.getState();
  return tasks.find((task) => task.id === activeTaskId);
}
