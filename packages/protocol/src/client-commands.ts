import { z } from "zod";
import { approvalPolicySchema, interactionModeSchema, thinkingLevelSchema } from "./task-schema.js";

const commandBase = {
  id: z.string().min(1),
  taskId: z.string().optional(),
};

export const clientCommandSchema = z.discriminatedUnion("type", [
  z.object({
    ...commandBase,
    type: z.literal("task.create"),
    payload: z.object({
      cwd: z.string().min(1),
      title: z.string().min(1).optional(),
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("task.activate"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("task.rename"),
    taskId: z.string().min(1),
    payload: z.object({ title: z.string().min(1).max(200) }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("task.archive"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("prompt.send"),
    taskId: z.string().min(1),
    payload: z.object({
      message: z.string().min(1),
      imageIds: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("prompt.steer"),
    taskId: z.string().min(1),
    payload: z.object({
      message: z.string().min(1),
      imageIds: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("prompt.followUp"),
    taskId: z.string().min(1),
    payload: z.object({
      message: z.string().min(1),
      imageIds: z.array(z.string()).optional(),
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("agent.abort"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("model.set"),
    taskId: z.string().min(1),
    payload: z.object({
      provider: z.string().min(1),
      modelId: z.string().min(1),
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("thinking.set"),
    taskId: z.string().min(1),
    payload: z.object({ level: thinkingLevelSchema }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("approval.respond"),
    taskId: z.string().min(1),
    payload: z.object({
      requestId: z.string().min(1),
      allow: z.boolean(),
      remember: z.boolean().optional(),
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("task.policy.set"),
    taskId: z.string().min(1),
    payload: z.object({
      mode: interactionModeSchema,
      approvalPolicy: approvalPolicySchema,
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("session.fork"),
    taskId: z.string().min(1),
    payload: z.object({
      messageId: z.string().min(1),
      message: z.string().min(1).optional(),
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("session.clone"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("git.status"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("checkpoint.list"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("checkpoint.restore"),
    taskId: z.string().min(1),
    payload: z.object({ checkpointId: z.string().min(1) }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("commands.list"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("session.compact"),
    taskId: z.string().min(1),
    payload: z.object({ customInstructions: z.string().optional() }).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("session.stats"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("snapshot.request"),
    payload: z.object({ taskId: z.string().optional() }).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("files.tree"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("files.read"),
    taskId: z.string().min(1),
    payload: z.object({ path: z.string().min(1) }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("task.search"),
    payload: z.object({ query: z.string() }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("session.tree"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("session.branch"),
    taskId: z.string().min(1),
    payload: z.object({ entryId: z.string().min(1), message: z.string().optional() }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("sessions.list"),
    payload: z.object({ cwd: z.string().optional() }).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("session.resume"),
    payload: z.object({
      sessionPath: z.string().min(1),
      cwd: z.string().min(1).optional(),
      title: z.string().min(1).optional(),
    }),
  }),
  z.object({
    ...commandBase,
    type: z.literal("session.export"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("resources.list"),
    taskId: z.string().min(1),
    payload: z.object({}).optional(),
  }),
  z.object({
    ...commandBase,
    type: z.literal("runtime.set"),
    taskId: z.string().min(1),
    payload: z.object({
      autoCompaction: z.boolean().optional(),
      autoRetry: z.boolean().optional(),
    }),
  }),
]);

export type ClientCommand = z.infer<typeof clientCommandSchema>;
export type ClientCommandType = ClientCommand["type"];
