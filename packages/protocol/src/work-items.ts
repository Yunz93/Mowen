import { z } from "zod";
import { isoTimestampSchema } from "./task-schema.js";

export const WORK_ITEM_SCHEMA_VERSION = 2;

export const workItemColumnSchema = z.enum(["todo", "doing", "review", "done", "archived"]);
export type WorkItemColumn = z.infer<typeof workItemColumnSchema>;

export const workItemNoteSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(20_000),
  createdAt: isoTimestampSchema,
  sentAt: isoTimestampSchema.nullable().default(null),
});
export type WorkItemNote = z.infer<typeof workItemNoteSchema>;

export const workProjectSchema = z.object({
  schemaVersion: z.literal(WORK_ITEM_SCHEMA_VERSION).default(WORK_ITEM_SCHEMA_VERSION),
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  cwd: z.string().min(1),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  archivedAt: isoTimestampSchema.nullable().default(null),
});
export type WorkProject = z.infer<typeof workProjectSchema>;

export const workItemSchema = z.object({
  schemaVersion: z.literal(WORK_ITEM_SCHEMA_VERSION).default(WORK_ITEM_SCHEMA_VERSION),
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(20_000).default(""),
  notes: z.array(workItemNoteSchema).default([]),
  cwd: z.string().min(1),
  column: workItemColumnSchema,
  rank: z.number(),
  taskId: z.string().uuid().nullable().default(null),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  lastRunAt: isoTimestampSchema.nullable().default(null),
  pendingRun: z.boolean().default(false),
  closedAt: isoTimestampSchema.nullable().default(null),
});
export type WorkItem = z.infer<typeof workItemSchema>;

export const WORK_ITEM_COLUMNS: Array<{ id: WorkItemColumn; label: string }> = [
  { id: "todo", label: "待办" },
  { id: "doing", label: "执行" },
  { id: "review", label: "待检视" },
  { id: "done", label: "已完成" },
  { id: "archived", label: "归档" },
];

export function workItemPrompt(item: {
  title: string;
  description?: string;
  notes?: Array<{ text: string }>;
}): string {
  const notes = (item.notes ?? []).map((note) => note.text.trim()).filter(Boolean);
  const description = item.description?.trim() ?? "";
  const extra = [...(description ? [description] : []), ...notes].join("\n\n");
  if (!extra) return `请完成工作项：${item.title}`;
  return `请完成下面这个工作项。\n\n标题：${item.title}\n\n说明：\n${extra}`;
}

export function workItemAppendPrompt(item: { title: string }, text: string): string {
  return `请继续这个工作项「${item.title}」。下面是追加的说明：\n\n${text.trim()}`;
}

export function workItemIsClosed(column: WorkItemColumn): boolean {
  return column === "done" || column === "archived";
}

export function workItemCanAppend(column: WorkItemColumn): boolean {
  return !workItemIsClosed(column);
}

/** Moving back to 待办 or 归档 cancels the run. 待检视 / 已完成 keep the conversation going. */
export function workItemMoveAbortsRun(from: WorkItemColumn, to: WorkItemColumn): boolean {
  if (from !== "doing" || to === "doing") return false;
  return to === "todo" || to === "archived";
}

export function workItemMoveStartsRun(from: WorkItemColumn, to: WorkItemColumn): boolean {
  return to === "doing" && from !== "doing";
}

export function workItemMoveCloses(from: WorkItemColumn, to: WorkItemColumn): boolean {
  return to === "done" && from !== "done";
}
