import { Archive, Search } from "lucide-react";
import type { TaskRecord } from "@ohmypi/protocol";
import { PiStatusRing } from "../status/PiStatusRing";

type Props = {
  tasks: TaskRecord[];
  activeTaskId: string | null;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (taskId: string) => void;
  onArchive: (taskId: string) => void;
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

function statusLabel(task: TaskRecord): string {
  return task.status.replaceAll("_", " ");
}

export function TaskSidebar({ tasks, activeTaskId, query, onQuery, onSelect, onArchive }: Props) {
  const filtered = tasks.filter((task) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return task.title.toLowerCase().includes(q) || task.cwd.toLowerCase().includes(q);
  });
  const groups = groupByProject(filtered);

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-line bg-sidebar">
      <div className="flex h-[52px] items-center gap-2 border-b border-line px-3">
        <Search size={14} className="text-mute" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search tasks"
          aria-label="Search tasks"
          className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-mute"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groups.length === 0 ? (
          <p className="px-2 py-4 text-sm text-mute">No tasks yet. Create one to start a Pi session.</p>
        ) : (
          groups.map(([cwd, items]) => (
            <section key={cwd} className="mb-4">
              <h2 className="truncate px-2 pb-1 font-mono text-[11px] tracking-wide text-mute uppercase" title={cwd}>
                {cwd.split("/").filter(Boolean).at(-1) ?? cwd}
              </h2>
              <ul>
                {items.map((task) => {
                  const active = task.id === activeTaskId;
                  return (
                    <li key={task.id}>
                      <div
                        className={`group flex items-start gap-2 rounded-md px-1 ${active ? "bg-elevated" : "hover:bg-surface"}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(task.id)}
                          className="pressable flex min-h-10 min-w-0 flex-1 items-center gap-2 py-1 text-left"
                        >
                          <PiStatusRing status={task.status} size={18} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{task.title}</span>
                            <span className="block truncate font-mono text-[11px] text-mute tabular">
                              {statusLabel(task)}
                            </span>
                          </span>
                          {task.unreadCount > 0 && !active ? (
                            <span className="rounded-pill bg-accent px-1.5 font-mono text-[10px] text-canvas tabular">
                              {task.unreadCount}
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="pressable mt-1 flex h-10 w-10 items-center justify-center text-mute hover:text-ink"
                          aria-label={`Archive ${task.title}`}
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
