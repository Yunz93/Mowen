import type { TimelineMessage } from "./task-schema.js";

/**
 * Prefer streamed thinking over a shorter final summary.
 * On abort, Pi often ends with a title-only thinking block (e.g. `**Planning…**`)
 * while thinking_delta already carried the full text.
 */
export function preferAccumulatedThinking(
  existing: string | undefined,
  incoming: string | undefined,
): string | undefined {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return existing.length > incoming.length ? existing : incoming;
}

/** Merge a completed assistant message onto the live bubble without dropping streamed thinking. */
export function mergeCompletedTimelineMessage(
  existing: TimelineMessage | undefined,
  incoming: TimelineMessage,
): TimelineMessage {
  if (!existing) return incoming;
  return {
    ...incoming,
    thinking: preferAccumulatedThinking(existing.thinking, incoming.thinking),
    thinkingDurationMs: incoming.thinkingDurationMs ?? existing.thinkingDurationMs,
  };
}
