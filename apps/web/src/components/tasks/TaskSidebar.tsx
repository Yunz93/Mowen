import { Archive, Plus, Search, X } from "lucide-react";
import type { TaskRecord } from "@mowen/protocol";
import { PiStatusRing } from "../status/PiStatusRing";
import { folderName, taskStatusLabel } from "../../copy";

type Props = {
  tasks: TaskRecord[];
  activeTaskId: string | null;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onNew?: () => void;
  onClose?: () => void;
};

function groupByProject(tasks: TaskRecord[]): Array<[string, TaskRecord[]]> {
  const groups = new Map<string, TaskRecord[]>();
  for (const task of tasks) {
    const key = task.cwd;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export function TaskSidebar({
  tasks,
  activeTaskId,
  query,
  onQuery,
  onSelect,
  onArchive,
  onNew,
  onClose,
}: Props) {
  const filtered = tasks.filter((task) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return task.title.toLowerCase().includes(q) || task.cwd.toLowerCase().includes(q);
  });
  const groups = groupByProject(filtered);

  return (
    <aside className="material-sidebar flex h-full w-[min(244px,90vw)] shrink-0 flex-col border-r border-line" aria-label="会话">
      <div className="traffic-inline app-drag flex h-[52px] items-center gap-1 px-3">
        <p className="flex-1 text-[13px] font-semibold tracking-tight text-ink">会话</p>
        {onNew ? (
          <button
            type="button"
            className="pressable app-no-drag icon-btn"
            aria-label="新对话"
            onClick={onNew}
          >
            <Plus size={15} />
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            className="pressable app-no-drag icon-btn"
            aria-label="关闭会话列表"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        ) : null}
      </div>
      <div className="px-3 pb-2">
        <label className="search-field">
          <Search size={12} className="text-mute" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索"
            aria-label="搜索会话"
            className="h-7 w-full bg-transparent text-[13px] text-ink placeholder:text-mute"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-[12px] leading-5 text-mute">还没有会话。点右上角 + 开始一个新对话。</p>
        ) : (
          groups.map(([cwd, items]) => (
            <section key={cwd} className="mb-3">
              <h2 className="truncate px-2 pb-1 text-[11px] font-medium text-mute" title={cwd}>
                {folderName(cwd)}
              </h2>
              <ul>
                {items.map((task) => {
                  const active = task.id === activeTaskId;
                  return (
                    <li key={task.id}>
                      <div
                        className={`source-item group flex items-start gap-1 px-1 ${active ? "source-item-active" : "hover-fill"}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(task.id)}
                          className="pressable flex min-h-8 min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                        >
                          <PiStatusRing status={task.status} size={14} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-ink">{task.title}</span>
                            <span className="block truncate text-[11px] text-mute">
                              {taskStatusLabel(task.status)}
                            </span>
                          </span>
                          {task.unreadCount > 0 && !active ? (
                            <span className="rounded-pill bg-accent px-1.5 text-[10px] leading-4 text-snow">
                              {task.unreadCount}
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="pressable mt-0.5 flex h-7 w-7 items-center justify-center rounded-md text-mute hover:text-ink"
                          aria-label={`归档 ${task.title}`}
                          onClick={() => onArchive(task.id)}
                        >
                          <Archive size={13} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
