import { useEffect, useRef, useState } from "react";
import { stripModePrefix, type TimelineMessage, type ToolExecution } from "@mowen/protocol";
import { ToolExecutionRow } from "./ToolExecutionRow";

type Props = {
  messages: TimelineMessage[];
  tools: ToolExecution[];
  canRewrite?: boolean;
  onRetry?: (messageId: string, text: string) => void;
  onClone?: () => void;
};

function ThinkingBlock({ message }: { message: TimelineMessage }) {
  const [open, setOpen] = useState(false);
  if (!message.thinking) return null;
  const duration =
    typeof message.thinkingDurationMs === "number"
      ? `${Math.max(1, Math.round(message.thinkingDurationMs / 100) / 10)}s`
      : null;
  return (
    <div className="mb-2">
      <button
        type="button"
        className="pressable min-h-7 text-left text-[12px] text-mute"
        onClick={() => setOpen((value) => !value)}
      >
        思考中{duration ? ` · ${duration}` : ""} {open ? "收起" : "展开"}
      </button>
      {open ? (
        <pre className="fade-in mt-1 whitespace-pre-wrap text-xs leading-6 text-mute">{message.thinking}</pre>
      ) : null}
    </div>
  );
}

function renderAssistant(text: string) {
  const chunks = text.split(/```/);
  return chunks.map((chunk, index) => {
    if (index % 2 === 1) {
      const newline = chunk.indexOf("\n");
      const body = newline === -1 ? chunk : chunk.slice(newline + 1);
      return (
        <pre
          key={index}
          className="my-3 overflow-x-auto rounded-[10px] bg-canvas px-3 py-2.5 font-mono text-[12.5px] leading-5 text-ink"
        >
          {body}
        </pre>
      );
    }
    return (
      <p key={index} className="whitespace-pre-wrap text-[15px] leading-[1.47] text-pretty text-ink">
        {chunk}
      </p>
    );
  });
}

function UserMessage({
  message,
  canRewrite,
  onRetry,
}: {
  message: TimelineMessage;
  canRewrite?: boolean;
  onRetry?: (messageId: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stripModePrefix(message.text));
  return (
    <article className="ml-auto max-w-[78%] rounded-[18px] bg-bubble px-4 py-2.5 text-[15px] leading-[1.47] text-ink">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-20 w-full resize-y bg-transparent text-[15px] leading-6 text-ink"
            aria-label="编辑消息"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="pressable h-7 px-2 text-[12px] text-mute" onClick={() => setEditing(false)}>
              取消
            </button>
            <button
              type="button"
              className="pressable h-7 px-2 text-[12px] text-accent"
              onClick={() => {
                onRetry?.(message.id, draft);
                setEditing(false);
              }}
            >
              从这里重来
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{stripModePrefix(message.text)}</p>
          {canRewrite && onRetry ? (
            <button
              type="button"
              className="pressable mt-1.5 h-7 text-[12px] text-mute"
              onClick={() => {
                setDraft(stripModePrefix(message.text));
                setEditing(true);
              }}
            >
              编辑并重试
            </button>
          ) : null}
        </>
      )}
    </article>
  );
}

export function ConversationTimeline({ messages, tools, canRewrite, onRetry, onClone }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, tools]);

  const toolById = new Map(tools.map((tool) => [tool.toolCallId, tool]));
  const renderedTools = new Set<string>();

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-4 py-7 sm:px-6">
      {messages.length === 0 ? (
        <div className="pt-20 text-center">
          <p className="text-[13px] leading-6 text-mute">还没有消息。直接在下面输入，开始聊天。</p>
        </div>
      ) : null}
      {messages.length > 0 && onClone ? (
        <div className="flex justify-end">
          <button type="button" className="pressable h-7 text-[12px] text-mute" onClick={onClone}>
            复制对话
          </button>
        </div>
      ) : null}
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <UserMessage key={message.id} message={message} canRewrite={canRewrite} onRetry={onRetry} />
          );
        }
        if (message.role === "toolResult") {
          const tool = message.toolCallId ? toolById.get(message.toolCallId) : undefined;
          if (tool && !renderedTools.has(tool.toolCallId)) {
            renderedTools.add(tool.toolCallId);
            return <ToolExecutionRow key={tool.toolCallId} tool={tool} />;
          }
          return null;
        }
        if (message.role === "assistant" && !message.text && !message.thinking) {
          return null;
        }
        return (
          <article key={message.id} className="mr-auto max-w-[90%]">
            <ThinkingBlock message={message} />
            {message.text ? renderAssistant(message.text) : null}
          </article>
        );
      })}
      {tools
        .filter((tool) => !renderedTools.has(tool.toolCallId))
        .map((tool) => (
          <ToolExecutionRow key={tool.toolCallId} tool={tool} />
        ))}
      <div ref={endRef} />
    </div>
  );
}
