import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ToolExecution } from "@mypi/protocol";
import { Ban, Check, CircleAlert, LoaderCircle, Shield } from "lucide-react";

const ICONS = {
  pending: LoaderCircle,
  waiting_approval: Shield,
  running: LoaderCircle,
  succeeded: Check,
  failed: CircleAlert,
  blocked: Ban,
  aborted: Ban,
} as const;

type Props = {
  tool: ToolExecution;
};

export function ToolExecutionRow({ tool }: Props) {
  const [open, setOpen] = useState(Boolean(tool.isError) || tool.status === "failed");
  const Icon = ICONS[tool.status];
  const duration =
    typeof tool.durationMs === "number" ? `${Math.max(1, Math.round(tool.durationMs / 100) / 10)}s` : "—";

  return (
    <div className="border-y border-line/80 bg-canvas/40">
      <button
        type="button"
        className="pressable flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Icon
          size={14}
          className={
            tool.status === "running" || tool.status === "pending" ? "text-accent" : "text-mute"
          }
        />
        <span className="font-mono text-xs text-accent">{tool.toolName}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-mute">{tool.target ?? ""}</span>
        <span className="font-mono text-[11px] text-mute tabular">{tool.status.replaceAll("_", " ")}</span>
        <span className="font-mono text-[11px] text-mute tabular">{duration}</span>
        <ChevronRight size={14} className={`text-mute transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && tool.resultText ? (
        <pre className="max-h-64 overflow-auto border-t border-line bg-canvas px-3 py-2 font-mono text-xs leading-5 text-mute fade-in">
          {tool.resultText}
        </pre>
      ) : null}
    </div>
  );
}
