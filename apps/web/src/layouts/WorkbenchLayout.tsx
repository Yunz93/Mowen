import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, MessageSquare, PanelRight, Settings } from "lucide-react";
import { TaskSidebar } from "../components/tasks/TaskSidebar";
import { ConversationTimeline } from "../components/timeline/ConversationTimeline";
import { PromptComposer } from "../components/composer/PromptComposer";
import { InspectorPanel } from "../components/inspector/InspectorPanel";
import { ApprovalSheet } from "../components/approval/ApprovalSheet";
import { PiStatusRing } from "../components/status/PiStatusRing";
import { ThemeToggle } from "../components/status/ThemeToggle";
import { useAgentStore } from "../stores/agent-store";
import { socketClient } from "../transport/socket-client";
import { CommandPalette } from "../components/command-palette/CommandPalette";
import { NewTaskDialog } from "../components/tasks/NewTaskDialog";
import type { ThinkingLevel } from "@ohmypi/protocol";
import { folderName, nextHint } from "../copy";

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
  const workspaceRoot = useAgentStore((state) => state.workspaceRoot);

  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [cwd, setCwd] = useState(workspaceRoot ?? allowedRoots[0] ?? "");
  const [creating, setCreating] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  useEffect(() => {
    const preferred = workspaceRoot ?? allowedRoots[0];
    if (preferred && !cwd) setCwd(preferred);
  }, [allowedRoots, workspaceRoot, cwd]);

  const task = useMemo(
    () => tasks.find((item) => item.id === activeTaskId),
    [tasks, activeTaskId],
  );
  const status = task?.status ?? "stopped";

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
  }, [creating, inspectorOpen, paletteOpen, task, taskOpen]);

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
    <div className="relative flex h-dvh bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        跳到正文
      </a>
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex h-12 items-center gap-2 border-b border-line px-3 sm:px-4">
          <button
            type="button"
            className="pressable hover-fill inline-flex h-10 items-center gap-2 rounded-sm px-3 text-sm text-ink"
            onClick={() => setTaskOpen(true)}
          >
            <MessageSquare size={16} />
            会话
          </button>
          <button
            type="button"
            className="pressable icon-btn"
            aria-label="新对话"
            onClick={() => setCreating(true)}
          >
            <FolderOpen size={16} />
          </button>
          <PiStatusRing status={status} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{task?.title ?? "还没有对话"}</p>
            <p className="hidden truncate text-[12px] text-mute sm:block">
              {task ? `${folderName(task.cwd)} · ${nextHint(status, true)}` : nextHint(status, false)}
            </p>
          </div>
          <ThemeToggle />
          <button
            type="button"
            className="pressable icon-btn"
            aria-label="详情"
            onClick={() => setInspectorOpen(true)}
          >
            <PanelRight size={16} />
          </button>
          <Link
            to="/settings"
            aria-label="设置"
            className="pressable icon-btn"
          >
            <Settings size={16} />
          </Link>
        </header>
        {!piAvailable ? (
          <div className="border-b border-danger/40 bg-elevated px-4 py-2 text-sm text-danger">
            {piError ?? "AI 引擎还没准备好。打开设置完成安装。"}
          </div>
        ) : null}
        {connection !== "open" ? (
          <div className="border-b border-line bg-elevated px-4 py-2 text-sm text-mute">
            {connection === "connecting" ? "正在重新连接…" : "已断开，正在尝试重连"}
          </div>
        ) : null}
        {authHint || serverError || requestError ? (
          <div className="border-b border-line bg-elevated px-4 py-2 text-sm text-mute">
            {authHint ? "还没有 AI 密钥。打开设置粘贴 API Key，密钥只会保存在这台电脑上。" : (serverError ?? requestError)}
          </div>
        ) : null}
        <main id="main-content" className="min-h-0 min-w-[0] flex-1 overflow-y-auto">
          {task ? (
            <ConversationTimeline messages={messages} tools={tools} />
          ) : (
            <div className="mx-auto flex max-w-[520px] flex-col items-center px-6 pt-24 text-center">
              <p className="text-xl text-ink">你好，我是 ohMyPi</p>
              <p className="mt-3 text-sm leading-6 text-mute">
                在这台电脑上和 AI 聊天。它可以帮助看文件、改代码，改之前会先问你。
              </p>
              <button
                type="button"
                className="pressable btn btn-primary mt-6"
                onClick={() => setCreating(true)}
              >
                开始对话
              </button>
            </div>
          )}
        </main>
        {approval ? (
          <div className="mx-auto w-full max-w-[720px] px-4">
            <ApprovalSheet
              approval={approval}
              onRespond={(allow) =>
                void socketClient.send(
                  "approval.respond",
                  { requestId: approval.requestId, allow },
                  approval.taskId,
                )
              }
            />
          </div>
        ) : null}
        <PromptComposer
          status={status}
          disabled={!task || connection !== "open"}
          models={models}
          thinkingLevels={thinkingLevels}
          modelId={task?.model ? `${task.model.provider}/${task.model.id}` : null}
          thinkingLevel={task?.thinkingLevel ?? "off"}
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
          onImages={(files) => void uploadImages(files)}
          imageCount={imageIds.length}
        />
      </div>

      {taskOpen ? (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            className="absolute inset-0 bg-canvas/70"
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
            className="absolute inset-0 bg-canvas/70"
            aria-label="关闭详情"
            onClick={() => setInspectorOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 z-40">
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
          onCancel={() => setCreating(false)}
          onCreate={(directory, title) => {
            setCwd(directory);
            setCreating(false);
            void socketClient.send("task.create", { cwd: directory, title });
          }}
        />
      ) : null}
    </div>
  );
}
