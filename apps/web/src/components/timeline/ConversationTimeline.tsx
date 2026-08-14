import { useEffect, useRef, useState } from "react";
import type { TimelineMessage, ToolExecution } from "@mypi/protocol";
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
    <div className="mb-3">
      <button
        type="button"
        className="pressable min-h-10 text-left font-mono text-[11px] text-mute tabular"
        onClick={() => setOpen((value) => !value)}
      >
        Thinking {duration ? `· ${duration}` : ""} {open ? "hide" : "show"}
      </button>
      {open ? (
        <pre className="fade-in mt-1 whitespace-pre-wrap font-mono text-xs leading-6 text-mute">{message.thinking}</pre>
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
          className="my-3 overflow-x-auto rounded-md bg-canvas px-3 py-2 font-mono text-[13px] leading-6 text-ink"
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
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-6 py-6">
      {messages.length === 0 ? (
        <div className="pt-10">
          <p className="text-sm text-mute">No turns yet. Choose a project directory, then send the next action.</p>
        </div>
      ) : null}
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <article
              key={message.id}
              className="rounded-md bg-elevated px-4 py-3 text-[15px] leading-7 text-ink"
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
          <article key={message.id} className="max-w-[65ch]">
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
