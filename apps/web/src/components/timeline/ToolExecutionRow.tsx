import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ToolExecution } from "@mowen/protocol";
import { Ban, Check, CircleAlert, LoaderCircle, Shield } from "lucide-react";
import { toolNameLabel, toolStatusLabel } from "../../copy";

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
    typeof tool.durationMs === "number" ? `${Math.max(1, Math.round(tool.durationMs / 100) / 10)}s` : "";
  const label =
    tool.status === "running" || tool.status === "pending"
      ? `正在${toolNameLabel(tool.toolName)}`
      : toolNameLabel(tool.toolName);

  return (
    <div className="overflow-hidden rounded-[10px] bg-fill">
      <button
        type="button"
        className="pressable flex min-h-8 w-full items-center gap-2.5 px-3 py-1.5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Icon
          size={14}
          className={
            tool.status === "running" || tool.status === "pending" ? "text-accent" : "text-mute"
          }
        />
        <span className="text-xs text-ink">{label}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-mute">{tool.target ?? ""}</span>
        <span className="text-[11px] text-mute">{toolStatusLabel(tool.status)}</span>
        {duration ? <span className="text-[11px] text-mute">{duration}</span> : null}
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
