import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ServerEvent, TimelineMessage } from "@qingzhou/protocol";
import { useAgentStore } from "../../apps/web/src/stores/agent-store.ts";
import { failPendingRequests } from "../../apps/web/src/lib/pending-rpc.ts";
import { readComposerDraft, writeComposerDraft } from "../../apps/web/src/lib/composer-drafts.ts";
import { matchApprovalTool } from "../../apps/server/src/pi/process-supervisor.ts";

function event(partial: Omit<ServerEvent, "eventId" | "timestamp" | "serverInstanceId"> & { serverInstanceId?: string }): ServerEvent {
  return {
    eventId: `${partial.taskId}-${partial.sequence}`,
    serverInstanceId: partial.serverInstanceId ?? "server-chat",
    timestamp: new Date().toISOString(),
    ...partial,
  } as ServerEvent;
}

function userMessage(id: string, text: string): TimelineMessage {
  return {
    id,
    role: "user",
    text,
    createdAt: "2026-09-07T00:00:00.000Z",
  };
}

describe("pending RPC", () => {
  it("rejects every waiter and clears the map", async () => {
    const pending = new Map<string, { reject: (error: Error) => void; resolve: (value: unknown) => void }>();
    const first = new Promise((_, reject) => pending.set("a", { resolve: () => undefined, reject }));
    const second = new Promise((_, reject) => pending.set("b", { resolve: () => undefined, reject }));
    failPendingRequests(pending, new Error("Socket closed"));
    await expect(first).rejects.toThrow("Socket closed");
    await expect(second).rejects.toThrow("Socket closed");
    expect(pending.size).toBe(0);
  });
});

describe("composer drafts", () => {
  it("stores drafts per task and drops empty ones", () => {
    writeComposerDraft("task-a", "hello from a");
    writeComposerDraft("task-b", "hello from b");
    expect(readComposerDraft("task-a")).toBe("hello from a");
    expect(readComposerDraft("task-b")).toBe("hello from b");
    writeComposerDraft("task-a", "   ");
    expect(readComposerDraft("task-a")).toBe("");
  });
});

describe("agent store transcripts", () => {
  it("keeps background task deltas and swaps them in on activate", () => {
    const store = useAgentStore.getState();
    store.setActiveTask("task-a");
    store.applyEvent(
      event({
        taskId: "task-a",
        sequence: 1,
        type: "message.started",
        payload: { message: userMessage("a-1", "from A") },
      }),
    );
    store.setActiveTask("task-b");
    expect(useAgentStore.getState().messages).toEqual([]);
    store.applyEvent(
      event({
        taskId: "task-a",
        sequence: 2,
        type: "message.started",
        payload: { message: userMessage("a-2", "still A") },
      }),
    );
    expect(useAgentStore.getState().messages).toEqual([]);
    store.setActiveTask("task-a");
    expect(useAgentStore.getState().messages.map((item) => item.text)).toEqual(["from A", "still A"]);
  });

  it("does not replace the visible transcript with a snapshot for another task", () => {
    const store = useAgentStore.getState();
    store.setActiveTask("task-visible");
    store.applyEvent(
      event({
        taskId: "task-visible",
        sequence: 10,
        type: "message.started",
        payload: { message: userMessage("v-1", "visible") },
      }),
    );
    store.applyEvent(
      event({
        taskId: "task-other",
        sequence: 11,
        type: "snapshot",
        payload: {
          tasks: useAgentStore.getState().tasks,
          activeTaskId: "task-other",
          messages: [userMessage("o-1", "other session")],
          tools: [],
          approval: null,
          models: [],
          thinkingLevels: ["off"],
          stats: null,
          piVersion: null,
          piAvailable: true,
          piError: null,
          mutations: "approval",
          allowedRoots: [],
          dataDir: "",
          maxProcesses: 3,
        },
      }),
    );
    expect(useAgentStore.getState().activeTaskId).toBe("task-visible");
    expect(useAgentStore.getState().messages.map((item) => item.text)).toEqual(["visible"]);
  });
});

describe("approval tool matching", () => {
  it("only binds an approval to the matching toolCallId", () => {
    const running = { toolCallId: "running-1", toolName: "bash", status: "running" as const };
    const target = { toolCallId: "write-1", toolName: "write", status: "running" as const };
    expect(matchApprovalTool([running, target], "write-1")?.toolName).toBe("write");
    expect(matchApprovalTool([running, target], "")).toBeUndefined();
    expect(matchApprovalTool([running, target], "missing")).toBeUndefined();
  });
});

describe("conversation UI contracts", () => {
  it("dismisses mention menus on Escape and restores failed drafts", () => {
    const menu = readFileSync(path.resolve("apps/web/src/components/composer/MentionMenu.tsx"), "utf8");
    const composer = readFileSync(path.resolve("apps/web/src/components/composer/PromptComposer.tsx"), "utf8");
    const layout = readFileSync(path.resolve("apps/web/src/layouts/WorkbenchLayout.tsx"), "utf8");
    const timeline = readFileSync(path.resolve("apps/web/src/components/timeline/ConversationTimeline.tsx"), "utf8");
    const socket = readFileSync(path.resolve("apps/web/src/transport/socket-client.ts"), "utf8");
    const approval = readFileSync(path.resolve("apps/web/src/components/approval/ApprovalSheet.tsx"), "utf8");
    const taskService = readFileSync(path.resolve("apps/server/src/tasks/task-service.ts"), "utf8");

    expect(menu).toContain("stopPropagation");
    expect(menu).toContain("onDismiss");
    expect(composer).toContain("menuDismissed");
    expect(composer).toContain("defaultValue={value}");
    expect(composer).toContain("nextComposerDomValue");
    expect(composer).not.toMatch(/<textarea[\s\S]*\n\s*value=\{value\}/);
    expect(layout).toContain("function WorkbenchConversation");
    expect(layout).toContain("const hasTurns = useAgentStore");
    expect(layout).toContain("isEditableTarget(event.target)");
    expect(layout).toContain("setComposerImages(images)");
    expect(layout).toContain("readComposerDraft");
    expect(layout).toContain('role="alert"');
    expect(layout).toContain("clearRequestError");
    expect(timeline).toContain("回到最新");
    expect(timeline).toContain("克隆会话");
    expect(timeline).toContain("复制消息");
    expect(timeline).toContain('role="log"');
    expect(timeline).toContain("MessageImages");
    expect(socket).toContain("failPendingRequests");
    expect(approval).toContain("已超时");
    expect(approval).toContain("disabled={remaining <= 0}");
    expect(taskService).toContain("scheduleAbortFallback");
    expect(taskService).not.toMatch(/rpc\(taskId, \{ type: "abort" \}\);\s*\n\s*\} finally \{\s*\n\s*await this\.apply\(taskId, "abort_confirmed"\)/);
  });
});
