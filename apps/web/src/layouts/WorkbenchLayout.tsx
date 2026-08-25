import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, PanelRight, Plus, Settings } from "lucide-react";
import { TaskSidebar } from "../components/tasks/TaskSidebar";
import { ConversationTimeline } from "../components/timeline/ConversationTimeline";
import { PromptComposer } from "../components/composer/PromptComposer";
import { InspectorPanel } from "../components/inspector/InspectorPanel";
import { ApprovalSheet } from "../components/approval/ApprovalSheet";
import { PiStatusRing } from "../components/status/PiStatusRing";
import { ThemeToggle } from "../components/status/ThemeToggle";
import { ContextMeter } from "../components/status/ContextMeter";
import { RunStatusBar } from "../components/status/RunStatusBar";
import { useAgentStore } from "../stores/agent-store";
import { socketClient } from "../transport/socket-client";
import { CommandPalette } from "../components/command-palette/CommandPalette";
import { NewTaskDialog } from "../components/tasks/NewTaskDialog";
import type { ApprovalPolicy, InteractionMode, ThinkingLevel } from "@mowen/protocol";
import { folderName, nextHint } from "../copy";

export function WorkbenchLayout() {
  const tasks = useAgentStore((state) => state.tasks);
  const activeTaskId = useAgentStore((state) => state.activeTaskId);
  const messages = useAgentStore((state) => state.messages);
  const tools = useAgentStore((state) => state.tools);
  const approval = useAgentStore((state) => state.approval);
  const pendingApprovals = useAgentStore((state) => state.pendingApprovals);
  const models = useAgentStore((state) => state.models);
  const thinkingLevels = useAgentStore((state) => state.thinkingLevels);
  const stats = useAgentStore((state) => state.stats);
  const files = useAgentStore((state) => state.fileEntries);
  const preview = useAgentStore((state) => state.filePreview);
  const commands = useAgentStore((state) => state.commands);
  const git = useAgentStore((state) => state.git);
  const checkpoints = useAgentStore((state) => state.checkpoints);
  const runtime = useAgentStore((state) => state.runtime);
  const resources = useAgentStore((state) => state.resources);
  const sessionTree = useAgentStore((state) => state.sessionTree);
  const sessionLeafId = useAgentStore((state) => state.sessionLeafId);
  const piSessions = useAgentStore((state) => state.piSessions);
  const piError = useAgentStore((state) => state.piError);
  const piAvailable = useAgentStore((state) => state.piAvailable);
  const authHint = useAgentStore((state) => state.authHint);
  const serverError = useAgentStore((state) => state.serverError);
  const requestError = useAgentStore((state) => state.requestError);
  const connection = useAgentStore((state) => state.connection);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);
  const workspaceRoot = useAgentStore((state) => state.workspaceRoot);

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [cwd, setCwd] = useState(workspaceRoot ?? allowedRoots[0] ?? "");
  const [creating, setCreating] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const preferred = workspaceRoot ?? allowedRoots[0];
    if (preferred && !cwd) setCwd(preferred);
  }, [allowedRoots, workspaceRoot, cwd]);

  useEffect(() => {
    if (creating) void socketClient.send("sessions.list", {});
  }, [creating]);

  const task = useMemo(
    () => tasks.find((item) => item.id === activeTaskId),
    [tasks, activeTaskId],
  );
  const status = task?.status ?? "stopped";
  const otherApproval = pendingApprovals.find((item) => item.taskId !== activeTaskId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (creating) {
          event.preventDefault();
          setCreating(false);
          return;
        }
        if (paletteOpen) {
          event.preventDefault();
          setPaletteOpen(false);
          return;
        }
        if (taskOpen) {
          setTaskOpen(false);
          return;
        }
        if (inspectorOpen) {
          setInspectorOpen(false);
          return;
        }
        if (approval) {
          event.preventDefault();
          void socketClient.send(
            "approval.respond",
            { requestId: approval.requestId, allow: false, remember: false },
            approval.taskId,
          );
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
  }, [approval, creating, inspectorOpen, paletteOpen, task, taskOpen]);

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

  async function uploadImages(files: FileList | File[]) {
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

  const requestFiles = useCallback(() => {
    if (task) void socketClient.send("files.tree", {}, task.id);
  }, [task]);

  const hasChanges = tools.some((tool) => tool.toolName === "write" || tool.toolName === "edit");

  const sidebar = (
    <TaskSidebar
      tasks={tasks}
      activeTaskId={activeTaskId}
      query={query}
      onQuery={setQuery}
      onSelect={(id) => void selectTask(id)}
      onArchive={(id) => void socketClient.send("task.archive", {}, id)}
      onNew={() => {
        setTaskOpen(false);
        setCreating(true);
      }}
    />
  );

  return (
    <div className="relative flex h-dvh overflow-hidden bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        跳到正文
      </a>
      <div className="hidden md:flex">{sidebar}</div>
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <header className="titlebar app-drag flex items-center gap-2 border-b border-line px-3">
          <button
            type="button"
            className="pressable app-no-drag hover-fill inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink md:hidden"
            onClick={() => setTaskOpen(true)}
          >
            <MessageSquare size={14} />
            会话
          </button>
          <button
            type="button"
            className="pressable app-no-drag icon-btn md:hidden"
            aria-label="新对话"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} />
          </button>
          <PiStatusRing status={status} size={18} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium tracking-tight text-ink">{task?.title ?? "还没有对话"}</p>
            <p className="hidden truncate text-[11px] text-mute sm:block">
              {task ? `${folderName(task.cwd)} · ${nextHint(status, true)}` : nextHint(status, false)}
            </p>
          </div>
          {resources && (resources.agentsFiles.length > 0 || resources.skills.length > 0) ? (
            <p className="chip app-no-drag hidden max-w-[220px] truncate lg:inline-flex">
              {resources.agentsFiles.some((item) => item.kind === "agents")
                ? "已加载 AGENTS.md"
                : "已加载上下文文件"}
              {resources.skills.length ? ` · ${resources.skills.length} 个技能` : ""}
            </p>
          ) : null}
          {task ? (
            <div className="app-no-drag hidden sm:block">
              <ContextMeter
                stats={stats}
                runtime={runtime}
                compact
                messageCount={messages.length}
                toolCount={tools.length}
                onRefresh={() => void socketClient.send("session.stats", {}, task.id)}
                onCompact={(customInstructions) =>
                  void socketClient.send("session.compact", { customInstructions }, task.id)
                }
                onRuntimeSet={(payload) => void socketClient.send("runtime.set", payload, task.id)}
              />
            </div>
          ) : null}
          <div className="app-no-drag flex items-center gap-0.5">
            <ThemeToggle />
            <button
              type="button"
              className="pressable icon-btn"
              aria-label="详情"
              onClick={() => setInspectorOpen(true)}
            >
              <PanelRight size={15} />
            </button>
            <Link to="/settings" aria-label="设置" className="pressable icon-btn">
              <Settings size={15} />
            </Link>
          </div>
        </header>
        <RunStatusBar status={status} tools={tools} hasChanges={hasChanges} runtime={runtime} />
        {!piAvailable ? (
          <div className="banner-note text-danger">
            {piError ?? "AI 引擎还没准备好。打开设置完成安装。"}
          </div>
        ) : null}
        {connection !== "open" ? (
          <div className="banner-note text-mute">
            {connection === "connecting" ? "正在重新连接…" : "已断开，正在尝试重连"}
          </div>
        ) : null}
        {authHint || serverError || requestError || notice ? (
          <div className="banner-note text-mute">
            {notice
              ? notice
              : authHint
                ? "还没有 AI 密钥。打开设置粘贴 API Key，密钥只会保存在这台电脑上。"
                : (serverError ?? requestError)}
          </div>
        ) : null}
        {otherApproval ? (
          <div className="banner-note text-ink">
            另一个会话在等待确认。
            <button
              type="button"
              className="pressable app-no-drag text-accent"
              onClick={() => void selectTask(otherApproval.taskId)}
            >
              去处理
            </button>
          </div>
        ) : null}
        <main id="main-content" className="min-h-0 min-w-[0] flex-1 overflow-y-auto overscroll-y-contain">
          {task ? (
            <ConversationTimeline
              messages={messages}
              tools={tools}
              canRewrite={status === "idle" || status === "stopped"}
              onRetry={(messageId, text) =>
                void socketClient.send("session.fork", { messageId, message: text }, task.id)
              }
              onClone={() => void socketClient.send("session.clone", {}, task.id)}
            />
          ) : (
            <div className="mx-auto flex h-full max-w-[420px] flex-col items-center justify-center px-6 pb-16 text-center">
              <p className="text-[28px] font-semibold tracking-tight text-ink">你好，我是墨问</p>
              <p className="mt-3 text-[13px] leading-6 text-mute">
                在这台电脑上和 AI 聊天。它可以帮助看文件、改代码，改之前会先问你。
              </p>
              <button
                type="button"
                className="pressable btn btn-primary mt-7"
                onClick={() => setCreating(true)}
              >
                开始对话
              </button>
            </div>
          )}
        </main>
        {approval ? (
          <div className="dialog-scrim z-[60]" role="presentation">
            <ApprovalSheet
              approval={approval}
              onRespond={(allow, remember) =>
                void socketClient.send(
                  "approval.respond",
                  { requestId: approval.requestId, allow, remember },
                  approval.taskId,
                )
              }
            />
          </div>
        ) : null}
        {task ? (
          <PromptComposer
            status={status}
            disabled={connection !== "open" || Boolean(approval)}
            models={models}
            thinkingLevels={thinkingLevels}
            modelId={task.model ? `${task.model.provider}/${task.model.id}` : null}
            thinkingLevel={task.thinkingLevel ?? "off"}
            mode={task.mode ?? "agent"}
            approvalPolicy={task.approvalPolicy ?? "auto"}
            files={files}
            commands={commands}
            hasTurns={messages.some((item) => item.role === "user")}
            value={draft}
            onChange={setDraft}
            onSend={() => void sendPrompt()}
            onSteer={() => {
              const text = draft;
              const images = imageIds;
              setDraft("");
              setImageIds([]);
              void socketClient.send("prompt.steer", { message: text, imageIds: images }, task.id);
            }}
            onFollowUp={() => void sendPrompt()}
            onAbort={() => void socketClient.send("agent.abort", {}, task.id)}
            onModel={(provider, modelId) =>
              void socketClient.send("model.set", { provider, modelId }, task.id)
            }
            onThinking={(level: ThinkingLevel) =>
              void socketClient.send("thinking.set", { level }, task.id)
            }
            onPolicy={(nextMode: InteractionMode, nextPolicy: ApprovalPolicy) =>
              void socketClient.send("task.policy.set", { mode: nextMode, approvalPolicy: nextPolicy }, task.id)
            }
            onImages={(files) => void uploadImages(files)}
            onNeedFiles={requestFiles}
            imageCount={imageIds.length}
          />
        ) : null}
      </div>

      {taskOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-canvas/50 backdrop-blur-sm"
            aria-label="关闭会话列表"
            onClick={() => setTaskOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-40 shadow-dialog">
            <TaskSidebar
              tasks={tasks}
              activeTaskId={activeTaskId}
              query={query}
              onQuery={setQuery}
              onSelect={(id) => void selectTask(id)}
              onArchive={(id) => void socketClient.send("task.archive", {}, id)}
              onNew={() => {
                setTaskOpen(false);
                setCreating(true);
              }}
              onClose={() => setTaskOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {inspectorOpen ? (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            className="absolute inset-0 bg-canvas/40 backdrop-blur-[2px]"
            aria-label="关闭详情"
            onClick={() => setInspectorOpen(false)}
          />
          <div className="slide-in-right absolute inset-y-0 right-0 z-40 w-[360px] max-w-full">
            <InspectorPanel
              drawer
              tools={tools}
              stats={stats}
              files={files}
              preview={preview}
              git={git}
              checkpoints={checkpoints}
              sessionTree={sessionTree}
              sessionLeafId={sessionLeafId}
              resources={resources}
              onClose={() => setInspectorOpen(false)}
              onLoadTree={() => task && void socketClient.send("files.tree", {}, task.id)}
              onReadFile={(path) => task && void socketClient.send("files.read", { path }, task.id)}
              onLoadGit={() => {
                if (!task) return;
                void socketClient.send("git.status", {}, task.id);
                void socketClient.send("checkpoint.list", {}, task.id);
              }}
              onRestore={(checkpointId) =>
                task && void socketClient.send("checkpoint.restore", { checkpointId }, task.id)
              }
              onLoadBranch={() => task && void socketClient.send("session.tree", {}, task.id)}
              onBranch={(entryId) => task && void socketClient.send("session.branch", { entryId }, task.id)}
              onLoadResources={() => task && void socketClient.send("resources.list", {}, task.id)}
              onExport={() => {
                if (!task) return;
                void socketClient
                  .send<{ path: string }>("session.export", {}, task.id)
                  .then((result) => setNotice(`已导出到 ${result.path}`))
                  .catch((error: unknown) =>
                    setNotice(error instanceof Error ? error.message : "导出失败"),
                  );
              }}
              onCompact={(customInstructions) =>
                task && void socketClient.send("session.compact", { customInstructions }, task.id)
              }
            />
          </div>
        </div>
      ) : null}

      {paletteOpen ? (
        <CommandPalette open onClose={() => setPaletteOpen(false)} onNewTask={() => setCreating(true)} />
      ) : null}
      {creating ? (
        <NewTaskDialog
          defaultCwd={cwd || workspaceRoot || allowedRoots[0] || ""}
          sessions={piSessions}
          onCancel={() => setCreating(false)}
          onCreate={(directory, title) => {
            setCwd(directory);
            setCreating(false);
            void socketClient.send("task.create", { cwd: directory, title });
          }}
          onResume={(session) => {
            setCreating(false);
            void socketClient.send("session.resume", {
              sessionPath: session.path,
              cwd: session.cwd ?? (cwd || workspaceRoot || allowedRoots[0]),
              title: session.name || session.preview,
            });
          }}
        />
      ) : null}
    </div>
  );
}
