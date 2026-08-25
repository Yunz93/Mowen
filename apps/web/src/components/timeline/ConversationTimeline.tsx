import { useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from "react";
import { stripModePrefix, type TimelineMessage, type ToolExecution } from "@mowen/protocol";
import { ToolExecutionRow } from "./ToolExecutionRow";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { ConversationSearchBar } from "./ConversationSearchBar";
import { findScrollParent, isNearBottom } from "../../lib/stick-to-bottom";
import {
  conversationMessageDomId,
  matchConversationMessages,
  OPEN_CONVERSATION_SEARCH_EVENT,
  stepSearchIndex,
} from "../../lib/conversation-search";

type Props = {
  messages: TimelineMessage[];
  tools: ToolExecution[];
  canRewrite?: boolean;
  error?: string | null;
  onRetry?: (messageId: string, text: string) => void;
  onClone?: () => void;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

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

function UserMessage({
  message,
  canRewrite,
  highlighted,
  onRetry,
}: {
  message: TimelineMessage;
  canRewrite?: boolean;
  highlighted?: boolean;
  onRetry?: (messageId: string, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stripModePrefix(message.text));
  return (
    <article
      id={conversationMessageDomId(message.id)}
      className={`flex w-fit max-w-[78%] shrink-0 flex-col self-end rounded-[18px] bg-bubble px-4 py-2.5 text-[15px] leading-[1.47] text-ink ${highlighted ? "conversation-search-hit" : ""}`}
    >
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
              className="pressable mt-2 h-7 text-[12px] text-mute"
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

const AssistantMessage = memo(function AssistantMessage({
  message,
  highlighted,
}: {
  message: TimelineMessage;
  highlighted?: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <article
      id={conversationMessageDomId(message.id)}
      className={`mr-auto w-full max-w-[90%] shrink-0 self-start ${highlighted ? "conversation-search-hit" : ""}`}
    >
      <ThinkingBlock message={message} />
      <AssistantMarkdown text={message.text} streaming={message.streaming} />
      {message.text ? (
        <button
          type="button"
          className="pressable mt-2 h-7 text-[12px] text-mute"
          aria-label="复制回复"
          onClick={() => {
            void copyText(message.text).then((ok) => {
              setCopyState(ok ? "copied" : "failed");
              window.setTimeout(() => setCopyState("idle"), 1600);
            });
          }}
        >
          {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制"}
        </button>
      ) : null}
    </article>
  );
});

export function ConversationTimeline({ messages, tools, canRewrite, error, onRetry, onClone }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pinnedRef = useRef(true);
  const userCountRef = useRef(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const hits = useMemo(
    () => (searchOpen ? matchConversationMessages(messages, searchQuery) : []),
    [messages, searchOpen, searchQuery],
  );
  const safeIndex = hits.length === 0 ? 0 : Math.min(activeIndex, hits.length - 1);
  const activeMessageId = hits[safeIndex];

  useLayoutEffect(() => {
    const scroller = document.getElementById("main-content") ?? findScrollParent(rootRef.current);
    if (!scroller) return;

    const syncPin = () => {
      pinnedRef.current = isNearBottom(scroller);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) pinnedRef.current = false;
      else syncPin();
    };
    scroller.addEventListener("scroll", syncPin, { passive: true });
    scroller.addEventListener("wheel", onWheel, { passive: true, capture: true });
    return () => {
      scroller.removeEventListener("scroll", syncPin);
      scroller.removeEventListener("wheel", onWheel, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (searchOpen) {
      pinnedRef.current = false;
      return;
    }
    const scroller = document.getElementById("main-content") ?? findScrollParent(rootRef.current);
    if (!scroller) return;
    const userCount = messages.reduce((count, message) => count + (message.role === "user" ? 1 : 0), 0);
    if (userCount > userCountRef.current) pinnedRef.current = true;
    else if (!isNearBottom(scroller)) pinnedRef.current = false;
    userCountRef.current = userCount;
    if (!pinnedRef.current) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [messages, tools, searchOpen]);

  useEffect(() => {
    if (!searchOpen || !activeMessageId) return;
    pinnedRef.current = false;
    document.getElementById(conversationMessageDomId(activeMessageId))?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [activeMessageId, searchOpen, searchQuery]);

  useEffect(() => {
    const focusSearch = () => {
      setSearchOpen(true);
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        focusSearch();
      }
      if (event.key === "Escape" && searchOpen) {
        event.preventDefault();
        event.stopPropagation();
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    const onOpen = () => focusSearch();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener(OPEN_CONVERSATION_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener(OPEN_CONVERSATION_SEARCH_EVENT, onOpen);
    };
  }, [searchOpen]);

  const toolById = new Map(tools.map((tool) => [tool.toolCallId, tool]));
  const renderedTools = new Set<string>();

  return (
    <div ref={rootRef} className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-7 sm:px-6">
      {searchOpen ? (
        <ConversationSearchBar
          query={searchQuery}
          current={hits.length === 0 ? 0 : safeIndex + 1}
          total={hits.length}
          inputRef={searchInputRef}
          onQueryChange={(value) => {
            setSearchQuery(value);
            setActiveIndex(0);
          }}
          onPrev={() => setActiveIndex((index) => stepSearchIndex(index, hits.length, -1))}
          onNext={() => setActiveIndex((index) => stepSearchIndex(index, hits.length, 1))}
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
        />
      ) : null}
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
        const highlighted = searchOpen && Boolean(searchQuery.trim()) && message.id === activeMessageId;
        if (message.role === "user") {
          return (
            <UserMessage
              key={message.id}
              message={message}
              canRewrite={canRewrite}
              highlighted={highlighted}
              onRetry={onRetry}
            />
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
        return <AssistantMessage key={message.id} message={message} highlighted={highlighted} />;
      })}
      {tools
        .filter((tool) => !renderedTools.has(tool.toolCallId))
        .map((tool) => (
          <ToolExecutionRow key={tool.toolCallId} tool={tool} />
        ))}
      {error ? (
        <div
          role="alert"
          className="whitespace-pre-wrap rounded-[14px] border border-[color-mix(in_oklch,var(--color-danger)_22%,transparent)] bg-[color-mix(in_oklch,var(--color-danger)_8%,transparent)] px-4 py-3 text-[13px] leading-6 text-danger"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
