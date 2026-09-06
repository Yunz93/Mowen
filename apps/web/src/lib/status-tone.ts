import type { TaskStatus, WorkItemViewState } from "@mowen/protocol";

export type StatusTone = "idle" | "busy" | "wait" | "ok" | "danger";

export function taskStatusTone(status: TaskStatus | string | null | undefined): StatusTone {
  if (status === "error") return "danger";
  if (status === "waiting_approval") return "wait";
  if (status === "running" || status === "booting" || status === "aborting" || status === "queued") return "busy";
  if (status === "idle") return "ok";
  return "idle";
}

export function workViewTone(state: WorkItemViewState): StatusTone {
  if (state === "failed") return "danger";
  if (state === "needs_approval" || state === "needs_input" || state === "needs_review") return "wait";
  if (state === "working" || state === "queued") return "busy";
  if (state === "completed") return "ok";
  return "idle";
}

export function toneClass(tone: StatusTone): string {
  if (tone === "busy") return "tone-busy";
  if (tone === "wait") return "tone-wait";
  if (tone === "ok") return "tone-ok";
  if (tone === "danger") return "tone-danger";
  return "tone-idle";
}
