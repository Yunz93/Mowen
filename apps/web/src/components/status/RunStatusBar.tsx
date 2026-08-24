import type { TaskStatus, ToolExecution } from "@mowen/protocol";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, ShieldAlert } from "lucide-react";

type Props = {
  status: TaskStatus;
  tools: ToolExecution[];
  hasChanges: boolean;
};

function stage(status: TaskStatus, tools: ToolExecution[], hasChanges: boolean) {
  const current = [...tools].reverse().find((tool) => tool.status === "running" || tool.status === "waiting_approval");
  if (status === "waiting_approval") return { label: "等待确认", detail: current?.toolName ?? "请查看这次操作", icon: ShieldAlert };
  if (status === "queued") return { label: "排队中", detail: "正在等待空闲的 AI 进程", icon: Clock3 };
  if (status === "booting") return { label: "正在启动", detail: "正在准备 AI 引擎", icon: LoaderCircle };
  if (status === "aborting") return { label: "正在停止", detail: "正在结束当前操作", icon: LoaderCircle };
  if (status === "error") return { label: "需要处理", detail: "这次运行没有完成", icon: AlertTriangle };
  if (status === "running") {
    const toolName = current?.toolName ?? "agent";
    const normalized = `${toolName} ${current?.target ?? ""}`.toLowerCase();
    const label = /test|check|lint|build/.test(normalized) ? "正在检查" : /write|edit/.test(normalized) ? "正在改文件" : "正在处理";
    return { label, detail: current?.target || toolName, icon: LoaderCircle };
  }
  if (hasChanges) return { label: "查看改动", detail: "这次对话改了项目里的文件", icon: CheckCircle2 };
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
      <span className="font-mono text-[11px] text-mute tabular">{tools.length} 个操作</span>
    </div>
  );
}
