import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Settings } from "lucide-react";
import type { WorkItemDetails, WorkItemSummary } from "@mowen/protocol";
import { WorkDashboard, type WorkFilter } from "../components/board/WorkDashboard";
import { WorkObjectivePanel } from "../components/board/WorkObjectivePanel";
import { WorkConversationDrawer } from "../components/board/WorkConversationDrawer";
import { NewWorkItemDialog } from "../components/board/NewWorkItemDialog";
import { NewWorkProjectDialog } from "../components/board/NewWorkProjectDialog";
import { ModeSwitcher } from "../components/app/ModeSwitcher";
import { UpdateBanner } from "../components/app/UpdateBanner";
import { ThemeToggle } from "../components/status/ThemeToggle";
import { ApprovalSheet } from "../components/approval/ApprovalSheet";
import { InteractionSheet } from "../components/interaction/InteractionSheet";
import { useAgentStore } from "../stores/agent-store";
import { socketClient } from "../transport/socket-client";
import { folderName } from "../copy";

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
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [query, setQuery] = useState("");
  const [details, setDetails] = useState<WorkItemDetails | null>(null);
  const [conversationItem, setConversationItem] = useState<WorkItemSummary | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const selectedSummary = focusItemId ? items.find((item) => item.id === focusItemId) : undefined;

  useEffect(() => {
    void socketClient.send("workItem.list").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!focusItemId) {
      setDetails(null);
      return;
    }
    let current = true;
    void socketClient
      .send<WorkItemDetails>("workItem.details", { id: focusItemId })
      .then((next) => {
        if (current) setDetails(next);
      })
      .catch((error: unknown) => {
        if (!current) return;
        setNotice(error instanceof Error ? error.message : "读取任务详情失败");
        setDetails(null);
        setSearchParams({});
      });
    return () => {
      current = false;
    };
  }, [focusItemId, selectedSummary?.updatedAt, selectedSummary?.runCount, selectedSummary?.feedbackCount, setSearchParams]);

  function showError(error: unknown, fallback: string) {
    setNotice(error instanceof Error ? error.message : fallback);
  }

  function openDetails(item: WorkItemSummary) {
    setDetails(null);
    setSearchParams({ item: item.id });
  }

  function closeDetails() {
    setDetails(null);
    setSearchParams({});
  }

  function openConversation(item: WorkItemSummary) {
    closeDetails();
    const taskId = item.taskId;
    if (taskId) {
      void socketClient
        .send("task.activate", {}, taskId)
        .then(() => socketClient.send("snapshot.request", { taskId }, taskId))
        .catch(() => undefined);
    }
    setConversationItem(item);
  }

  function openConversationFull(item: WorkItemSummary) {
    if (item.taskId) {
      void socketClient.send("task.activate", {}, item.taskId).catch(() => undefined);
    }
    navigate("/");
  }

  function startItem(id: string) {
    setNotice(null);
    void socketClient.send("workItem.start", { id }).catch((error: unknown) => showError(error, "开始执行失败"));
  }

  function stopItem(id: string) {
    setNotice(null);
    void socketClient.send("workItem.stop", { id }).catch((error: unknown) => showError(error, "停止执行失败"));
  }

  function acceptItem(id: string) {
    setNotice(null);
    void socketClient.send("workItem.accept", { id }).catch((error: unknown) => showError(error, "验收失败"));
  }

  function reopenItem(id: string) {
    setNotice(null);
    void socketClient.send("workItem.reopen", { id }).catch((error: unknown) => showError(error, "重新打开失败"));
  }

  function archiveItem(id: string) {
    setNotice(null);
    if (focusItemId === id) closeDetails();
    void socketClient.send("workItem.archive", { id }).catch((error: unknown) => showError(error, "归档失败"));
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
      <a className="skip-link" href="#main-content">
        跳到正文
      </a>
      <header className="titlebar app-drag traffic-inline work-page-head border-b border-line px-3">
        <ModeSwitcher />
        <div className="work-project-row">
          {projects.length > 0 ? (
            <label className="app-no-drag min-w-0 flex-1">
              <span className="sr-only">当前项目</span>
              <select
                className="field h-7 w-full max-w-[240px] px-1.5 text-[13px] font-semibold"
                value={project?.id ?? ""}
                onChange={(event) => {
                  closeDetails();
                  void socketClient
                    .send("workProject.select", { id: event.target.value })
                    .catch((error: unknown) => showError(error, "切换项目失败"));
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
            <button
              type="button"
              className="pressable app-no-drag btn btn-primary h-7"
              onClick={() => setCreating(true)}
            >
              <Plus size={14} />
              新建任务
            </button>
          ) : null}
        </div>
        <div className="app-no-drag flex items-center gap-0.5">
          <UpdateBanner />
          <ThemeToggle />
          <Link to="/settings" aria-label="设置" className="pressable icon-btn">
            <Settings size={15} />
          </Link>
        </div>
      </header>
      {notice ? (
        <div className="banner-note flex items-center justify-between gap-3 text-danger" role="alert">
          <span>{notice}</span>
          <button type="button" className="pressable btn btn-ghost" onClick={() => setNotice(null)}>
            关闭
          </button>
        </div>
      ) : null}
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto">
        {project ? (
          <div className="mx-auto w-full max-w-[1040px] px-4 pb-12 pt-5">
            <div className="mb-5">
              <h1 className="text-[22px] font-semibold tracking-tight">{project.name}</h1>
              <p className="mt-1 text-[12px] text-mute">{folderName(project.cwd)}</p>
            </div>
            <WorkDashboard
              items={projectItems}
              tasks={tasks}
              pendingApprovals={pendingApprovals}
              pendingInteractions={pendingInteractions}
              filter={filter}
              query={query}
              onQuery={setQuery}
              onFilter={setFilter}
              onSelect={openDetails}
              onStart={startItem}
              onStop={stopItem}
              onAccept={acceptItem}
              onReopen={reopenItem}
              onArchive={archiveItem}
              onOpenConversation={openConversation}
            />
          </div>
        ) : (
          <div className="mx-auto flex h-full max-w-[440px] flex-col items-center justify-center px-6 pb-16 text-center">
            <p className="text-[22px] font-semibold tracking-tight text-ink">启动一个项目</p>
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
            void socketClient.send("workProject.create", input).catch((error: unknown) => showError(error, "启动项目失败"));
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
              .catch((error: unknown) => showError(error, "创建任务失败"));
          }}
        />
      ) : null}
      {conversationItem ? (
        <WorkConversationDrawer
          item={conversationItem}
          onClose={() => setConversationItem(null)}
          onOpenFull={() => openConversationFull(conversationItem)}
        />
      ) : null}
      {focusItemId && details ? (
        <WorkObjectivePanel
          details={details}
          onClose={closeDetails}
          onSave={(input) => {
            void socketClient
              .send("workItem.update", { id: focusItemId, ...input })
              .catch((error: unknown) => showError(error, "更新任务失败"));
          }}
          onFeedback={(text) => {
            void socketClient
              .send("workItem.feedback", { id: focusItemId, text })
              .then(() => closeDetails())
              .catch((error: unknown) => showError(error, "继续执行失败"));
          }}
          onAccept={() => acceptItem(focusItemId)}
          onReopen={() => reopenItem(focusItemId)}
          onOpenConversation={() => {
            if (selectedSummary) openConversation(selectedSummary);
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
