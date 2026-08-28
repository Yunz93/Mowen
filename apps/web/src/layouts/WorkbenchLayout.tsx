import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, PanelRight, Plus, Settings } from "lucide-react";
import { TaskSidebar } from "../components/tasks/TaskSidebar";
import { ConversationTimeline } from "../components/timeline/ConversationTimeline";
import { PromptComposer, type ComposerImage } from "../components/composer/PromptComposer";
import { InspectorPanel } from "../components/inspector/InspectorPanel";
import { ApprovalSheet } from "../components/approval/ApprovalSheet";
import { InteractionSheet } from "../components/interaction/InteractionSheet";
import { PiStatusRing } from "../components/status/PiStatusRing";
import { ThemeToggle } from "../components/status/ThemeToggle";
import { ContextMeter } from "../components/status/ContextMeter";
import { RunStatusBar } from "../components/status/RunStatusBar";
import { useAgentStore } from "../stores/agent-store";
import { socketClient } from "../transport/socket-client";
import { CommandPalette } from "../components/command-palette/CommandPalette";
import { NewTaskDialog } from "../components/tasks/NewTaskDialog";
import type { ApprovalPolicy, InteractionMode, ThinkingLevel } from "@mowen/protocol";
import { stripModePrefix } from "@mowen/protocol";
import { headerSubtitle } from "../copy";
import { OPEN_CONVERSATION_SEARCH_EVENT } from "../lib/conversation-search";
import { openExportedFile } from "../lib/open-export";
import { showOsNotification } from "../lib/notify";
import { getDesktop } from "../desktop-bridge";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  INSPECTOR_OPEN_KEY,
  LEFT_PINNED_KEY,
  RIGHT_PINNED_KEY,
  readUiFlag,
  writeUiFlag,
} from "../lib/ui-prefs";

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
  const gitDiff = useAgentStore((state) => state.gitDiff);
  const runtime = useAgentStore((state) => state.runtime);
  const resources = useAgentStore((state) => state.resources);
  const piSessions = useAgentStore((state) => state.piSessions);
  const piError = useAgentStore((state) => state.piError);
  const piAvailable = useAgentStore((state) => state.piAvailable);
  const authHint = useAgentStore((state) => state.authHint);
  const serverError = useAgentStore((state) => state.serverError);
  const requestError = useAgentStore((state) => state.requestError);
  const connection = useAgentStore((state) => state.connection);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);
  const workspaceRoot = useAgentStore((state) => state.workspaceRoot);
  const pendingInteractions = useAgentStore((state) => state.pendingInteractions);
  const toast = useAgentStore((state) => state.toast);
  const devSelfWorkspace = useAgentStore((state) => state.devSelfWorkspace);

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [cwd, setCwd] = useState(workspaceRoot ?? allowedRoots[0] ?? "");
  const [creating, setCreating] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [composerImages, setComposerImages] = useState<ComposerImage[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [leftPinned, setLeftPinned] = useState(() => readUiFlag(LEFT_PINNED_KEY, true));
  const [rightPinned, setRightPinned] = useState(() => readUiFlag(RIGHT_PINNED_KEY, false));
  const [inspectorOpen, setInspectorOpen] = useState(
    () => readUiFlag(RIGHT_PINNED_KEY, false) && readUiFlag(INSPECTOR_OPEN_KEY, false),
  );
  const isMd = useMediaQuery("(min-width: 768px)");
  const dockLeft = leftPinned && isMd;
  const dockRight = rightPinned && inspectorOpen && isMd;
  const overlayLeft = taskOpen && !dockLeft;
  const overlayRight = inspectorOpen && !dockRight;
  const [notice, setNotice] = useState("");
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const skipTitleCommitRef = useRef(false);
  const composerImagesRef = useRef(composerImages);
  composerImagesRef.current = composerImages;
  const [retryPrompt, setRetryPrompt] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const item of composerImagesRef.current) URL.revokeObjectURL(item.previewUrl);
    };
  }, []);

  useEffect(() => {
    const preferred = workspaceRoot ?? allowedRoots[0];
    if (preferred && !cwd) setCwd(preferred);
  }, [allowedRoots, workspaceRoot, cwd]);

  useEffect(() => {
    if (connection !== "open" || !activeTaskId) return;
    let cancelled = false;
    void (async () => {
      try {
        await socketClient.send("task.activate", {}, activeTaskId);
        if (cancelled) return;
        await socketClient.send("snapshot.request", { taskId: activeTaskId }, activeTaskId);
      } catch {
        // Boot errors surface via task status / server.error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connection, activeTaskId]);

  useEffect(() => {
    if (creating) void socketClient.send("sessions.list", {});
  }, [creating]);

  const task = useMemo(
    () => tasks.find((item) => item.id === activeTaskId),
    [tasks, activeTaskId],
  );
  const status = task?.status ?? "stopped";
  const otherApproval = pendingApprovals.find((item) => item.taskId !== activeTaskId);
  const interaction = pendingInteractions.find((item) => item.taskId === activeTaskId) ?? pendingInteractions[0] ?? null;

  useEffect(() => {
    if (!toast?.message) return;
    void showOsNotification("墨问", toast.message, toast.notifyType);
    const timer = window.setTimeout(() => {
      if (useAgentStore.getState().toast === toast) {
        useAgentStore.setState({ toast: null });
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    writeUiFlag(LEFT_PINNED_KEY, leftPinned);
  }, [leftPinned]);

  useEffect(() => {
    writeUiFlag(RIGHT_PINNED_KEY, rightPinned);
  }, [rightPinned]);

  useEffect(() => {
    writeUiFlag(INSPECTOR_OPEN_KEY, inspectorOpen);
  }, [inspectorOpen]);

  function toggleLeftPinned() {
    setLeftPinned((pinned) => {
      const next = !pinned;
      if (next) setTaskOpen(false);
      return next;
    });
  }

  function toggleRightPinned() {
    setRightPinned((pinned) => {
      const next = !pinned;
      if (next) setInspectorOpen(true);
      return next;
    });
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (creating) {
          event.preventDefault();
          setCreating(false);
          return;
        }
        if (editingTitle) {
          event.preventDefault();
          skipTitleCommitRef.current = true;
          setEditingTitle(false);
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
        if (inspectorOpen && !rightPinned) {
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
        if (interaction) {
          event.preventDefault();
          void socketClient.send(
            "interaction.respond",
            { requestId: interaction.requestId, cancelled: true },
            interaction.taskId,
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
  }, [approval, creating, editingTitle, inspectorOpen, interaction, paletteOpen, rightPinned, task, taskOpen]);

  async function renameTask(taskId: string, title: string) {
    const next = title.trim().slice(0, 200);
    const current = tasks.find((item) => item.id === taskId);
    if (!next || next === current?.title) return;
    await socketClient.send("task.rename", { title: next }, taskId);
  }

  async function openExport(filePath: string) {
    try {
      await openExportedFile(filePath);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法打开导出文件");
    }
  }

  async function selectTask(taskId: string) {
    useAgentStore.getState().setActiveTask(taskId);
    await socketClient.send("task.activate", {}, taskId);
    await socketClient.send("snapshot.request", { taskId }, taskId);
    setTaskOpen(false);
  }

  const sendPrompt = async () => {
    if (!task || (!draft.trim() && composerImages.length === 0)) return;
    const text = draft;
    const images = composerImages.map((item) => item.id);
    setDraft("");
    clearComposerImages();
    setRetryPrompt(null);
    if (task.status === "stopped" || task.status === "error") {
      await socketClient.send("task.activate", {}, task.id);
    }
    await socketClient.send("prompt.send", { message: text, imageIds: images }, task.id);
  };

  const sendFollowUp = async () => {
    if (!task || (!draft.trim() && composerImages.length === 0)) return;
    const text = draft;
    const images = composerImages.map((item) => item.id);
    setDraft("");
    clearComposerImages();
    setRetryPrompt(null);
    await socketClient.send("prompt.followUp", { message: text, imageIds: images }, task.id);
  };

  const abortRun = () => {
    if (!task) return;
    const lastUser = [...messages].reverse().find((item) => item.role === "user");
    const text = lastUser ? stripModePrefix(lastUser.text).trim() : draft.trim();
    if (text) setRetryPrompt(text);
    void socketClient.send("agent.abort", {}, task.id);
  };

  async function retryLastPrompt() {
    if (!task || !retryPrompt) return;
    const text = retryPrompt;
    setRetryPrompt(null);
    if (task.status === "stopped" || task.status === "error") {
      await socketClient.send("task.activate", {}, task.id);
    }
    await socketClient.send("prompt.send", { message: text }, task.id);
  }

  async function openProjectFile(filePath: string) {
    if (!task) return;
    try {
      const result = await socketClient.send<{ path: string }>("files.open", { path: filePath }, task.id);
      setInspectorOpen(true);
      const desktop = getDesktop();
      if (desktop?.openPath && result.path) {
        const error = await desktop.openPath(result.path);
        if (error) setNotice(error);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "无法打开文件");
    }
  }

  async function undoProjectFile(filePath: string) {
    if (!task) return;
    try {
      await socketClient.send("checkpoint.restore", { path: filePath }, task.id);
      setNotice(`已撤回 ${filePath}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "撤回失败");
    }
  }

  async function uploadImages(files: FileList | File[]) {
    const next: ComposerImage[] = [];
    for (const file of [...files]) {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/uploads", { method: "POST", credentials: "same-origin", body });
      if (!response.ok) continue;
      const json = (await response.json()) as { id: string };
      next.push({ id: json.id, previewUrl: URL.createObjectURL(file), name: file.name || "图片" });
    }
    if (next.length === 0) return;
    setComposerImages((current) => [...current, ...next]);
  }

  function removeComposerImage(id: string) {
    setComposerImages((current) => {
      const gone = current.find((item) => item.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function clearComposerImages() {
    setComposerImages((current) => {
      for (const item of current) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
  }

  const requestFiles = useCallback(() => {
    if (task) void socketClient.send("files.tree", {}, task.id);
  }, [task]);

  const hasChanges = tools.some((tool) => tool.toolName === "write" || tool.toolName === "edit");

  function renderSidebar(onClose?: () => void) {
    return (
      <TaskSidebar
        tasks={tasks}
        activeTaskId={activeTaskId}
        query={query}
        onQuery={setQuery}
        onSelect={(id) => void selectTask(id)}
        onArchive={(id) => void socketClient.send("task.archive", {}, id)}
        onRename={(id, title) => void renameTask(id, title)}
        pinned={leftPinned}
        onPinToggle={toggleLeftPinned}
        onNew={() => {
          setTaskOpen(false);
          setCreating(true);
        }}
        onClose={onClose}
      />
    );
  }

  function renderInspector(drawer: boolean) {
    return (
      <InspectorPanel
        drawer={drawer}
        pinned={rightPinned}
        onPinToggle={toggleRightPinned}
        taskId={task?.id ?? null}
        cwd={task?.cwd ?? null}
        files={files}
        preview={preview}
        git={git}
        gitDiff={gitDiff}
        resources={resources}
        onClose={() => setInspectorOpen(false)}
        onLoadTree={() => task && void socketClient.send("files.tree", {}, task.id)}
        onReadFile={(path) => task && void socketClient.send("files.read", { path }, task.id)}
        onLoadGit={() => {
          if (!task) return;
          void socketClient.send("git.status", {}, task.id);
        }}
        onGitDiff={() => task && void socketClient.send("git.diff", {}, task.id)}
        onGitCommit={(message, push) =>
          task &&
          void socketClient
            .send("git.commit", { message, push }, task.id)
            .then(() => setNotice(push ? "已提交并推送" : "已提交"))
            .catch((error: unknown) => {
              setNotice(error instanceof Error ? error.message : "提交失败");
            })
        }
        onGitInit={() => {
          if (!task) return;
          void socketClient
            .send("git.init", {}, task.id)
            .then(() => setNotice("已初始化 Git 仓库"))
            .catch((error: unknown) => {
              setNotice(error instanceof Error ? error.message : "git init 失败");
            });
        }}
        onLoadResources={() => task && void socketClient.send("resources.list", {}, task.id)}
        onReloadResources={() => task && void socketClient.send("resources.reload", {}, task.id)}
        onCreateAgents={() => {
          if (!task) return;
          void socketClient
            .send<{ path: string }>("resources.createAgents", {}, task.id)
            .then((result) => {
              setNotice(`已创建 ${result.path}`);
              setInspectorOpen(true);
            })
            .catch((error: unknown) => {
              setNotice(error instanceof Error ? error.message : "创建 AGENTS.md 失败");
            });
        }}
        onReadResource={(filePath) => {
          if (!task) return Promise.reject(new Error("没有对话"));
          return socketClient.send<{ path: string; content: string; truncated: boolean }>(
            "resources.read",
            { path: filePath },
            task.id,
          );
        }}
        onWriteResource={async (filePath, content) => {
          if (!task) throw new Error("没有对话");
          await socketClient.send("resources.write", { path: filePath, content }, task.id);
          setNotice("已保存约定");
        }}
        onToggleSkill={(filePath, enabled) => {
          if (!task) return;
          void socketClient
            .send("resources.skill.set", { path: filePath, enabled }, task.id)
            .catch((error: unknown) => {
              setNotice(error instanceof Error ? error.message : "技能开关失败");
            });
        }}
        lastExportPath={lastExportPath}
        onOpenExport={(filePath) => void openExport(filePath)}
        onExport={() => {
          if (!task) return;
          void socketClient
            .send<{ path: string }>("session.export", {}, task.id)
            .then((result) => {
              setLastExportPath(result.path);
              setNotice(`已导出到 ${result.path}`);
            })
            .catch((error: unknown) =>
              setNotice(error instanceof Error ? error.message : "导出失败"),
            );
        }}
      />
    );
  }

  return (
      <div className="relative flex h-dvh overflow-hidden bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        跳到正文
      </a>
      {dockLeft ? <div className="flex h-full">{renderSidebar()}</div> : null}
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <header className="titlebar app-drag flex items-center gap-2 border-b border-line px-3">
          <button
            type="button"
            className={`pressable app-no-drag hover-fill inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink ${dockLeft ? "md:hidden" : ""}`}
            onClick={() => setTaskOpen(true)}
          >
            <MessageSquare size={14} />
            会话
          </button>
          <button
            type="button"
            className={`pressable app-no-drag icon-btn ${dockLeft ? "md:hidden" : ""}`}
            aria-label="新对话"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} />
          </button>
          <PiStatusRing status={status} size={18} />
          <div className="app-no-drag min-w-0 flex-1">
            {editingTitle && task ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => {
                  const skip = skipTitleCommitRef.current;
                  skipTitleCommitRef.current = false;
                  setEditingTitle(false);
                  if (!skip) void renameTask(task.id, titleDraft);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    skipTitleCommitRef.current = false;
                    setEditingTitle(false);
                    void renameTask(task.id, titleDraft);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    skipTitleCommitRef.current = true;
                    setEditingTitle(false);
                  }
                }}
                aria-label="会话标题"
                className="h-7 w-full max-w-[min(100%,360px)] rounded-md bg-fill-strong px-1.5 text-[13px] font-medium tracking-tight text-ink"
              />
            ) : (
              <p
                className="truncate text-[13px] font-medium tracking-tight text-ink"
                title={task ? "双击重命名" : undefined}
                onDoubleClick={() => {
                  if (!task) return;
                  setTitleDraft(task.title);
                  setEditingTitle(true);
                }}
              >
                {task?.title ?? "还没有对话"}
              </p>
            )}
            <p className="hidden truncate text-[11px] text-mute sm:block">
              {headerSubtitle(task?.cwd, Boolean(task), status)}
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
              aria-pressed={inspectorOpen}
              onClick={() => setInspectorOpen((open) => !open)}
            >
              <PanelRight size={15} />
            </button>
            <Link to="/settings" aria-label="设置" className="pressable icon-btn">
              <Settings size={15} />
            </Link>
          </div>
        </header>
        <RunStatusBar
          status={status}
          tools={tools}
          hasChanges={hasChanges}
          runtime={runtime}
          errorMessage={task?.errorMessage ?? serverError ?? requestError}
        />
        {!piAvailable ? (
          <div className="banner-note text-danger">
            {piError ?? "AI 引擎还没准备好。打开设置完成安装。"}
          </div>
        ) : null}
        {devSelfWorkspace ? (
          <div className="banner-note text-mute">
            当前工作区是墨问源码目录，热重载会中断正在跑的任务。请换文件夹，或用{" "}
            <code className="text-ink">pnpm dev:stable</code>。
          </div>
        ) : null}
        {connection !== "open" ? (
          <div className="banner-note text-mute">
            {connection === "connecting" ? "正在重新连接…" : "已断开，正在尝试重连"}
          </div>
        ) : null}
        {serverError || requestError || task?.errorMessage ? (
          <div className="banner-note whitespace-pre-wrap text-danger">
            {serverError ?? requestError ?? task?.errorMessage}
          </div>
        ) : authHint ? (
          <div className="banner-note text-mute">
            还没有连接 AI。打开设置登录或粘贴密钥，凭证只会保存在这台电脑上。
          </div>
        ) : notice ? (
          <div className="banner-note text-mute">
            <span className="min-w-0 truncate">{notice}</span>
            {lastExportPath ? (
              <button
                type="button"
                className="pressable app-no-drag shrink-0 text-accent"
                onClick={() => void openExport(lastExportPath)}
              >
                打开
              </button>
            ) : null}
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
        {retryPrompt && (status === "idle" || status === "error" || status === "stopped") ? (
          <div className="banner-note text-ink">
            已停止。
            <button type="button" className="pressable app-no-drag text-accent" onClick={() => void retryLastPrompt()}>
              重试上一条
            </button>
          </div>
        ) : null}
        {toast?.message && toast.message !== "回复完成" ? (
          <div
            className={`banner-note ${toast.notifyType === "error" ? "text-danger" : "text-mute"}`}
          >
            {toast.message}
          </div>
        ) : null}
        <main id="main-content" data-conversation-scroll className="min-h-0 min-w-[0] flex-1 overflow-y-auto overscroll-y-contain">
          {task ? (
            <ConversationTimeline
              messages={messages}
              tools={tools}
              canRewrite={status === "idle" || status === "stopped" || status === "error"}
              error={serverError ?? requestError ?? task.errorMessage ?? null}
              onRetry={(messageId, text) =>
                void socketClient.send("session.fork", { messageId, message: text }, task.id)
              }
              onClone={() => void socketClient.send("session.clone", {}, task.id)}
              onOpenFile={(filePath) => void openProjectFile(filePath)}
              onUndoFile={(filePath) => void undoProjectFile(filePath)}
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
        {interaction ? (
          <div className="dialog-scrim z-[60]" role="presentation">
            <InteractionSheet
              interaction={interaction}
              onRespond={(payload) =>
                void socketClient.send(
                  "interaction.respond",
                  { requestId: interaction.requestId, ...payload },
                  interaction.taskId,
                )
              }
            />
          </div>
        ) : null}
        {task ? (
          <PromptComposer
            status={status}
            disabled={connection !== "open" || Boolean(approval) || Boolean(interaction)}
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
              const images = composerImages.map((item) => item.id);
              setDraft("");
              clearComposerImages();
              setRetryPrompt(null);
              void socketClient.send("prompt.steer", { message: text, imageIds: images }, task.id);
            }}
            onFollowUp={() => void sendFollowUp()}
            onAbort={abortRun}
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
            onRemoveImage={removeComposerImage}
            onNeedFiles={requestFiles}
            images={composerImages}
          />
        ) : null}
      </div>

      {dockRight ? <div className="flex h-full w-[360px] shrink-0">{renderInspector(false)}</div> : null}

      {overlayLeft ? (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            className="absolute inset-0 bg-canvas/50 backdrop-blur-sm"
            aria-label="关闭会话列表"
            onClick={() => setTaskOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 z-40 shadow-dialog">{renderSidebar(() => setTaskOpen(false))}</div>
        </div>
      ) : null}

      {overlayRight ? (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            className="absolute inset-0 bg-canvas/40 backdrop-blur-[2px]"
            aria-label="关闭详情"
            onClick={() => setInspectorOpen(false)}
          />
          <div className="slide-in-right absolute inset-y-0 right-0 z-40 w-[360px] max-w-full">{renderInspector(true)}</div>
        </div>
      ) : null}

      {paletteOpen ? (
        <CommandPalette
          open
          onClose={() => setPaletteOpen(false)}
          onNewTask={() => setCreating(true)}
          onRenameSession={
            task
              ? () => {
                  setTitleDraft(task.title);
                  setEditingTitle(true);
                }
              : undefined
          }
          onFindInConversation={() => {
            window.dispatchEvent(new Event(OPEN_CONVERSATION_SEARCH_EVENT));
          }}
        />
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
