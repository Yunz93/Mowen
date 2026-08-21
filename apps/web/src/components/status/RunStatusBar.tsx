import type { TaskStatus, ToolExecution } from "@ohmypi/protocol";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, ShieldAlert } from "lucide-react";

type Props = {
  status: TaskStatus;
  tools: ToolExecution[];
  hasChanges: boolean;
};

function stage(status: TaskStatus, tools: ToolExecution[], hasChanges: boolean) {
  const current = [...tools].reverse().find((tool) => tool.status === "running" || tool.status === "waiting_approval");
  if (status === "waiting_approval") return { label: "Approval needed", detail: current?.toolName ?? "Review the pending action", icon: ShieldAlert };
  if (status === "queued") return { label: "Queued", detail: "Waiting for an available Pi slot", icon: Clock3 };
  if (status === "booting") return { label: "Preparing", detail: "Starting the Pi runtime", icon: LoaderCircle };
  if (status === "aborting") return { label: "Stopping", detail: "Waiting for the current process to exit", icon: LoaderCircle };
  if (status === "error") return { label: "Needs attention", detail: "The run stopped before completion", icon: AlertTriangle };
  if (status === "running") {
    const toolName = current?.toolName ?? "agent";
    const normalized = `${toolName} ${current?.target ?? ""}`.toLowerCase();
    const label = /test|check|lint|build/.test(normalized) ? "Verifying" : /write|edit/.test(normalized) ? "Editing" : "Working";
    return { label, detail: current?.target || toolName, icon: LoaderCircle };
  }
  if (hasChanges) return { label: "Review changes", detail: "The latest run changed project files", icon: CheckCircle2 };
  return null;
}

export function RunStatusBar({ status, tools, hasChanges }: Props) {
  const current = stage(status, tools, hasChanges);
  if (!current) return null;
  const Icon = current.icon;
  const active = status === "running" || status === "booting" || status === "aborting";

  return (
    <div className="flex min-h-10 items-center gap-3 border-b border-line bg-elevated px-4 py-2 text-xs">
      <Icon size={14} className={active ? "animate-spin text-accent motion-reduce:animate-none" : status === "waiting_approval" ? "text-warn" : "text-mute"} />
      <span className="font-medium text-ink">{current.label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-mute">{current.detail}</span>
      <span className="font-mono text-[11px] text-mute tabular">{tools.length} tools</span>
    </div>
  );
}
