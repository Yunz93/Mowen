import type { TaskRecord } from "@qingzhou/protocol";

export function groupTasksByProject(tasks: TaskRecord[]): Array<[string, TaskRecord[]]> {
  const groups = new Map<string, TaskRecord[]>();
  for (const task of tasks) {
    const list = groups.get(task.cwd) ?? [];
    list.push(task);
    groups.set(task.cwd, list);
  }
  return [...groups.entries()];
}

/** Same order as the session sidebar: project groups, then array order inside each. */
export function tasksInSidebarOrder(tasks: TaskRecord[]): TaskRecord[] {
  return groupTasksByProject(tasks).flatMap(([, items]) => items);
}

export function moveTaskInGroup(ids: string[], fromId: string, toId: string): string[] | null {
  if (fromId === toId) return null;
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0) return null;
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  if (!moved) return null;
  next.splice(to, 0, moved);
  return next;
}
