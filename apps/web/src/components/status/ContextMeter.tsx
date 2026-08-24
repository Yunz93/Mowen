import { useEffect, useState } from "react";
import type { RuntimeState, SessionStats } from "@mowen/protocol";
import { Gauge, X } from "lucide-react";

type Props = {
  stats: SessionStats | null;
  runtime?: RuntimeState | null;
  onCompact?: (customInstructions?: string) => void;
  onRuntimeSet?: (payload: { autoCompaction?: boolean; autoRetry?: boolean }) => void;
  compact?: boolean;
};

function compactNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function ContextMeter({ stats, runtime, onCompact, onRuntimeSet, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const usage = stats?.contextUsage;
  const percent = usage?.percent == null ? null : Math.max(0, Math.min(100, usage.percent));
  const tone = percent == null ? "text-mute" : percent >= 85 ? "text-danger" : percent >= 70 ? "text-warn" : "text-accent";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        className={`pressable flex h-10 items-center gap-2 rounded-md bg-elevated px-3 font-mono text-[11px] tabular ${tone}`}
        aria-label="上下文用量"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Gauge size={14} />
        <span>{compact ? (percent == null ? "--" : `${Math.round(percent)}%`) : `上下文 ${percent == null ? "--" : `${Math.round(percent)}%`}`}</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="上下文用量"
          className="dialog-panel absolute right-0 top-12 z-40 w-[min(340px,calc(100vw-24px))] max-w-none"
        >
          <div className="dialog-head">
            <div className="dialog-head-text">
              <p className="dialog-title">上下文用量</p>
              <p className="mt-1 font-mono text-[11px] text-mute tabular">
                {compactNumber(usage?.tokens)} / {compactNumber(usage?.contextWindow)} tokens
              </p>
            </div>
            <button
              type="button"
              className="pressable icon-btn -mr-1 -mt-1"
              aria-label="关闭"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="dialog-body">
            <div className="h-2 overflow-hidden rounded-full bg-canvas">
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${percent != null && percent >= 85 ? "bg-danger" : percent != null && percent >= 70 ? "bg-warn" : "bg-accent"}`}
                style={{ width: `${percent ?? 0}%` }}
              />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-[11px] tabular">
              <div className="rounded-md bg-canvas p-3">
                <dt className="text-mute">消息</dt>
                <dd className="mt-1 text-ink">{stats?.totalMessages ?? "—"}</dd>
              </div>
              <div className="rounded-md bg-canvas p-3">
                <dt className="text-mute">工具调用</dt>
                <dd className="mt-1 text-ink">{stats?.toolCalls ?? "—"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-mute">
              这里是当前对话占用的上下文。快满时可以压缩，把旧内容收成摘要。
            </p>
            {onRuntimeSet ? (
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={runtime?.autoCompaction !== false}
                    onChange={(event) => onRuntimeSet({ autoCompaction: event.target.checked })}
                  />
                  接近上限时自动压缩
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={runtime?.autoRetry !== false}
                    onChange={(event) => onRuntimeSet({ autoRetry: event.target.checked })}
                  />
                  出错时自动重试
                </label>
              </div>
            ) : null}
            {onCompact ? (
              <label className="mt-3 block text-sm text-mute" htmlFor="compact-instructions">
                压缩时额外交代
                <textarea
                  id="compact-instructions"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  className="field mt-1 min-h-16 w-full text-sm text-ink"
                  placeholder="可选，例如：保留这次改文件的结论"
                />
              </label>
            ) : null}
          </div>
          {onCompact ? (
            <div className="dialog-actions">
              <button
                type="button"
                className="pressable btn btn-primary btn-block"
                onClick={() => {
                  onCompact(instructions.trim() || undefined);
                  setInstructions("");
                  setOpen(false);
                }}
              >
                压缩上下文
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
