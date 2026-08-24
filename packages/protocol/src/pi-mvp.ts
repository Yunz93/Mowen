import { z } from "zod";

export const authEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["api_key", "oauth", "other"]),
});
export type AuthEntry = z.infer<typeof authEntrySchema>;

export const piResourceFileSchema = z.object({
  path: z.string(),
  kind: z.enum(["agents", "override", "claude", "system", "append"]),
});

export const piSkillSchema = z.object({
  name: z.string(),
  path: z.string(),
  scope: z.enum(["user", "project"]),
});

export const piResourcesSchema = z.object({
  agentsFiles: z.array(piResourceFileSchema),
  skills: z.array(piSkillSchema),
  templates: z.array(piSkillSchema),
  trustProject: z.boolean(),
});
export type PiResources = z.infer<typeof piResourcesSchema>;

export const runtimeStateSchema = z.object({
  compacting: z.boolean(),
  compactionReason: z.string().optional(),
  retrying: z.boolean(),
  retryAttempt: z.number().optional(),
  retryMax: z.number().optional(),
  retryError: z.string().optional(),
  steering: z.array(z.string()),
  followUp: z.array(z.string()),
  autoCompaction: z.boolean().optional(),
  autoRetry: z.boolean().optional(),
});
export type RuntimeState = z.infer<typeof runtimeStateSchema>;

export function emptyRuntime(): RuntimeState {
  return {
    compacting: false,
    retrying: false,
    steering: [],
    followUp: [],
    autoCompaction: true,
    autoRetry: true,
  };
}

export const sessionTreeNodeSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  role: z.string(),
  text: z.string(),
  leaf: z.boolean().optional(),
});
export type SessionTreeNode = z.infer<typeof sessionTreeNodeSchema>;

export const piSessionRefSchema = z.object({
  path: z.string(),
  id: z.string().optional(),
  cwd: z.string().optional(),
  name: z.string().optional(),
  preview: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type PiSessionRef = z.infer<typeof piSessionRefSchema>;
