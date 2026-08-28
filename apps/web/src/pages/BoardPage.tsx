import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Settings } from "lucide-react";
import { WorkBoard } from "../components/board/WorkBoard";
import { NewWorkItemDialog } from "../components/board/NewWorkItemDialog";
import { NewWorkProjectDialog } from "../components/board/NewWorkProjectDialog";
import { ConfirmWorkDialog } from "../components/board/ConfirmWorkDialog";
import { ModeSwitcher } from "../components/app/ModeSwitcher";
import { ThemeToggle } from "../components/status/ThemeToggle";
import { ApprovalSheet } from "../components/approval/ApprovalSheet";
import { InteractionSheet } from "../components/interaction/InteractionSheet";
import { useAgentStore } from "../stores/agent-store";
import { socketClient } from "../transport/socket-client";
import { BOARD_SHOW_ARCHIVED_KEY, readUiFlag, writeUiFlag } from "../lib/ui-prefs";
import { folderName } from "../copy";
import {
  workItemMoveCloses,
  workItemMoveStartsRun,
  type WorkItem,
  type WorkItemColumn,
} from "@mowen/protocol";

export function BoardPage() {
  const items = useAgentStore((state) => state.workItems);
  const projects = useAgentStore((state) => state.workProjects);
  const activeProjectId = useAgentStore((state) => state.activeProjectId);
  const tasks = useAgentStore((state) => state.tasks);
  const pendingApprovals = useAgentStore((state) => state.pendingApprovals);
  const pendingInteractions = useAgentStore((state) => state.pendingInteractions);
  const workspaceRoot = useAgentStore((state) => state.workspaceRoot);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(() => readUiFlag(BOARD_SHOW_ARCHIVED_KEY, false));
  const [pendingConfirm, setPendingConfirm] = useState<{
    id: string;
    column: WorkItemColumn;
    beforeId?: string | null;
    title: string;
    kind: "start" | "close";
  } | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusItemId = searchParams.get("item");
  const defaultCwd = workspaceRoot ?? allowedRoots[0] ?? "";
  const project = useMemo(
    () => projects.find((entry) => entry.id === activeProjectId) ?? projects[0],
    [projects, activeProjectId],
  );
  const projectItems = useMemo(
    () => (project ? items.filter((item) => item.projectId === project.id) : []),
    [items, project],
  );
  const workTaskIds = useMemo(
    () => new Set(projectItems.map((item) => item.taskId).filter((id): id is string => Boolean(id))),
    [projectItems],
  );
  const approval = pendingApprovals.find((entry) => workTaskIds.has(entry.taskId)) ?? null;
  const interaction = pendingInteractions.find((entry) => workTaskIds.has(entry.taskId)) ?? null;

  useEffect(() => {
    void socketClient.send("workItem.list").catch(() => undefined);
  }, []);

  useEffect(() => {
    writeUiFlag(BOARD_SHOW_ARCHIVED_KEY, showArchived);
  }, [showArchived]);

  function moveItem(id: string, column: WorkItemColumn, beforeId?: string | null) {
    void socketClient
      .send("workItem.move", { id, column, beforeId: beforeId ?? null })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "移动任务失败");
      });
  }

  function requestMove(id: string, column: WorkItemColumn, beforeId?: string | null) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    if (workItemMoveStartsRun(item.column, column)) {
      setPendingConfirm({ id, column, beforeId, title: item.title, kind: "start" });
      return;
    }
    if (workItemMoveCloses(item.column, column)) {
      setPendingConfirm({ id, column, beforeId, title: item.title, kind: "close" });
      return;
    }
    moveItem(id, column, beforeId);
  }

  function updateItem(id: string, title: string, description: string) {
    void socketClient
      .send("workItem.update", { id, title, description })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "更新任务失败");
      });
  }

  function appendItem(id: string, text: string) {
    void socketClient
      .send("workItem.append", { id, text })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "追加失败");
      });
  }

  function openConversation(item: WorkItem) {
    if (item.taskId) {
      void socketClient.send("task.activate", {}, item.taskId).catch(() => undefined);
    }
    navigate("/");
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        跳到正文
      </a>
      <header className="titlebar app-drag traffic-inline flex items-center gap-2 border-b border-line px-3">
        <ModeSwitcher />
        {projects.length > 0 ? (
          <label className="app-no-drag min-w-0 flex-1">
            <span className="sr-only">当前项目</span>
            <select
              className="field h-7 w-full max-w-[220px] px-1.5 text-[13px] font-semibold"
              value={project?.id ?? ""}
              onChange={(event) => {
                void socketClient.send("workProject.select", { id: event.target.value }).catch((error: unknown) => {
                  setNotice(error instanceof Error ? error.message : "切换项目失败");
                });
              }}
            >
              {projects.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">工作</h1>
        )}
        <button
          type="button"
          className="pressable app-no-drag btn btn-ghost h-7"
          onClick={() => setCreatingProject(true)}
        >
          新项目
        </button>
        {project ? (
          <>
            <button
              type="button"
              className="pressable app-no-drag btn btn-ghost h-7"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((value) => !value)}
            >
              {showArchived ? "隐藏归档" : "显示归档"}
            </button>
            <button
              type="button"
              className="pressable app-no-drag btn btn-primary h-7"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} />
              新建任务
            </button>
          </>
        ) : null}
        <div className="app-no-drag flex items-center gap-0.5">
          <ThemeToggle />
          <Link to="/settings" aria-label="设置" className="pressable icon-btn">
            <Settings size={15} />
          </Link>
        </div>
      </header>
      {notice ? <div className="banner-note text-danger">{notice}</div> : null}
      <main id="main-content" className="flex min-h-0 flex-1 flex-col">
        {project ? (
          <>
            <p className="px-4 pt-3 text-[12px] text-mute">
              {folderName(project.cwd)} · 在这个项目里创建任务并追加内容，直到闭环。对话适合单次提问。
            </p>
            <WorkBoard
              items={projectItems}
              tasks={tasks}
              pendingApprovals={pendingApprovals}
              pendingInteractions={pendingInteractions}
              showArchived={showArchived}
              focusItemId={focusItemId}
              onMove={requestMove}
              onUpdate={updateItem}
              onAppend={appendItem}
              onOpenConversation={openConversation}
            />
          </>
        ) : (
          <div className="mx-auto flex h-full max-w-[420px] flex-col items-center justify-center px-6 pb-16 text-center">
            <p className="text-[22px] font-semibold tracking-tight text-ink">从启动一个项目开始</p>
            <p className="mt-3 text-[13px] leading-6 text-mute">
              工作是长期推进：选文件夹、建任务、执行、追加，直到闭环。单次提问请用「对话」。
            </p>
            <button
              type="button"
              className="pressable btn btn-primary mt-7"
              onClick={() => setCreatingProject(true)}
            >
              启动项目
            </button>
          </div>
        )}
      </main>
      {creatingProject ? (
        <NewWorkProjectDialog
          defaultCwd={defaultCwd}
          onCancel={() => setCreatingProject(false)}
          onCreate={(input) => {
            setCreatingProject(false);
            void socketClient
              .send("workProject.create", input)
              .catch((error: unknown) => {
                setNotice(error instanceof Error ? error.message : "启动项目失败");
              });
          }}
        />
      ) : null}
      {creating && project ? (
        <NewWorkItemDialog
          projectName={project.name}
          onCancel={() => setCreating(false)}
          onCreate={(input) => {
            setCreating(false);
            void socketClient
              .send("workItem.create", { ...input, projectId: project.id })
              .catch((error: unknown) => {
                setNotice(error instanceof Error ? error.message : "创建任务失败");
              });
          }}
        />
      ) : null}
      {pendingConfirm ? (
        <ConfirmWorkDialog
          title={
            pendingConfirm.kind === "start"
              ? `开始执行「${pendingConfirm.title}」？`
              : `闭环「${pendingConfirm.title}」？`
          }
          copy={
            pendingConfirm.kind === "start"
              ? "会在这个项目里开一轮执行，并把当前说明发给 AI。之后还可以追加。"
              : "闭环后不能再追加内容。执行记录会保留，但这个任务结束。"
          }
          confirmLabel={pendingConfirm.kind === "start" ? "开始执行" : "完成闭环"}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => {
            moveItem(pendingConfirm.id, pendingConfirm.column, pendingConfirm.beforeId);
            setPendingConfirm(null);
          }}
        />
      ) : null}
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
              void socketClient.send("interaction.respond", payload, interaction.taskId)
            }
          />
        </div>
      ) : null}
    </div>
  );
}
