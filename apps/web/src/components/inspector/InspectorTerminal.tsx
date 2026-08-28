import { useEffect, useRef, useState } from "react";
import { Square } from "lucide-react";
import { isNearBottom } from "../../lib/stick-to-bottom";
import { useAgentStore } from "../../stores/agent-store";
import { socketClient } from "../../transport/socket-client";

type Props = {
  taskId: string | null;
  cwd: string | null;
};

export function InspectorTerminal({ taskId, cwd }: Props) {
  const session = useAgentStore((state) => (taskId ? state.termByTask[taskId] : undefined));
  const echoTerm = useAgentStore((state) => state.echoTerm);
  const clearTerm = useAgentStore((state) => state.clearTerm);
  const [draft, setDraft] = useState("");
  const [pinned, setPinned] = useState(true);
  const scrollerRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const text = session?.text ?? "";
  const running = Boolean(session?.running);

  useEffect(() => {
    inputRef.current?.focus();
  }, [taskId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [text, pinned]);

  function run(): void {
    const command = draft.trim();
    if (!taskId || !command || running) return;
    echoTerm(taskId, command);
    setDraft("");
    setPinned(true);
    void socketClient.send("term.run", { command }, taskId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "命令发送失败";
      useAgentStore.setState((state) => {
        const prev = state.termByTask[taskId] ?? { text: "", running: false };
        const prefix = prev.text && !prev.text.endsWith("\n") ? "\n" : "";
        return {
          termByTask: {
            ...state.termByTask,
            [taskId]: { text: `${prev.text}${prefix}${message}\n`, running: false },
          },
        };
      });
    });
  }

  function interrupt(): void {
    if (!taskId || !running) return;
    void socketClient.send("term.interrupt", {}, taskId);
  }

  if (!taskId) {
    return <p className="p-3 text-sm text-mute">打开一个对话后再用终端。</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="min-w-0 truncate font-mono text-[11px] text-mute" title={cwd ?? undefined}>
          {cwd || "工作文件夹"}
        </span>
        <button
          type="button"
          className="pressable ml-auto h-7 shrink-0 px-2 text-[12px] text-mute"
          onClick={() => clearTerm(taskId)}
        >
          清空
        </button>
      </div>
      <pre
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[12px] leading-5 text-ink"
        onScroll={(event) => setPinned(isNearBottom(event.currentTarget))}
      >
        {text || "在工作文件夹里跑命令。没有完整 PTY，vim 这类交互程序跑不了。"}
      </pre>
      <form
        className="flex shrink-0 items-center gap-1 border-t border-line px-2 py-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <span className="shrink-0 font-mono text-[12px] text-mute">$</span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "c" && event.ctrlKey && running) {
              event.preventDefault();
              interrupt();
            }
          }}
          disabled={!taskId}
          aria-label="终端命令"
          placeholder={running ? "正在执行…" : "ls"}
          className="h-7 min-h-7 min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink placeholder:text-mute"
        />
        {running ? (
          <button
            type="button"
            className="pressable icon-btn"
            aria-label="停止命令"
            onClick={interrupt}
          >
            <Square size={12} />
          </button>
        ) : (
          <button type="submit" className="pressable h-7 px-2 text-[12px] text-mute" disabled={!draft.trim()}>
            运行
          </button>
        )}
      </form>
    </div>
  );
}
