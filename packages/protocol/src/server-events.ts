import { z } from "zod";
import {
  approvalRequestSchema,
  modelRefSchema,
  sessionStatsSchema,
  taskRecordSchema,
  taskStatusSchema,
  thinkingLevelSchema,
  timelineMessageSchema,
  toolExecutionSchema,
} from "./task-schema.js";

export const serverEventTypeSchema = z.enum([
  "snapshot",
  "task.created",
  "task.updated",
  "task.archived",
  "agent.status",
  "message.started",
  "message.delta",
  "message.completed",
  "tool.started",
  "tool.updated",
  "tool.completed",
  "approval.requested",
  "approval.resolved",
  "session.stats",
  "connection.status",
  "request.succeeded",
  "request.failed",
  "server.error",
  "files.tree",
  "files.preview",
  "models.updated",
  "commands.updated",
  "git.status",
  "checkpoints.updated",
]);

export type ServerEventType = z.infer<typeof serverEventTypeSchema>;

const eventBase = {
  eventId: z.string().min(1),
  serverInstanceId: z.string().min(1),
  taskId: z.string(),
  timestamp: z.string().min(1),
  sequence: z.number().int().nonnegative(),
};

export const snapshotPayloadSchema = z.object({
  tasks: z.array(taskRecordSchema),
  activeTaskId: z.string().nullable(),
  messages: z.array(timelineMessageSchema),
  tools: z.array(toolExecutionSchema),
  approval: approvalRequestSchema.nullable(),
  models: z.array(modelRefSchema),
  thinkingLevels: z.array(thinkingLevelSchema),
  stats: sessionStatsSchema.nullable(),
  piVersion: z.string().nullable(),
  piAvailable: z.boolean(),
  piError: z.string().nullable(),
  mutations: z.enum(["approval", "disabled"]),
  allowedRoots: z.array(z.string()),
  dataDir: z.string(),
  maxProcesses: z.number(),
  authConfigured: z.boolean().optional(),
  configuredProviders: z.array(z.string()).optional(),
  needsSetup: z.boolean().optional(),
  homeDir: z.string().optional(),
  workspaceRoot: z.string().nullable().optional(),
  pendingApprovals: z.array(approvalRequestSchema).optional(),
  commands: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        source: z.string().optional(),
      }),
    )
    .optional(),
  git: z
    .object({
      branch: z.string().nullable(),
      dirty: z.boolean(),
      entries: z.array(
        z.object({
          path: z.string(),
          status: z.string(),
        }),
      ),
    })
    .nullable()
    .optional(),
  checkpoints: z
    .array(
      z.object({
        id: z.string(),
        taskId: z.string(),
        path: z.string(),
        createdAt: z.string(),
        toolName: z.string().optional(),
      }),
    )
    .optional(),
});

export type SnapshotPayload = z.infer<typeof snapshotPayloadSchema>;

export const serverEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...eventBase,
    type: z.literal("snapshot"),
    payload: snapshotPayloadSchema,
  }),
  z.object({
    ...eventBase,
    type: z.literal("task.created"),
    payload: z.object({ task: taskRecordSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("task.updated"),
    payload: z.object({ task: taskRecordSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("task.archived"),
    payload: z.object({ taskId: z.string() }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("agent.status"),
    payload: z.object({
      status: taskStatusSchema,
      errorMessage: z.string().nullable().optional(),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("message.started"),
    payload: z.object({ message: timelineMessageSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("message.delta"),
    payload: z.object({
      messageId: z.string(),
      field: z.enum(["text", "thinking"]),
      delta: z.string(),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("message.completed"),
    payload: z.object({ message: timelineMessageSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("tool.started"),
    payload: z.object({ tool: toolExecutionSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("tool.updated"),
    payload: z.object({ tool: toolExecutionSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("tool.completed"),
    payload: z.object({ tool: toolExecutionSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("approval.requested"),
    payload: z.object({ approval: approvalRequestSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("approval.resolved"),
    payload: z.object({
      requestId: z.string(),
      allow: z.boolean(),
      reason: z.string().optional(),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("session.stats"),
    payload: z.object({ stats: sessionStatsSchema }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("connection.status"),
    payload: z.object({
      status: z.enum(["connected", "disconnected", "reconnecting"]),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("request.succeeded"),
    payload: z.object({ requestId: z.string(), data: z.unknown().optional() }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("request.failed"),
    payload: z.object({ requestId: z.string(), error: z.string() }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("server.error"),
    payload: z.object({
      code: z.string(),
      message: z.string(),
      authHint: z.boolean().optional(),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("files.tree"),
    payload: z.object({
      entries: z.array(
        z.object({
          path: z.string(),
          name: z.string(),
          kind: z.enum(["file", "dir"]),
        }),
      ),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("files.preview"),
    payload: z.object({
      path: z.string(),
      content: z.string(),
      truncated: z.boolean(),
      language: z.string().optional(),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("models.updated"),
    payload: z.object({
      models: z.array(modelRefSchema),
      thinkingLevels: z.array(thinkingLevelSchema),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("commands.updated"),
    payload: z.object({
      commands: z.array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          source: z.string().optional(),
        }),
      ),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("git.status"),
    payload: z.object({
      branch: z.string().nullable(),
      dirty: z.boolean(),
      entries: z.array(z.object({ path: z.string(), status: z.string() })),
    }),
  }),
  z.object({
    ...eventBase,
    type: z.literal("checkpoints.updated"),
    payload: z.object({
      checkpoints: z.array(
        z.object({
          id: z.string(),
          taskId: z.string(),
          path: z.string(),
          createdAt: z.string(),
          toolName: z.string().optional(),
        }),
      ),
    }),
  }),
]);

export type ServerEvent = z.infer<typeof serverEventSchema>;

export const serverFrameSchema = z.union([
  serverEventSchema,
  z.object({
    __batch: z.literal(true),
    events: z.array(serverEventSchema),
  }),
]);

export type ServerFrame = z.infer<typeof serverFrameSchema>;
