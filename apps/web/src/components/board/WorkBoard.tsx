import { useState } from "react";
import type { DragEvent } from "react";
import { WORK_ITEM_COLUMNS, type TaskRecord, type WorkItem, type WorkItemColumn } from "@mowen/protocol";
import { folderName, taskStatusLabel } from "../../copy";
import { PiStatusRing } from "../status/PiStatusRing";

const WORK_ITEM_MIME = "application/x-mowen-work-item";

type Props = {
  items: WorkItem[];
  tasks: TaskRecord[];
  onMove: (id: string, column: WorkItemColumn, beforeId?: string | null) => void;
  onOpen?: (item: WorkItem) => void;
};

export function WorkBoard({ items, tasks, onMove, onOpen }: Props) {
  const [overColumn, setOverColumn] = useState<WorkItemColumn | null>(null);

  function readDragId(event: DragEvent): string {
    return event.dataTransfer.getData(WORK_ITEM_MIME) || event.dataTransfer.getData("text/plain");
  }

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 pt-3" aria-label="工作项看板">
      {WORK_ITEM_COLUMNS.map((column) => {
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
              <p className="px-3 pb-2 text-[11px] leading-4 text-mute">拖到这里会自动开始执行。</p>
            ) : null}
            <ul className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
              {cards.length === 0 ? (
                <li className="rounded-md border border-dashed border-line px-2 py-6 text-center text-[12px] text-mute">
                  {column.id === "todo" ? "还没有工作项。" : "空"}
                </li>
              ) : (
                cards.map((item) => {
                  const task = item.taskId ? tasks.find((entry) => entry.id === item.taskId) : undefined;
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
                      <WorkItemCard item={item} task={task} onMove={onMove} onOpen={onOpen} />
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
  onMove,
  onOpen,
}: {
  item: WorkItem;
  task?: TaskRecord;
  onMove: (id: string, column: WorkItemColumn, beforeId?: string | null) => void;
  onOpen?: (item: WorkItem) => void;
}) {
  const statusLabel = item.pendingRun
    ? "即将执行"
    : task
      ? taskStatusLabel(task.status)
      : item.column === "doing"
        ? "等待调度"
        : null;

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(WORK_ITEM_MIME, item.id);
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className="rounded-md border border-line bg-surface p-2 shadow-card"
    >
      <div className="flex items-start gap-1">
        <button type="button" className="pressable min-w-0 flex-1 text-left" onClick={() => onOpen?.(item)}>
          <p className="truncate text-[13px] text-ink">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-mute">{item.description}</p>
          ) : null}
          <p className="mt-1 truncate text-[11px] text-mute">{folderName(item.cwd)}</p>
        </button>
        {task ? <PiStatusRing status={task.status} size={14} /> : null}
      </div>
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
    </article>
  );
}
