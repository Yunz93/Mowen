import { z } from "zod";
import { isoTimestampSchema } from "./task-schema.js";

export const WORK_ITEM_SCHEMA_VERSION = 1;

export const workItemColumnSchema = z.enum(["todo", "doing", "review", "done", "archived"]);
export type WorkItemColumn = z.infer<typeof workItemColumnSchema>;

export const workItemSchema = z.object({
  schemaVersion: z.literal(WORK_ITEM_SCHEMA_VERSION).default(WORK_ITEM_SCHEMA_VERSION),
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(20_000).default(""),
  cwd: z.string().min(1),
  column: workItemColumnSchema,
  rank: z.number(),
  taskId: z.string().uuid().nullable().default(null),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  lastRunAt: isoTimestampSchema.nullable().default(null),
  pendingRun: z.boolean().default(false),
});
export type WorkItem = z.infer<typeof workItemSchema>;

export const WORK_ITEM_COLUMNS: Array<{ id: WorkItemColumn; label: string }> = [
  { id: "todo", label: "待办" },
  { id: "doing", label: "执行" },
  { id: "review", label: "待检视" },
  { id: "done", label: "已完成" },
  { id: "archived", label: "归档" },
];

export function workItemPrompt(item: { title: string; description?: string }): string {
  const description = item.description?.trim() ?? "";
  if (!description) return `请完成工作项：${item.title}`;
  return `请完成下面这个工作项。\n\n标题：${item.title}\n\n说明：\n${description}`;
}

/** Moving back to 待办 or 归档 cancels the run. 待检视 / 已完成 keep the conversation going. */
export function workItemMoveAbortsRun(from: WorkItemColumn, to: WorkItemColumn): boolean {
  if (from !== "doing" || to === "doing") return false;
  return to === "todo" || to === "archived";
}

export function workItemMoveStartsRun(from: WorkItemColumn, to: WorkItemColumn): boolean {
  return to === "doing" && from !== "doing";
}
