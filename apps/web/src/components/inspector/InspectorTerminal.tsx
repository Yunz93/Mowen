import { useEffect, useRef, useState } from "react";
import { Square, SquareTerminal } from "lucide-react";
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
  const [nativeBusy, setNativeBusy] = useState(false);
  const [nativeError, setNativeError] = useState("");
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

  async function openNative(): Promise<void> {
    if (!taskId || nativeBusy) return;
    setNativeBusy(true);
    setNativeError("");
    try {
      await socketClient.send("term.openNative", {}, taskId);
    } catch (error: unknown) {
      setNativeError(error instanceof Error ? error.message : "无法打开系统终端");
    } finally {
      setNativeBusy(false);
    }
  }

  if (!taskId) {
    return <p className="p-3 text-sm text-mute">打开一个对话后再用终端。</p>;
  }

  return (
    <div className="term-shell flex h-full min-h-0 flex-col">
      <div className="term-head h-8">
        <span
          aria-hidden="true"
          className={`term-status ${running ? "term-status-running" : ""}`}
          title={running ? "命令运行中" : "终端就绪"}
        />
        <span className="term-path" title={cwd ?? undefined}>
          {cwd || "工作文件夹"}
        </span>
        <button
          type="button"
          className="term-head-btn pressable ml-auto"
          disabled={nativeBusy}
          aria-label="打开 zsh 终端"
          title="在系统终端里打开 zsh"
          onClick={() => void openNative()}
        >
          <SquareTerminal size={12} />
          {nativeBusy ? "正在打开…" : "打开 zsh"}
        </button>
        <button type="button" className="term-head-btn pressable" onClick={() => clearTerm(taskId)}>
          清空
        </button>
      </div>
      {nativeError ? (
        <p className="term-error border-b border-white/10 px-3 py-1.5 text-[12px]">{nativeError}</p>
      ) : null}
      <pre
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all px-3.5 py-2.5 font-mono text-[12px] leading-5"
        onScroll={(event) => setPinned(isNearBottom(event.currentTarget))}
      >
        {text || (
          <span className="term-hint">
            在工作文件夹里跑命令。没有完整 PTY，vim 这类交互程序跑不了。需要完整终端时点「打开 zsh」。
          </span>
        )}
      </pre>
      <form
        className="term-input-line"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <span className="term-prompt" aria-hidden="true">
          $
        </span>
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
          className="term-input"
        />
        {running ? (
          <button type="button" className="term-head-btn pressable" aria-label="停止命令" onClick={interrupt}>
            <Square size={12} />
          </button>
        ) : (
          <button type="submit" className="term-run pressable" disabled={!draft.trim()}>
            运行
          </button>
        )}
      </form>
    </div>
  );
}
