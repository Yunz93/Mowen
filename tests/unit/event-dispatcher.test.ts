import { describe, expect, it } from "vitest";
import { serverFrameSchema, type ServerEvent } from "@ohmypi/protocol";
import { EventDispatcher, type SocketLike } from "../../apps/server/src/tasks/event-dispatcher.ts";

function socket(): SocketLike & { frames: string[] } {
  const frames: string[] = [];
  return { closed: false, frames, send: (data) => frames.push(data) };
}

describe("event dispatcher", () => {
  it("flushes buffered deltas before later service events", () => {
    let sequence = 0;
    const dispatcher = new EventDispatcher(() => ({
      eventId: `event-${++sequence}`,
      serverInstanceId: "server",
      timestamp: new Date().toISOString(),
      sequence,
    }));
    const client = socket();
    dispatcher.addSocket(client);
    const delta: ServerEvent = {
      eventId: "delta",
      serverInstanceId: "server",
      taskId: "task",
      timestamp: new Date().toISOString(),
      sequence: ++sequence,
      type: "message.delta",
      payload: { messageId: "message", field: "text", delta: "hello" },
    };

    dispatcher.dispatch(delta);
    dispatcher.emit("task", "server.error", { code: "test", message: "after" });

    const frames = client.frames.map((frame) => serverFrameSchema.parse(JSON.parse(frame)));
    expect("__batch" in frames[0] && frames[0].events[0]?.sequence).toBe(1);
    expect("type" in frames[1] && frames[1].sequence).toBe(2);
  });

  it("does not replay pending deltas to a newly connected socket", () => {
    let sequence = 0;
    const dispatcher = new EventDispatcher(() => ({
      eventId: `event-${++sequence}`,
      serverInstanceId: "server",
      timestamp: new Date().toISOString(),
      sequence,
    }));
    const existing = socket();
    const newcomer = socket();
    dispatcher.addSocket(existing);
    dispatcher.dispatch({
      eventId: "delta",
      serverInstanceId: "server",
      taskId: "task",
      timestamp: new Date().toISOString(),
      sequence: ++sequence,
      type: "message.delta",
      payload: { messageId: "message", field: "text", delta: "hello" },
    });

    dispatcher.addSocket(newcomer);
    expect(existing.frames).toHaveLength(1);
    expect(newcomer.frames).toHaveLength(0);
  });
});
