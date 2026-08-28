import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, LayoutGrid, Plus, Settings } from "lucide-react";
import { WorkBoard } from "../components/board/WorkBoard";
import { NewWorkItemDialog } from "../components/board/NewWorkItemDialog";
import { ThemeToggle } from "../components/status/ThemeToggle";
import { useAgentStore } from "../stores/agent-store";
import { socketClient } from "../transport/socket-client";
import type { WorkItem, WorkItemColumn } from "@mowen/protocol";

export function BoardPage() {
  const items = useAgentStore((state) => state.workItems);
  const tasks = useAgentStore((state) => state.tasks);
  const workspaceRoot = useAgentStore((state) => state.workspaceRoot);
  const allowedRoots = useAgentStore((state) => state.allowedRoots);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const defaultCwd = workspaceRoot ?? allowedRoots[0] ?? "";

  useEffect(() => {
    void socketClient.send("workItem.list").catch(() => undefined);
  }, []);

  function moveItem(id: string, column: WorkItemColumn, beforeId?: string | null) {
    void socketClient
      .send("workItem.move", { id, column, beforeId: beforeId ?? null })
      .catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "移动工作项失败");
      });
  }

  function openItem(item: WorkItem) {
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
        <Link
          to="/"
          className="pressable app-no-drag inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] text-accent"
        >
          <ChevronLeft size={16} />
          返回对话
        </Link>
        <LayoutGrid size={14} className="text-mute" />
        <h1 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">看板</h1>
        <button
          type="button"
          className="pressable app-no-drag btn btn-primary h-7"
          onClick={() => setCreating(true)}
        >
          <Plus size={14} />
          新建工作项
        </button>
        <div className="app-no-drag flex items-center gap-0.5">
          <ThemeToggle />
          <Link to="/settings" aria-label="设置" className="pressable icon-btn">
            <Settings size={15} />
          </Link>
        </div>
      </header>
      {notice ? <div className="banner-note text-danger">{notice}</div> : null}
      <main id="main-content" className="flex min-h-0 flex-1 flex-col">
        <p className="px-4 pt-3 text-[12px] text-mute">把工作项拖到「执行」，墨问会自动开一个对话并开始做。</p>
        <WorkBoard items={items} tasks={tasks} onMove={moveItem} onOpen={openItem} />
      </main>
      {creating ? (
        <NewWorkItemDialog
          defaultCwd={defaultCwd}
          onCancel={() => setCreating(false)}
          onCreate={(input) => {
            setCreating(false);
            void socketClient
              .send("workItem.create", input)
              .catch((error: unknown) => {
                setNotice(error instanceof Error ? error.message : "创建工作项失败");
              });
          }}
        />
      ) : null}
    </div>
  );
}
