import { useEffect, useMemo, useRef, useState } from "react";
import { PanelRight } from "lucide-react";
import { NavRail } from "../components/navigation/NavRail";
import { TaskSidebar } from "../components/tasks/TaskSidebar";
import { ConversationTimeline } from "../components/timeline/ConversationTimeline";
import { PromptComposer } from "../components/composer/PromptComposer";
import { InspectorPanel } from "../components/inspector/InspectorPanel";
import { ApprovalSheet } from "../components/approval/ApprovalSheet";
import { PiStatusRing } from "../components/status/PiStatusRing";
import { ContextMeter } from "../components/status/ContextMeter";
import { RunStatusBar } from "../components/status/RunStatusBar";
import { useAgentStore } from "../stores/agent-store";
import { socketClient } from "../transport/socket-client";
import { CommandPalette } from "../components/command-palette/CommandPalette";
import { NewTaskDialog } from "../components/tasks/NewTaskDialog";
import type { ThinkingLevel } from "@mypi/protocol";
import {
  approvalDecision,
  effectiveApprovalPolicy,
  loadTaskPreferences,
  saveTaskPreferences,
  type ApprovalPolicy,
  type InteractionMode,
} from "../lib/interaction-policy";

function projectName(cwd: string): string {
  const parts = cwd.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

function nextAction(status: string, hasTask: boolean): string {
  if (!hasTask) return "Create a task";
  if (status === "waiting_approval") return "Review approval";
  if (status === "running") return "Steer or stop";
  if (status === "error") return "Restart from composer";
  if (status === "queued") return "Waiting for a Pi slot";
  if (status === "booting") return "Starting Pi";
  if (status === "aborting") return "Stopping";
  return "Send the next action";
}
function useViewport() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return {
    inspectorDrawer: width < 1180,
    taskDrawer: width < 900,
    mobile: width < 640,
  };
}

export function WorkbenchLayout() {
  const tasks = useAgentStore((state) => state.tasks);
  const activeTaskId = useAgentStore((state) => state.activeTaskId);
  const messages = useAgentStore((state) => state.messages);
  const tools = useAgentStore((state) => state.tools);
  const approval = useAgentStore((state) => state.approval);
  const models = useAgentStore((state) => state.models);
  const thinkingLevels = useAgentStore((state) => state.thinkingLevels);
  const stats = useAgentStore((state) => state.stats);
  const files = useAgentStore((state) => state.fileEntries);
  const preview = useAgentStore((state) => state.filePreview);
  const piError = useAgentStore((state) => state.piError);
  const piAvailable = useAgentStore((state) => state.piAvailable);
  const authHint = useAgentStore((state) => state.authHint);
  const serverError = useAgentStore((state) => state.serverError);
  const requestError = useAgentStore((state) => state.requestError);
  const connection = useAgentStore((state) => state.connection);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [cwd, setCwd] = useState(allowedRoots[0] ?? "");
  const [creating, setCreating] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [taskPreferences, setTaskPreferences] = useState(loadTaskPreferences);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    () => ("Notification" in window ? Notification.permission : "unsupported"),
  );
  const automaticallyHandled = useRef(new Set<string>());
  const notifiedApprovals = useRef(new Set<string>());
  const previousTaskId = useRef<string | null>(null);
  const viewport = useViewport();

  useEffect(() => {
    if (allowedRoots[0] && !cwd) setCwd(allowedRoots[0]);
  }, [allowedRoots, cwd]);

  const task = useMemo(
    () => tasks.find((item) => item.id === activeTaskId),
    [tasks, activeTaskId],
  );
  const status = task?.status ?? "stopped";
  const previousStatus = useRef(status);
  const preferences = taskPreferences[task?.id ?? ""] ?? {
    mode: "agent" as InteractionMode,
    approvalPolicy: "ask" as ApprovalPolicy,
  };
  const activeApprovalPolicy = effectiveApprovalPolicy(preferences.mode, preferences.approvalPolicy);
  const automaticApprovalDecision = approval
    ? approvalDecision(activeApprovalPolicy, approval)
    : null;

  const updatePreferences = (
    update: Partial<{ mode: InteractionMode; approvalPolicy: ApprovalPolicy }>,
  ) => {
    if (!task) return;
    setTaskPreferences((current) => {
      const next = {
        ...current,
        [task.id]: { ...preferences, ...update },
      };
      saveTaskPreferences(next);
      return next;
    });
  };

  useEffect(() => {
    if (!approval || automaticApprovalDecision == null) return;
    if (automaticallyHandled.current.has(approval.requestId)) return;
    automaticallyHandled.current.add(approval.requestId);
    void socketClient.send(
      "approval.respond",
      { requestId: approval.requestId, allow: automaticApprovalDecision },
      approval.taskId,
    );
  }, [approval, automaticApprovalDecision]);

  useEffect(() => {
    const before = previousStatus.current;
    const sameTask = previousTaskId.current === (task?.id ?? null);
    previousStatus.current = status;
    previousTaskId.current = task?.id ?? null;
    if (!sameTask) return;
    if (notificationPermission !== "granted" || document.visibilityState === "visible" || !task) return;
    if (approval && automaticApprovalDecision == null) {
      if (notifiedApprovals.current.has(approval.requestId)) return;
      notifiedApprovals.current.add(approval.requestId);
      new Notification("MyPi needs approval", { body: `${task.title}: review ${approval.toolName}` });
      return;
    }
    if ((before === "running" || before === "waiting_approval") && status === "idle") {
      new Notification("MyPi task completed", { body: task.title });
    } else if (before !== "error" && status === "error") {
      new Notification("MyPi task stopped", { body: task.errorMessage ?? task.title });
    }
  }, [approval, automaticApprovalDecision, notificationPermission, status, task]);

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    setNotificationPermission(await Notification.requestPermission());
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (creating) {
          event.preventDefault();
          setCreating(false);
          return;
        }
        event.preventDefault();
        if (task) void socketClient.send("agent.abort", {}, task.id);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreating(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating, task]);

  async function selectTask(taskId: string) {
    useAgentStore.getState().setActiveTask(taskId);
    await socketClient.send("task.activate", {}, taskId);
    await socketClient.send("snapshot.request", { taskId }, taskId);
    setTaskOpen(false);
  }

  const sendPrompt = async () => {
    if (!task || !draft.trim()) return;
    const text = draft;
    const images = imageIds;
    setDraft("");
    setImageIds([]);
    if (task.status === "stopped" || task.status === "error") {
      await socketClient.send("task.activate", {}, task.id);
    }
    await socketClient.send("prompt.send", { message: text, imageIds: images }, task.id);
  };

  async function uploadImages(files: FileList) {
    const ids: string[] = [];
    for (const file of [...files]) {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/uploads", { method: "POST", body });
      if (!response.ok) continue;
      const json = (await response.json()) as { id: string };
      ids.push(json.id);
    }
    setImageIds((current) => [...current, ...ids]);
  }

  return (
    <div className="flex h-dvh bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <NavRail onNewTask={() => setCreating(true)} />
      {viewport.taskDrawer ? (
        taskOpen ? (
          <div className="absolute inset-y-0 left-[52px] z-20">
            <TaskSidebar
              tasks={tasks}
              activeTaskId={activeTaskId}
              query={query}
              onQuery={setQuery}
              onSelect={(id) => void selectTask(id)}
              onArchive={(id) => void socketClient.send("task.archive", {}, id)}
            />
          </div>
        ) : null
      ) : (
        <TaskSidebar
          tasks={tasks}
          activeTaskId={activeTaskId}
          query={query}
          onQuery={setQuery}
          onSelect={(id) => void selectTask(id)}
          onArchive={(id) => void socketClient.send("task.archive", {}, id)}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <header className="flex h-[52px] items-center gap-3 border-b border-line px-4">
          {viewport.taskDrawer ? (
            <button type="button" className="pressable h-10 px-2 text-sm" onClick={() => setTaskOpen((v) => !v)}>
              Tasks
            </button>
          ) : null}
          <PiStatusRing status={status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{task?.title ?? "No task selected"}</p>
            <p className="truncate font-mono text-[11px] text-mute tabular">
              {task ? `${projectName(task.cwd)} · ${task.status.replaceAll("_", " ")} · ${nextAction(status, true)}` : nextAction(status, false)}
            </p>
          </div>
          {task ? (
            <ContextMeter
              compact={viewport.mobile}
              stats={stats}
              onCompact={() => void socketClient.send("session.compact", {}, task.id)}
            />
          ) : null}
          <span className="hidden font-mono text-[11px] text-mute tabular sm:inline">{connection}</span>
          {viewport.inspectorDrawer ? (
            <button
              type="button"
              className="pressable flex h-10 w-10 items-center justify-center"
              aria-label="Inspector"
              onClick={() => setInspectorOpen(true)}
            >
              <PanelRight size={16} />
            </button>
          ) : null}
        </header>
        {!piAvailable ? (
          <div className="border-b border-danger/40 bg-elevated px-4 py-2 text-sm text-danger">
            {piError ?? "Pi is not installed. Install the Pi CLI, then restart MyPi."}
          </div>
        ) : null}
        {connection !== "open" ? (
          <div className="border-b border-line bg-elevated px-4 py-2 font-mono text-[11px] text-mute tabular">
            {connection === "connecting" ? "Reconnecting to MyPi" : "Disconnected from MyPi"}
          </div>
        ) : null}
        {authHint || serverError || requestError ? (
          <div className="border-b border-line bg-elevated px-4 py-2 text-sm text-mute">
            {authHint
              ? "Pi is not signed in to a provider. Use the Pi CLI to authenticate. MyPi never shows API keys."
              : (serverError ?? requestError)}
          </div>
        ) : null}
        {task ? (
          <RunStatusBar
            status={status}
            tools={tools}
            hasChanges={tools.some((tool) => tool.toolName === "write" || tool.toolName === "edit")}
          />
        ) : null}
        <main id="main-content" className="min-h-0 min-w-[0] flex-1 overflow-y-auto">
          <ConversationTimeline messages={messages} tools={tools} />
        </main>
        <PromptComposer
          status={status}
          disabled={!task || connection !== "open"}
          models={models}
          thinkingLevels={thinkingLevels}
          modelId={task?.model ? `${task.model.provider}/${task.model.id}` : null}
          thinkingLevel={task?.thinkingLevel ?? "off"}
          mode={preferences.mode}
          approvalPolicy={preferences.approvalPolicy}
          hasTurns={messages.some((item) => item.role === "user")}
          value={draft}
          onChange={setDraft}
          onSend={() => void sendPrompt()}
          onSteer={() => {
            if (!task) return;
            const text = draft;
            const images = imageIds;
            setDraft("");
            setImageIds([]);
            void socketClient.send("prompt.steer", { message: text, imageIds: images }, task.id);
          }}
          onFollowUp={() => void sendPrompt()}
          onAbort={() => task && void socketClient.send("agent.abort", {}, task.id)}
          onModel={(provider, modelId) =>
            task && void socketClient.send("model.set", { provider, modelId }, task.id)
          }
          onThinking={(level: ThinkingLevel) =>
            task && void socketClient.send("thinking.set", { level }, task.id)
          }
          onMode={(mode) => updatePreferences({ mode })}
          onApprovalPolicy={(approvalPolicy) => updatePreferences({ approvalPolicy })}
          onImages={(files) => void uploadImages(files)}
          imageCount={imageIds.length}
          contextEntries={files}
          onRequestContext={() => task && files.length === 0 && void socketClient.send("files.tree", {}, task.id)}
        />
      </div>
      {viewport.inspectorDrawer ? (
        inspectorOpen ? (
          <InspectorPanel
            drawer
            tools={tools}
            stats={stats}
            files={files}
            preview={preview}
            onClose={() => setInspectorOpen(false)}
            onLoadTree={() => task && void socketClient.send("files.tree", {}, task.id)}
            onReadFile={(path) => task && void socketClient.send("files.read", { path }, task.id)}
            onCompact={() => task && void socketClient.send("session.compact", {}, task.id)}
            notificationPermission={notificationPermission}
            onEnableNotifications={() => void enableNotifications()}
          />
        ) : null
      ) : (
        <InspectorPanel
          tools={tools}
          stats={stats}
          files={files}
          preview={preview}
          onLoadTree={() => task && void socketClient.send("files.tree", {}, task.id)}
          onReadFile={(path) => task && void socketClient.send("files.read", { path }, task.id)}
          onCompact={() => task && void socketClient.send("session.compact", {}, task.id)}
          notificationPermission={notificationPermission}
          onEnableNotifications={() => void enableNotifications()}
        />
      )}
      {paletteOpen ? (
        <CommandPalette open onClose={() => setPaletteOpen(false)} onNewTask={() => setCreating(true)} />
      ) : null}
      {creating ? (
        <NewTaskDialog
          defaultCwd={cwd || allowedRoots[0] || ""}
          onCancel={() => setCreating(false)}
          onCreate={(directory, title) => {
            setCwd(directory);
            setCreating(false);
            void socketClient.send("task.create", { cwd: directory, title });
          }}
        />
      ) : null}
      {approval && automaticApprovalDecision == null ? (
        <ApprovalSheet
          approval={approval}
          onRespond={(allow) =>
            void socketClient.send("approval.respond", { requestId: approval.requestId, allow }, approval.taskId)
          }
        />
      ) : null}
    </div>
  );
}
