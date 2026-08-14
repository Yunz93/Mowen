import { describe, expect, it } from "vitest";
import { clientCommandSchema } from "../../packages/protocol/src/index.ts";
import { useAgentStore } from "../../apps/web/src/stores/agent-store.ts";

describe("protocol", () => {
  it("rejects illegal websocket payloads", () => {
    const result = clientCommandSchema.safeParse({ type: "prompt.send", payload: { message: "hi" } });
    expect(result.success).toBe(false);
  });
});

describe("event sequence dedup", () => {
  it("ignores duplicate taskId+sequence pairs", () => {
    const store = useAgentStore.getState();
    store.applyEvent({
      eventId: "a",
      taskId: "t1",
      timestamp: new Date().toISOString(),
      sequence: 1,
      type: "server.error",
      payload: { code: "x", message: "one" },
    });
    store.applyEvent({
      eventId: "b",
      taskId: "t1",
      timestamp: new Date().toISOString(),
      sequence: 1,
      type: "server.error",
      payload: { code: "x", message: "two" },
    });
    expect(useAgentStore.getState().serverError).toBe("one");
  });
});
