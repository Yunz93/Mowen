import { describe, expect, it } from "vitest";
import {
  mergeCompletedTimelineMessage,
  preferAccumulatedThinking,
  type TimelineMessage,
} from "@mowen/protocol";

const base = (overrides: Partial<TimelineMessage> = {}): TimelineMessage => ({
  id: "asst-1",
  role: "assistant",
  text: "",
  createdAt: "2026-08-26T00:00:00.000Z",
  streaming: false,
  ...overrides,
});

describe("preferAccumulatedThinking", () => {
  it("keeps longer streamed thinking when the final payload is a short summary", () => {
    const streamed =
      "I need to inspect the command output carefully.\nFirst check stderr, then stdout encoding.";
    const summary = "**Planning command output debugging**";
    expect(preferAccumulatedThinking(streamed, summary)).toBe(streamed);
  });

  it("uses the final payload when it is at least as long as the stream", () => {
    const streamed = "partial";
    const final = "partial thinking continued to the end";
    expect(preferAccumulatedThinking(streamed, final)).toBe(final);
  });

  it("falls back when either side is missing", () => {
    expect(preferAccumulatedThinking(undefined, "only final")).toBe("only final");
    expect(preferAccumulatedThinking("only stream", undefined)).toBe("only stream");
    expect(preferAccumulatedThinking(undefined, undefined)).toBeUndefined();
  });
});

describe("mergeCompletedTimelineMessage", () => {
  it("does not overwrite streamed thinking with an abort summary title", () => {
    const existing = base({
      thinking:
        "详细检查命令输出：先看返回码，再核对 stderr 与 stdout 是否乱码。",
      streaming: true,
    });
    const incoming = base({
      thinking: "**Planning command output debugging**",
      text: "Stopped.",
      streaming: false,
    });
    const merged = mergeCompletedTimelineMessage(existing, incoming);
    expect(merged.thinking).toBe(existing.thinking);
    expect(merged.text).toBe("Stopped.");
    expect(merged.streaming).toBe(false);
  });

  it("preserves thinkingDurationMs from the live bubble when the final omits it", () => {
    const existing = base({ thinking: "long enough thinking body here", thinkingDurationMs: 4200 });
    const incoming = base({ thinking: "short", streaming: false });
    expect(mergeCompletedTimelineMessage(existing, incoming).thinkingDurationMs).toBe(4200);
  });
});
