import { useEffect, useState } from "react";
import type { SessionStats } from "@mypi/protocol";
import { Gauge, X } from "lucide-react";

type Props = {
  stats: SessionStats | null;
  onCompact?: () => void;
  compact?: boolean;
};

function compactNumber(value: number | null | undefined): string {
  if (value == null) return "Unknown";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function ContextMeter({ stats, onCompact, compact }: Props) {
  const [open, setOpen] = useState(false);
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
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Gauge size={14} />
        <span>{compact ? (percent == null ? "--" : `${Math.round(percent)}%`) : `Context ${percent == null ? "--" : `${Math.round(percent)}%`}`}</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Context usage"
          className="absolute right-0 top-12 z-40 w-[min(340px,calc(100vw-24px))] rounded-lg border border-line bg-sidebar p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Context usage</p>
              <p className="mt-1 font-mono text-[11px] text-mute tabular">
                {compactNumber(usage?.tokens)} / {compactNumber(usage?.contextWindow)} tokens
              </p>
            </div>
            <button
              type="button"
              className="pressable flex h-10 w-10 items-center justify-center rounded-md text-mute"
              aria-label="Close context usage"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-canvas">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${percent != null && percent >= 85 ? "bg-danger" : percent != null && percent >= 70 ? "bg-warn" : "bg-accent"}`}
              style={{ width: `${percent ?? 0}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-[11px] tabular">
            <div className="rounded-md bg-elevated p-3">
              <dt className="text-mute">Messages</dt>
              <dd className="mt-1 text-ink">{stats?.totalMessages ?? "Unknown"}</dd>
            </div>
            <div className="rounded-md bg-elevated p-3">
              <dt className="text-mute">Tool calls</dt>
              <dd className="mt-1 text-ink">{stats?.toolCalls ?? "Unknown"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-mute">
            Pi reports total context usage. Per-source token categories are not available yet.
          </p>
          {onCompact ? (
            <button
              type="button"
              className="pressable mt-4 h-10 w-full rounded-md bg-accent px-3 text-sm font-medium text-canvas"
              onClick={() => {
                onCompact();
                setOpen(false);
              }}
            >
              Compact context now
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
