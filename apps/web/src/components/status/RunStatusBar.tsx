import type { RuntimeState, TaskStatus, ToolExecution } from "@mowen/protocol";
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, ShieldAlert } from "lucide-react";

type Props = {
  status: TaskStatus;
  tools: ToolExecution[];
  hasChanges: boolean;
  runtime?: RuntimeState | null;
};

function stage(status: TaskStatus, tools: ToolExecution[], hasChanges: boolean, runtime?: RuntimeState | null) {
  const current = [...tools].reverse().find((tool) => tool.status === "running" || tool.status === "waiting_approval");
  if (runtime?.compacting) {
    return { label: "正在压缩上下文", detail: runtime.compactionReason ?? "把旧内容收成摘要", icon: LoaderCircle };
  }
  if (runtime?.retrying) {
    const attempt = runtime.retryAttempt != null ? `第 ${runtime.retryAttempt} 次` : "自动重试";
    return { label: "正在重试", detail: runtime.retryError ?? attempt, icon: LoaderCircle };
  }
  if ((runtime?.steering.length ?? 0) > 0) {
    return { label: "已排队补充", detail: runtime?.steering[0] ?? "下一条会马上送出", icon: Clock3 };
  }
  if ((runtime?.followUp.length ?? 0) > 0) {
    return { label: "下一条已排队", detail: runtime?.followUp[0] ?? "回复结束后发送", icon: Clock3 };
  }
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

export function RunStatusBar({ status, tools, hasChanges, runtime }: Props) {
  const current = stage(status, tools, hasChanges, runtime);
  if (!current) return null;
  const Icon = current.icon;
  const active =
    status === "running" ||
    status === "booting" ||
    status === "aborting" ||
    Boolean(runtime?.compacting || runtime?.retrying);

  return (
    <div className="flex min-h-8 items-center gap-2.5 border-b border-line bg-surface px-4 py-1.5 text-[12px]">
      <Icon size={14} className={active ? "animate-spin text-accent motion-reduce:animate-none" : status === "waiting_approval" ? "text-warn" : "text-mute"} />
      <span className="font-medium text-ink">{current.label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-mute">{current.detail}</span>
      <span className="font-mono text-[11px] text-mute tabular">{tools.length} 个操作</span>
    </div>
  );
}
