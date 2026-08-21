import { useEffect, useRef, useState } from "react";
import type { TimelineMessage, ToolExecution } from "@ohmypi/protocol";
import { ToolExecutionRow } from "./ToolExecutionRow";

type Props = {
  messages: TimelineMessage[];
  tools: ToolExecution[];
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
        className="pressable min-h-10 text-left text-[12px] text-mute"
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
          className="my-3 overflow-x-auto rounded-2xl bg-elevated px-3 py-2 font-mono text-[13px] leading-6 text-ink"
        >
          {body}
        </pre>
      );
    }
    return (
      <p key={index} className="whitespace-pre-wrap text-[15px] leading-7 text-pretty text-ink">
        {chunk}
      </p>
    );
  });
}

export function ConversationTimeline({ messages, tools }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, tools]);

  const toolById = new Map(tools.map((tool) => [tool.toolCallId, tool]));
  const renderedTools = new Set<string>();

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-6 sm:px-6">
      {messages.length === 0 ? (
        <div className="pt-16 text-center">
          <p className="text-sm leading-6 text-mute">还没有消息。直接在下面输入，开始聊天。</p>
        </div>
      ) : null}
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <article
              key={message.id}
              className="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-elevated px-4 py-3 text-[15px] leading-7 text-ink"
            >
              {message.text}
            </article>
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
