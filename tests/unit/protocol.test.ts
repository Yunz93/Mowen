import { describe, expect, it } from "vitest";
import { clientCommandSchema, serverFrameSchema, type ServerEvent } from "../../packages/protocol/src/index.ts";
import { useAgentStore } from "../../apps/web/src/stores/agent-store.ts";

describe("protocol", () => {
  it("rejects illegal websocket payloads", () => {
    const result = clientCommandSchema.safeParse({ type: "prompt.send", payload: { message: "hi" } });
    expect(result.success).toBe(false);
  });

  it("accepts pi mvp session and runtime commands", () => {
    expect(
      clientCommandSchema.parse({
        id: "1",
        type: "session.resume",
        payload: { sessionPath: "/tmp/session.jsonl" },
      }).type,
    ).toBe("session.resume");
    expect(
      clientCommandSchema.parse({
        id: "2",
        type: "runtime.set",
        taskId: "11111111-1111-4111-8111-111111111111",
        payload: { autoCompaction: false },
      }).payload,
    ).toEqual({ autoCompaction: false });
  });
});

describe("event sequence dedup", () => {
  it("ignores duplicate taskId+sequence pairs", () => {
    const store = useAgentStore.getState();
    store.applyEvent({
      eventId: "a",
      serverInstanceId: "server-a",
      taskId: "t1",
      timestamp: new Date().toISOString(),
      sequence: 1,
      type: "server.error",
      payload: { code: "x", message: "one" },
    });
    store.applyEvent({
      eventId: "b",
      serverInstanceId: "server-a",
      taskId: "t1",
      timestamp: new Date().toISOString(),
      sequence: 1,
      type: "server.error",
      payload: { code: "x", message: "two" },
    });
    expect(useAgentStore.getState().serverError).toBe("one");
  });

  it("accepts lower sequences from a restarted server", () => {
    const store = useAgentStore.getState();
    const event = (serverInstanceId: string, sequence: number, message: string): ServerEvent => ({
      eventId: `${serverInstanceId}-${sequence}`,
      serverInstanceId,
      taskId: "restart-task",
      timestamp: new Date().toISOString(),
      sequence,
      type: "server.error",
      payload: { code: "restart", message },
    });
    store.applyEvent(event("old-server", 20, "old"));
    store.applyEvent(event("new-server", 1, "new"));
    expect(useAgentStore.getState().serverError).toBe("new");
  });

  it("validates batched websocket frames", () => {
    const event: ServerEvent = {
      eventId: "frame-1",
      serverInstanceId: "server-frame",
      taskId: "",
      timestamp: new Date().toISOString(),
      sequence: 1,
      type: "connection.status",
      payload: { status: "connected" },
    };
    expect(serverFrameSchema.parse({ __batch: true, events: [event] }).events).toHaveLength(1);
  });
});
