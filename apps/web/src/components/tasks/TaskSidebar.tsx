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
    <aside className="flex h-full w-[min(320px,90vw)] shrink-0 flex-col border-r border-line bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-line px-3">
        <p className="flex-1 text-sm text-ink">会话</p>
        {onNew ? (
          <button
            type="button"
            className="pressable icon-btn"
            aria-label="新对话"
            onClick={onNew}
          >
            <Plus size={16} />
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            className="pressable icon-btn"
            aria-label="关闭会话列表"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
      <div className="flex h-12 items-center gap-2 border-b border-line px-3">
        <Search size={14} className="text-mute" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="搜索会话"
          aria-label="搜索会话"
          className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-mute"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-sm text-mute">还没有会话。点右上角开始一个新对话。</p>
        ) : (
          groups.map(([cwd, items]) => (
            <section key={cwd} className="mb-4">
              <h2 className="truncate px-2 pb-1 text-[12px] text-mute" title={cwd}>
                {folderName(cwd)}
              </h2>
              <ul>
                {items.map((task) => {
                  const active = task.id === activeTaskId;
                  return (
                    <li key={task.id}>
                      <div
                        className={`group flex items-start gap-2 rounded-sm px-1 ${active ? "bg-fill" : "hover-fill"}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(task.id)}
                          className="pressable flex min-h-10 min-w-0 flex-1 items-center gap-2 py-1 text-left"
                        >
                          <PiStatusRing status={task.status} size={18} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{task.title}</span>
                            <span className="block truncate text-[12px] text-mute">
                              {taskStatusLabel(task.status)}
                            </span>
                          </span>
                          {task.unreadCount > 0 && !active ? (
                            <span className="rounded-pill bg-accent px-1.5 text-[10px] text-snow">
                              {task.unreadCount}
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="pressable mt-1 flex h-10 w-10 items-center justify-center text-mute hover:text-ink"
                          aria-label={`归档 ${task.title}`}
                          onClick={() => onArchive(task.id)}
                        >
                          <Archive size={14} />
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
