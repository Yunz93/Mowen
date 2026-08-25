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

const FILE_TOOLS = new Set(["write", "edit", "read"]);
const UNDO_TOOLS = new Set(["write", "edit"]);

type Props = {
  tool: ToolExecution;
  onOpen?: (path: string) => void;
  onUndo?: (path: string) => void;
};

export function ToolExecutionRow({ tool, onOpen, onUndo }: Props) {
  const [open, setOpen] = useState(Boolean(tool.isError) || tool.status === "failed");
  const Icon = ICONS[tool.status];
  const duration =
    typeof tool.durationMs === "number" ? `${Math.max(1, Math.round(tool.durationMs / 100) / 10)}s` : "";
  const label =
    tool.status === "running" || tool.status === "pending"
      ? `正在${toolNameLabel(tool.toolName)}`
      : toolNameLabel(tool.toolName);
  const target = tool.target?.trim() ?? "";
  const canOpen = Boolean(onOpen && target && FILE_TOOLS.has(tool.toolName));
  const canUndo = Boolean(onUndo && target && UNDO_TOOLS.has(tool.toolName) && tool.status === "succeeded");

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
        <span className="min-w-0 flex-1 truncate text-xs text-mute">{target}</span>
        <span className="text-[11px] text-mute">{toolStatusLabel(tool.status)}</span>
        {duration ? <span className="text-[11px] text-mute">{duration}</span> : null}
        <ChevronRight size={14} className={`text-mute transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {canOpen || canUndo ? (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-1.5">
          {canOpen ? (
            <button
              type="button"
              className="pressable h-7 rounded-md px-2 text-[12px] text-accent"
              onClick={(event) => {
                event.stopPropagation();
                onOpen?.(target);
              }}
            >
              打开
            </button>
          ) : null}
          {canUndo ? (
            <button
              type="button"
              className="pressable h-7 rounded-md px-2 text-[12px] text-ink"
              onClick={(event) => {
                event.stopPropagation();
                onUndo?.(target);
              }}
            >
              撤回这次
            </button>
          ) : null}
        </div>
      ) : null}
      {open && tool.resultText ? (
        <pre className="max-h-64 overflow-auto border-t border-line bg-canvas px-3 py-2 font-mono text-xs leading-5 text-mute fade-in">
          {tool.resultText}
        </pre>
      ) : null}
    </div>
  );
}
