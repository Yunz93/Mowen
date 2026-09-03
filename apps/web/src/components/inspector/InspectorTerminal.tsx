import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Square, Trash2 } from "lucide-react";
import { isNearBottom } from "../../lib/stick-to-bottom";
import { useAgentStore } from "../../stores/agent-store";
import { socketClient } from "../../transport/socket-client";

type Props = { taskId: string | null; cwd: string | null };

function keyToInput(event: KeyboardEvent<HTMLInputElement>): string | null {
  if (event.ctrlKey && event.key.length === 1) {
    const code = event.key.toUpperCase().charCodeAt(0) - 64;
    if (code > 0 && code < 32) return String.fromCharCode(code);
  }
  if (event.key === "Enter") return "\r";
  if (event.key === "Backspace") return "\x7f";
  if (event.key === "Tab") return "\t";
  if (event.key === "Escape") return "\x1b";
  if (event.key === "ArrowUp") return "\x1b[A";
  if (event.key === "ArrowDown") return "\x1b[B";
  if (event.key === "ArrowRight") return "\x1b[C";
  if (event.key === "ArrowLeft") return "\x1b[D";
  if (event.key === "Home") return "\x1b[H";
  if (event.key === "End") return "\x1b[F";
  if (event.key.length === 1 && !event.metaKey) return event.key;
  return null;
}

export function InspectorTerminal({ taskId, cwd }: Props) {
  const session = useAgentStore((state) => (taskId ? state.termByTask[taskId] : undefined));
  const clearTerm = useAgentStore((state) => state.clearTerm);
  const [pinned, setPinned] = useState(true);
  const [error, setError] = useState("");
  const scrollerRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const text = session?.text ?? "";
  const connected = Boolean(session?.connected);

  useEffect(() => {
    if (!taskId) return;
    setError("");
    let cancelled = false;
    const start = async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        try {
          await socketClient.send("term.start", { cols: 100, rows: 30 }, taskId);
          return;
        } catch (cause) {
          lastError = cause;
          await new Promise((resolve) => window.setTimeout(resolve, 250));
        }
      }
      if (!cancelled) setError(lastError instanceof Error ? lastError.message : "终端启动失败。");
    };
    void start();
    inputRef.current?.focus();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [text, pinned]);

  useEffect(() => {
    if (!taskId || !scrollerRef.current) return;
    const element = scrollerRef.current;
    const resize = () => {
      const cols = Math.max(20, Math.min(500, Math.floor(element.clientWidth / 7.2)));
      const rows = Math.max(10, Math.min(200, Math.floor(element.clientHeight / 20)));
      void socketClient.send("term.resize", { cols, rows }, taskId).catch(() => undefined);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [taskId]);

  function sendKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (!taskId) return;
    const data = keyToInput(event);
    if (!data) return;
    event.preventDefault();
    void socketClient.send("term.input", { data }, taskId).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "输入发送失败。");
    });
  }

  function interrupt(): void {
    if (!taskId) return;
    void socketClient.send("term.interrupt", {}, taskId);
    inputRef.current?.focus();
  }

  if (!taskId) return <p className="p-3 text-sm text-mute">打开一个对话后再用终端。</p>;

  return (
    <div className="term-shell flex h-full min-h-0 flex-col">
      <div className="term-head h-8">
        <span aria-hidden="true" className={`term-status ${connected ? "term-status-running" : ""}`} />
        <span className="term-path truncate" title={cwd ?? undefined}>{cwd || "工作文件夹"}</span>
        <span className="ml-auto text-[10px] text-mute">{session?.shell ? session.shell.split("/").pop() : "zsh"}</span>
        <button type="button" className="term-head-btn pressable" onClick={interrupt} disabled={!connected} aria-label="中断当前命令" title="发送 Ctrl-C">
          <Square size={11} />
        </button>
        <button type="button" className="term-head-btn pressable" onClick={() => clearTerm(taskId)} aria-label="清空终端">
          <Trash2 size={11} />清空
        </button>
      </div>
      {error ? <p className="term-error border-b border-white/10 px-3 py-1.5 text-[12px]">{error}</p> : null}
      <pre ref={scrollerRef} className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all px-3.5 py-2.5 font-mono text-[12px] leading-5" onScroll={(event) => setPinned(isNearBottom(event.currentTarget))} onClick={() => inputRef.current?.focus()}>
        {text || <span className="term-hint">正在启动 zsh… 点击这里开始输入，支持 vim、上下方向键和 Ctrl-C。</span>}
      </pre>
      <div className="term-input-line">
        <span className="term-prompt" aria-hidden="true">›</span>
        <input ref={inputRef} className="term-input" aria-label="内嵌 zsh 输入" placeholder={connected ? "输入命令" : "终端连接中…"} disabled={!connected} readOnly value="" onKeyDown={sendKey} onPaste={(event) => {
          if (!taskId) return;
          event.preventDefault();
          void socketClient.send("term.input", { data: event.clipboardData.getData("text") }, taskId);
        }} />
      </div>
    </div>
  );
}
