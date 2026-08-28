import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { normalizeBrowserUrl } from "../../lib/browser-url";

export function InspectorBrowser() {
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0);
  const url = index >= 0 ? (history[index] ?? "") : "";
  const canBack = index > 0;
  const canForward = index >= 0 && index < history.length - 1;

  function navigate(raw: string): void {
    const next = normalizeBrowserUrl(raw);
    if (!next) return;
    const trimmed = history.slice(0, index + 1);
    setHistory([...trimmed, next]);
    setIndex(trimmed.length);
    setDraft(next);
    setReloadKey((value) => value + 1);
  }

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    navigate(draft);
  }

  function onDraftKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setDraft(url);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <form className="flex h-8 shrink-0 items-center gap-0.5 border-b border-line px-1.5" onSubmit={onSubmit}>
        <button
          type="button"
          className="pressable icon-btn"
          aria-label="后退"
          disabled={!canBack}
          onClick={() => {
            if (!canBack) return;
            const next = index - 1;
            setIndex(next);
            setDraft(history[next] ?? "");
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          className="pressable icon-btn"
          aria-label="前进"
          disabled={!canForward}
          onClick={() => {
            if (!canForward) return;
            const next = index + 1;
            setIndex(next);
            setDraft(history[next] ?? "");
          }}
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          className="pressable icon-btn"
          aria-label="刷新"
          disabled={!url}
          onClick={() => setReloadKey((value) => value + 1)}
        >
          <RotateCw size={13} />
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onDraftKey}
          aria-label="网址"
          placeholder="127.0.0.1:5173"
          className="field ml-0.5 h-6 min-h-6 min-w-0 flex-1 rounded-md px-2 font-mono text-[11px]"
        />
      </form>
      {url ? (
        <iframe
          key={`${url}:${reloadKey}`}
          title="浏览器预览"
          src={url}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin"
          className="min-h-0 flex-1 border-0 bg-surface"
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-start p-3">
          <p className="text-sm leading-6 text-mute">
            预览本地页面，例如 <span className="font-mono text-[12px] text-ink">127.0.0.1:5173</span>
            。很多网站禁止嵌入，打不开就换本机地址。
          </p>
        </div>
      )}
    </div>
  );
}
