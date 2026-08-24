import { z } from "zod";

export const thinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

export const interactionModeSchema = z.enum(["ask", "plan", "agent", "review"]);
export type InteractionMode = z.infer<typeof interactionModeSchema>;

export const approvalPolicySchema = z.enum(["ask", "workspace", "read_only"]);
export type ApprovalPolicy = z.infer<typeof approvalPolicySchema>;

export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;

export const taskStatusSchema = z.enum([
  "queued",
  "booting",
  "idle",
  "running",
  "waiting_approval",
  "aborting",
  "error",
  "stopped",
]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const toolExecutionStatusSchema = z.enum([
  "pending",
  "waiting_approval",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "aborted",
]);

export type ToolExecutionStatus = z.infer<typeof toolExecutionStatusSchema>;

export const modelRefSchema = z.object({
  provider: z.string(),
  id: z.string(),
  name: z.string().optional(),
  reasoning: z.boolean().optional(),
  contextWindow: z.number().optional(),
});

export type ModelRef = z.infer<typeof modelRefSchema>;

export const TASK_SCHEMA_VERSION = 1;

export const isoTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp");

export const taskRecordSchema = z.object({
  schemaVersion: z.literal(TASK_SCHEMA_VERSION).default(TASK_SCHEMA_VERSION),
  id: z.string().uuid(),
  title: z.string(),
  cwd: z.string(),
  sessionPath: z.string().nullable(),
  status: taskStatusSchema,
  model: modelRefSchema.nullable(),
  thinkingLevel: thinkingLevelSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  lastOpenedAt: isoTimestampSchema,
  archivedAt: isoTimestampSchema.nullable(),
  unreadCount: z.number().int().nonnegative(),
  errorMessage: z.string().nullable().optional(),
  mode: interactionModeSchema.default("agent"),
  approvalPolicy: approvalPolicySchema.default("ask"),
});

export type TaskRecord = z.infer<typeof taskRecordSchema>;

export const toolExecutionSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  target: z.string().optional(),
  args: z.unknown().optional(),
  status: toolExecutionStatusSchema,
  startedAt: isoTimestampSchema.optional(),
  endedAt: isoTimestampSchema.optional(),
  durationMs: z.number().optional(),
  isError: z.boolean().optional(),
  resultText: z.string().optional(),
});

export type ToolExecution = z.infer<typeof toolExecutionSchema>;

export const approvalRequestSchema = z.object({
  requestId: z.string(),
  taskId: z.string(),
  toolCallId: z.string(),
  toolName: z.string(),
  cwd: z.string(),
  target: z.string(),
  rawCommand: z.string().optional(),
  risk: z.string(),
  expiresAt: isoTimestampSchema,
  oldText: z.string().optional(),
  newText: z.string().optional(),
  content: z.string().optional(),
});

export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;

export const sessionStatsSchema = z.object({
  sessionFile: z.string().optional(),
  sessionId: z.string().optional(),
  userMessages: z.number().optional(),
  assistantMessages: z.number().optional(),
  toolCalls: z.number().optional(),
  toolResults: z.number().optional(),
  totalMessages: z.number().optional(),
  tokens: z
    .object({
      input: z.number(),
      output: z.number(),
      cacheRead: z.number(),
      cacheWrite: z.number(),
      total: z.number(),
    })
    .optional(),
  cost: z.number().optional(),
  contextUsage: z
    .object({
      tokens: z.number().nullable().optional(),
      contextWindow: z.number().optional(),
      percent: z.number().nullable().optional(),
    })
    .optional(),
});

export type SessionStats = z.infer<typeof sessionStatsSchema>;

export const timelineMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "toolResult", "system"]),
  text: z.string(),
  thinking: z.string().optional(),
  thinkingDurationMs: z.number().optional(),
  createdAt: isoTimestampSchema,
  streaming: z.boolean().optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
  isError: z.boolean().optional(),
});

export type TimelineMessage = z.infer<typeof timelineMessageSchema>;
