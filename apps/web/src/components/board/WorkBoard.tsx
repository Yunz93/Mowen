import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  WORK_ITEM_COLUMNS,
  type ApprovalRequest,
  type InteractionRequest,
  type TaskRecord,
  type WorkItem,
  type WorkItemColumn,
} from "@mowen/protocol";
import { folderName, taskStatusLabel } from "../../copy";
import { PiStatusRing } from "../status/PiStatusRing";

const WORK_ITEM_MIME = "application/x-mowen-work-item";

type Props = {
  items: WorkItem[];
  tasks: TaskRecord[];
  pendingApprovals: ApprovalRequest[];
  pendingInteractions: InteractionRequest[];
  showArchived: boolean;
  focusItemId?: string | null;
  onMove: (id: string, column: WorkItemColumn, beforeId?: string | null) => void;
  onUpdate: (id: string, title: string, description: string) => void;
  onOpenConversation?: (item: WorkItem) => void;
};

export function WorkBoard({
  items,
  tasks,
  pendingApprovals,
  pendingInteractions,
  showArchived,
  focusItemId,
  onMove,
  onUpdate,
  onOpenConversation,
}: Props) {
  const [overColumn, setOverColumn] = useState<WorkItemColumn | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(focusItemId ?? null);

  useEffect(() => {
    if (focusItemId) setExpandedId(focusItemId);
  }, [focusItemId]);

  function readDragId(event: DragEvent): string {
    return event.dataTransfer.getData(WORK_ITEM_MIME) || event.dataTransfer.getData("text/plain");
  }

  const columns = showArchived
    ? WORK_ITEM_COLUMNS
    : WORK_ITEM_COLUMNS.filter((column) => column.id !== "archived");

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 pt-3" aria-label="工作项看板">
      {columns.map((column) => {
        const cards = items.filter((item) => item.column === column.id);
        return (
          <section
            key={column.id}
            className={`flex w-[240px] shrink-0 flex-col rounded-lg border bg-sidebar ${
              overColumn === column.id ? "border-accent" : "border-line"
            }`}
            aria-label={column.label}
            onDragOver={(event) => {
              if (![WORK_ITEM_MIME, "text/plain"].some((type) => event.dataTransfer.types.includes(type))) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOverColumn(column.id);
            }}
            onDragLeave={() => {
              setOverColumn((current) => (current === column.id ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              setOverColumn(null);
              const id = readDragId(event);
              if (!id) return;
              onMove(id, column.id, null);
            }}
          >
            <header className="flex items-baseline justify-between gap-2 px-3 py-2">
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">{column.label}</h2>
              <span className="text-[11px] text-mute">{cards.length}</span>
            </header>
            {column.id === "doing" ? (
              <p className="px-3 pb-2 text-[11px] leading-4 text-mute">拖到这里会开始执行（需确认）。</p>
            ) : null}
            <ul className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
              {cards.length === 0 ? (
                <li className="rounded-md border border-dashed border-line px-2 py-6 text-center text-[12px] text-mute">
                  {column.id === "todo" ? "还没有工作项。" : "空"}
                </li>
              ) : (
                cards.map((item) => {
                  const task = item.taskId ? tasks.find((entry) => entry.id === item.taskId) : undefined;
                  const approval = item.taskId
                    ? pendingApprovals.find((entry) => entry.taskId === item.taskId)
                    : undefined;
                  const interaction = item.taskId
                    ? pendingInteractions.find((entry) => entry.taskId === item.taskId)
                    : undefined;
                  return (
                    <li
                      key={item.id}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setOverColumn(null);
                        const id = readDragId(event);
                        if (!id || id === item.id) return;
                        onMove(id, column.id, item.id);
                      }}
                    >
                      <WorkItemCard
                        item={item}
                        task={task}
                        needsAttention={Boolean(approval || interaction || task?.status === "waiting_approval")}
                        expanded={expandedId === item.id}
                        onToggleExpand={() =>
                          setExpandedId((current) => (current === item.id ? null : item.id))
                        }
                        onMove={onMove}
                        onUpdate={onUpdate}
                        onOpenConversation={onOpenConversation}
                      />
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function WorkItemCard({
  item,
  task,
  needsAttention,
  expanded,
  onToggleExpand,
  onMove,
  onUpdate,
  onOpenConversation,
}: {
  item: WorkItem;
  task?: TaskRecord;
  needsAttention: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMove: (id: string, column: WorkItemColumn, beforeId?: string | null) => void;
  onUpdate: (id: string, title: string, description: string) => void;
  onOpenConversation?: (item: WorkItem) => void;
}) {
  const dragged = useRef(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);

  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description);
  }, [item.title, item.description]);

  const statusLabel = item.pendingRun
    ? "即将执行"
    : task
      ? taskStatusLabel(task.status)
      : item.column === "doing"
        ? "等待调度"
        : null;
  const running = Boolean(
    task && (task.status === "running" || task.status === "queued" || task.status === "booting"),
  );

  function save() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setTitle(item.title);
      return;
    }
    if (nextTitle === item.title && description === item.description) return;
    onUpdate(item.id, nextTitle, description);
  }

  return (
    <article
      draggable={!expanded}
      onDragStart={(event) => {
        dragged.current = true;
        event.dataTransfer.setData(WORK_ITEM_MIME, item.id);
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          dragged.current = false;
        }, 0);
      }}
      className="rounded-md border border-line bg-surface p-2 shadow-card"
    >
      {expanded ? (
        <div className="space-y-2">
          <div>
            <label className="sr-only" htmlFor={`work-item-title-${item.id}`}>
              标题
            </label>
            <input
              id={`work-item-title-${item.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={save}
              className="field h-7 w-full px-1.5 text-[13px]"
            />
          </div>
          <div>
            <label className="sr-only" htmlFor={`work-item-description-${item.id}`}>
              说明
            </label>
            <textarea
              id={`work-item-description-${item.id}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={save}
              className="field w-full px-1.5 text-[12px]"
              rows={3}
              placeholder="可选。执行时会发给 AI。"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1">
          <button
            type="button"
            className="pressable min-w-0 flex-1 text-left"
            onClick={() => {
              if (dragged.current) return;
              onToggleExpand();
            }}
          >
            <p className="truncate text-[13px] text-ink">{item.title}</p>
            {item.description ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-mute">{item.description}</p>
            ) : null}
            <p className="mt-1 truncate text-[11px] text-mute">{folderName(item.cwd)}</p>
          </button>
          {task ? <PiStatusRing status={task.status} size={14} /> : null}
        </div>
      )}
      <div className="mt-2">
        <label className="sr-only" htmlFor={`work-item-column-${item.id}`}>
          移动 {item.title}
        </label>
        <select
          id={`work-item-column-${item.id}`}
          className="field h-7 w-full px-1.5 text-[12px]"
          value={item.column}
          onChange={(event) => onMove(item.id, event.target.value as WorkItemColumn, null)}
        >
          {WORK_ITEM_COLUMNS.map((column) => (
            <option key={column.id} value={column.id}>
              {column.label}
            </option>
          ))}
        </select>
      </div>
      {statusLabel ? <p className="mt-1 text-[11px] text-mute">{statusLabel}</p> : null}
      {needsAttention ? (
        <button
          type="button"
          className="pressable mt-1 text-[11px] text-accent"
          onClick={() => onOpenConversation?.(item)}
        >
          等待你确认 · 去处理
        </button>
      ) : running && !expanded ? (
        <button
          type="button"
          className="pressable mt-1 text-[11px] text-accent"
          onClick={() => onOpenConversation?.(item)}
        >
          去看对话
        </button>
      ) : null}
      {expanded ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.taskId ? (
            <button
              type="button"
              className="pressable btn btn-secondary h-7 text-[12px]"
              onClick={() => onOpenConversation?.(item)}
            >
              打开对话
            </button>
          ) : null}
          <button type="button" className="pressable btn btn-ghost h-7 text-[12px]" onClick={onToggleExpand}>
            收起
          </button>
        </div>
      ) : null}
    </article>
  );
}
