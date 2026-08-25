import { createHash } from "node:crypto";
import type { TimelineMessage, ToolExecution } from "@mowen/protocol";
import type { RpcEvent } from "./rpc-client.js";

export type NormalizedPiEvent =
  | { kind: "status"; streaming: boolean; settled?: boolean }
  | { kind: "message.started"; message: TimelineMessage }
  | { kind: "message.delta"; messageId: string; field: "text" | "thinking"; delta: string }
  | { kind: "message.completed"; message: TimelineMessage }
  | { kind: "tool.started"; tool: ToolExecution }
  | { kind: "tool.updated"; tool: Partial<ToolExecution> & { toolCallId: string } }
  | { kind: "tool.completed"; tool: Partial<ToolExecution> & { toolCallId: string } }
  | { kind: "approval.ui"; requestId: string; method: string; title?: string; message?: string }
  | { kind: "extension_error"; error: string }
  | { kind: "agent_error"; error: string }
  | { kind: "runtime.compaction"; phase: "start" | "end"; reason?: string }
  | {
      kind: "runtime.retry";
      phase: "start" | "end";
      attempt?: number;
      maxAttempts?: number;
      error?: string;
    }
  | { kind: "runtime.queue"; steering: string[]; followUp: string[] }
  | { kind: "ignored" };

function nowIso(timestamp?: number): string {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;
    if (record.type === "text" && typeof record.text === "string") {
      parts.push(record.text);
    }
  }
  return parts.join("");
}

function thinkingFromContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const record = block as Record<string, unknown>;
    if (record.type === "thinking" && typeof record.thinking === "string") {
      parts.push(record.thinking);
    }
  }
  return parts.length > 0 ? parts.join("") : undefined;
}

function messageIdFor(role: string, timestamp: unknown, extra: string): string {
  const stableExtra = role === "assistant" ? "" : extra;
  return createHash("sha1").update(`${role}:${String(timestamp)}:${stableExtra}`).digest("hex").slice(0, 16);
}

function targetFromArgs(toolName: string, args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const record = args as Record<string, unknown>;
  if (toolName === "bash" && typeof record.command === "string") return record.command;
  if (typeof record.path === "string") return record.path;
  return undefined;
}

export function resultTextFromPi(result: unknown): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result !== "object") return String(result);
  const record = result as Record<string, unknown>;
  if (Array.isArray(record.content)) return textFromContent(record.content);
  if (typeof record.text === "string") return record.text;
  return "";
}

export function normalizePiEvent(event: RpcEvent): NormalizedPiEvent {
  switch (event.type) {
    case "agent_start":
      return { kind: "status", streaming: true };
    case "agent_settled":
      return { kind: "status", streaming: false, settled: true };
    case "message_start": {
      const message = event.message as Record<string, unknown> | undefined;
      if (!message) return { kind: "ignored" };
      const role = String(message.role ?? "assistant");
      if (role !== "user" && role !== "assistant" && role !== "toolResult") {
        return { kind: "ignored" };
      }
      const id = messageIdFor(role, message.timestamp, textFromContent(message.content).slice(0, 24));
      return {
        kind: "message.started",
        message: {
          id,
          role,
          text: textFromContent(message.content),
          thinking: thinkingFromContent(message.content),
          createdAt: nowIso(typeof message.timestamp === "number" ? message.timestamp : undefined),
          streaming: role === "assistant",
          toolCallId: typeof message.toolCallId === "string" ? message.toolCallId : undefined,
          toolName: typeof message.toolName === "string" ? message.toolName : undefined,
          isError: Boolean(message.isError),
        },
      };
    }
    case "message_update": {
      const delta = event.assistantMessageEvent as Record<string, unknown> | undefined;
      if (!delta || typeof delta.type !== "string") return { kind: "ignored" };
      if (delta.type === "text_delta" && typeof delta.delta === "string") {
        return { kind: "message.delta", messageId: "assistant-live", field: "text", delta: delta.delta };
      }
      if (delta.type === "thinking_delta" && typeof delta.delta === "string") {
        return {
          kind: "message.delta",
          messageId: "assistant-live",
          field: "thinking",
          delta: delta.delta,
        };
      }
      return { kind: "ignored" };
    }
    case "message_end": {
      const message = event.message as Record<string, unknown> | undefined;
      if (!message) return { kind: "ignored" };
      const role = String(message.role ?? "assistant");
      if (role !== "user" && role !== "assistant" && role !== "toolResult") {
        return { kind: "ignored" };
      }
      const id = messageIdFor(role, message.timestamp, textFromContent(message.content).slice(0, 24));
      return {
        kind: "message.completed",
        message: {
          id,
          role,
          text: textFromContent(message.content),
          thinking: thinkingFromContent(message.content),
          createdAt: nowIso(typeof message.timestamp === "number" ? message.timestamp : undefined),
          streaming: false,
          toolCallId: typeof message.toolCallId === "string" ? message.toolCallId : undefined,
          toolName: typeof message.toolName === "string" ? message.toolName : undefined,
          isError: Boolean(message.isError),
        },
      };
    }
    case "tool_execution_start": {
      const toolCallId = String(event.toolCallId ?? "");
      const toolName = String(event.toolName ?? "tool");
      return {
        kind: "tool.started",
        tool: {
          toolCallId,
          toolName,
          target: targetFromArgs(toolName, event.args),
          args: event.args,
          status: "running",
          startedAt: nowIso(),
        },
      };
    }
    case "tool_execution_update": {
      const toolCallId = String(event.toolCallId ?? "");
      return {
        kind: "tool.updated",
        tool: {
          toolCallId,
          resultText: resultTextFromPi(event.partialResult),
          status: "running",
        },
      };
    }
    case "tool_execution_end": {
      const toolCallId = String(event.toolCallId ?? "");
      const isError = Boolean(event.isError);
      const text = resultTextFromPi(event.result);
      const blocked = /block|denied|timed out|not allowed/i.test(text);
      return {
        kind: "tool.completed",
        tool: {
          toolCallId,
          resultText: text,
          isError,
          status: isError ? (blocked ? "blocked" : "failed") : "succeeded",
          endedAt: nowIso(),
        },
      };
    }
    case "extension_ui_request":
      return {
        kind: "approval.ui",
        requestId: String(event.id ?? ""),
        method: String(event.method ?? ""),
        title: typeof event.title === "string" ? event.title : undefined,
        message: typeof event.message === "string" ? event.message : undefined,
      };
    case "extension_error":
      return { kind: "extension_error", error: String(event.error ?? "Extension error") };
    case "error":
    case "agent_error":
    case "turn_error":
      return {
        kind: "agent_error",
        error: String(event.error ?? event.message ?? event.errorMessage ?? "Pi error"),
      };
    case "compaction_start":
      return {
        kind: "runtime.compaction",
        phase: "start",
        reason: typeof event.reason === "string" ? event.reason : undefined,
      };
    case "compaction_end":
      return {
        kind: "runtime.compaction",
        phase: "end",
        reason: typeof event.reason === "string" ? event.reason : undefined,
      };
    case "auto_retry_start":
      return {
        kind: "runtime.retry",
        phase: "start",
        attempt: typeof event.attempt === "number" ? event.attempt : undefined,
        maxAttempts: typeof event.maxAttempts === "number" ? event.maxAttempts : undefined,
        error: typeof event.errorMessage === "string" ? event.errorMessage : undefined,
      };
    case "auto_retry_end": {
      const finalError =
        typeof event.finalError === "string"
          ? event.finalError
          : typeof event.error === "string"
            ? event.error
            : typeof event.errorMessage === "string"
              ? event.errorMessage
              : undefined;
      return {
        kind: "runtime.retry",
        phase: "end",
        attempt: typeof event.attempt === "number" ? event.attempt : undefined,
        error: finalError?.trim() ? finalError : undefined,
      };
    }
    case "queue_update":
      return {
        kind: "runtime.queue",
        steering: Array.isArray(event.steering) ? event.steering.map((item) => String(item)) : [],
        followUp: Array.isArray(event.followUp) ? event.followUp.map((item) => String(item)) : [],
      };
    default:
      return { kind: "ignored" };
  }
}

export function piMessagesToTimeline(messages: unknown[]): TimelineMessage[] {
  const out: TimelineMessage[] = [];
  for (const item of messages) {
    if (!item || typeof item !== "object") continue;
    const message = item as Record<string, unknown>;
    const role = String(message.role ?? "");
    if (role !== "user" && role !== "assistant" && role !== "toolResult") continue;
    out.push({
      id: messageIdFor(role, message.timestamp, textFromContent(message.content).slice(0, 24)),
      role,
      text: textFromContent(message.content),
      thinking: thinkingFromContent(message.content),
      createdAt: nowIso(typeof message.timestamp === "number" ? message.timestamp : undefined),
      streaming: false,
      toolCallId: typeof message.toolCallId === "string" ? message.toolCallId : undefined,
      toolName: typeof message.toolName === "string" ? message.toolName : undefined,
      isError: Boolean(message.isError),
    });
  }
  return out;
}
