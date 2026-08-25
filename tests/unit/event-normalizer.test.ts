import { describe, expect, it } from "vitest";
import { normalizePiEvent, piMessagesToTimeline } from "../../apps/server/src/pi/event-normalizer.ts";

describe("event normalizer", () => {
  it("keeps assistant start and end on the same id", () => {
    const timestamp = 1786666243568;
    const started = normalizePiEvent({
      type: "message_start",
      message: { role: "assistant", content: [], timestamp },
    });
    const ended = normalizePiEvent({
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "hello world from the agent" }],
        timestamp,
      },
    });
    expect(started.kind).toBe("message.started");
    expect(ended.kind).toBe("message.completed");
    if (started.kind === "message.started" && ended.kind === "message.completed") {
      expect(started.message.id).toBe(ended.message.id);
    }
  });

  it("marks denied tool results as blocked", () => {
    const event = normalizePiEvent({
      type: "tool_execution_end",
      toolCallId: "call-1",
      toolName: "bash",
      isError: true,
      result: { content: [{ type: "text", text: "Denied by user or timed out" }] },
    });
    expect(event.kind).toBe("tool.completed");
    if (event.kind === "tool.completed") {
      expect(event.tool.status).toBe("blocked");
    }
  });

  it("maps compaction, retry, and queue events", () => {
    expect(normalizePiEvent({ type: "compaction_start", reason: "threshold" })).toEqual({
      kind: "runtime.compaction",
      phase: "start",
      reason: "threshold",
    });
    expect(normalizePiEvent({ type: "auto_retry_start", attempt: 1, maxAttempts: 3, errorMessage: "529" })).toEqual({
      kind: "runtime.retry",
      phase: "start",
      attempt: 1,
      maxAttempts: 3,
      error: "529",
    });
    expect(normalizePiEvent({ type: "queue_update", steering: ["go left"], followUp: ["then summarize"] })).toEqual({
      kind: "runtime.queue",
      steering: ["go left"],
      followUp: ["then summarize"],
    });
    expect(
      normalizePiEvent({
        type: "agent_error",
        error: "EACCES: permission denied, open '/Users/yunz/.pi/agent/auth.json'",
      }),
    ).toEqual({
      kind: "agent_error",
      error: "EACCES: permission denied, open '/Users/yunz/.pi/agent/auth.json'",
    });
  });

  it("restores user and assistant messages from Pi history", () => {
    const messages = piMessagesToTimeline([
      { role: "user", content: [{ type: "text", text: "hello" }], timestamp: 1 },
      { role: "assistant", content: [{ type: "text", text: "hi" }], timestamp: 2 },
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.text).toBe("hello");
    expect(messages[1]?.text).toBe("hi");
  });
});
