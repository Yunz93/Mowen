import { describe, expect, it } from "vitest";
import {
  clientCommandSchema,
  normalizeSessionStats,
  piResourcesSchema,
  serverFrameSchema,
  type ServerEvent,
} from "../../packages/protocol/src/index.ts";
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
    expect(
      clientCommandSchema.parse({
        id: "3",
        type: "session.stats",
        taskId: "11111111-1111-4111-8111-111111111111",
      }).type,
    ).toBe("session.stats");
    expect(
      clientCommandSchema.parse({
        id: "4",
        type: "git.commit",
        taskId: "11111111-1111-4111-8111-111111111111",
        payload: { message: "save work" },
      }).type,
    ).toBe("git.commit");
    expect(
      clientCommandSchema.parse({
        id: "5",
        type: "interaction.respond",
        taskId: "11111111-1111-4111-8111-111111111111",
        payload: { requestId: "ui-1", value: "alpha" },
      }).payload,
    ).toEqual({ requestId: "ui-1", value: "alpha" });
    expect(
      clientCommandSchema.parse({
        id: "6",
        type: "checkpoint.restore",
        taskId: "11111111-1111-4111-8111-111111111111",
        payload: { path: "note.txt" },
      }).payload,
    ).toEqual({ path: "note.txt" });
    expect(
      clientCommandSchema.parse({
        id: "7",
        type: "term.run",
        taskId: "11111111-1111-4111-8111-111111111111",
        payload: { command: "echo hi" },
      }).payload,
    ).toEqual({ command: "echo hi" });
    expect(
      clientCommandSchema.parse({
        id: "8",
        type: "term.interrupt",
        taskId: "11111111-1111-4111-8111-111111111111",
      }).type,
    ).toBe("term.interrupt");
    expect(
      clientCommandSchema.parse({
        id: "8b",
        type: "term.openNative",
        taskId: "11111111-1111-4111-8111-111111111111",
      }).type,
    ).toBe("term.openNative");
    expect(
      clientCommandSchema.parse({
        id: "9",
        type: "resources.skill.set",
        taskId: "11111111-1111-4111-8111-111111111111",
        payload: { path: "/tmp/SKILL.md", enabled: false },
      }).payload,
    ).toEqual({ path: "/tmp/SKILL.md", enabled: false });
    expect(
      clientCommandSchema.parse({
        id: "9b",
        type: "resources.extension.set",
        taskId: "11111111-1111-4111-8111-111111111111",
        payload: { path: "/tmp/demo.ts", enabled: false },
      }).payload,
    ).toEqual({ path: "/tmp/demo.ts", enabled: false });
    expect(
      piResourcesSchema.parse({
        agentsFiles: [],
        skills: [],
        templates: [],
        trustProject: false,
      }),
    ).toMatchObject({ extensions: [], packages: [] });
    expect(
      clientCommandSchema.parse({
        id: "10",
        type: "workItem.create",
        payload: {
          title: "fix login",
          cwd: "/tmp/project",
          description: "handle 401",
          acceptanceCriteria: "tests pass",
          start: true,
        },
      }).payload,
    ).toMatchObject({
      title: "fix login",
      cwd: "/tmp/project",
      description: "handle 401",
      acceptanceCriteria: "tests pass",
      start: true,
    });
    expect(
      clientCommandSchema.parse({
        id: "11",
        type: "workItem.feedback",
        payload: { id: "11111111-1111-4111-8111-111111111111", text: "also handle 403" },
      }).payload,
    ).toEqual({ id: "11111111-1111-4111-8111-111111111111", text: "also handle 403" });
    expect(
      clientCommandSchema.parse({
        id: "12",
        type: "workItem.accept",
        payload: { id: "11111111-1111-4111-8111-111111111111" },
      }).type,
    ).toBe("workItem.accept");
  });

  it("accepts partial Pi session stats and fills context usage", () => {
    const stats = normalizeSessionStats(
      { totalMessages: 4, tokens: { total: 1200 } },
      { toolCalls: 2, contextWindow: 100_000 },
    );
    expect(stats.totalMessages).toBe(4);
    expect(stats.toolCalls).toBe(2);
    expect(stats.contextUsage?.tokens).toBe(1200);
    expect(stats.contextUsage?.contextWindow).toBe(100_000);
    expect(stats.contextUsage?.percent).toBe(1.2);
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

  it("keeps a provider 401 visible after an empty assistant message starts", () => {
    const store = useAgentStore.getState();
    store.setActiveTask("t-401");
    const base = {
      serverInstanceId: "server-401",
      taskId: "t-401",
      timestamp: new Date().toISOString(),
    };
    store.applyEvent({
      ...base,
      eventId: "e1",
      sequence: 1,
      type: "server.error",
      payload: {
        code: "pi.retry",
        message: "登录已失效或密钥不正确（HTTP 401）。打开设置检查 API Key，或重新登录。",
      },
    });
    store.applyEvent({
      ...base,
      eventId: "e2",
      sequence: 2,
      type: "message.started",
      payload: {
        message: {
          id: "asst-empty",
          role: "assistant",
          text: "",
          createdAt: base.timestamp,
          streaming: true,
        },
      },
    });
    expect(useAgentStore.getState().serverError).toMatch(/401/);

    store.applyEvent({
      ...base,
      eventId: "e3",
      sequence: 3,
      type: "message.started",
      payload: {
        message: {
          id: "user-retry",
          role: "user",
          text: "再试一次",
          createdAt: base.timestamp,
          streaming: false,
        },
      },
    });
    expect(useAgentStore.getState().serverError).toBeNull();
  });
});
