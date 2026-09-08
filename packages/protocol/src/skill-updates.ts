import { z } from "zod";

export const skillUpdateSourceSchema = z.enum(["git", "github", "local"]);
export type SkillUpdateSource = z.infer<typeof skillUpdateSourceSchema>;

export const skillUpdateItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  source: skillUpdateSourceSchema,
  current: z.string().optional(),
  latest: z.string().optional(),
  updateAvailable: z.boolean(),
  error: z.string().optional(),
});
export type SkillUpdateItem = z.infer<typeof skillUpdateItemSchema>;

export const skillUpdateCheckResultSchema = z.object({
  items: z.array(skillUpdateItemSchema),
  checkedAt: z.string(),
});
export type SkillUpdateCheckResult = z.infer<typeof skillUpdateCheckResultSchema>;

export const skillUpdateApplyResultSchema = z.object({
  updated: z.array(z.string()),
  failed: z.array(z.object({ path: z.string(), error: z.string() })),
  items: z.array(skillUpdateItemSchema),
});
export type SkillUpdateApplyResult = z.infer<typeof skillUpdateApplyResultSchema>;
