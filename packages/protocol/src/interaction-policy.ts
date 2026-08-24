import type { ApprovalPolicy, ApprovalRequest, InteractionMode } from "./task-schema.js";

export const interactionModes: Array<{
  value: InteractionMode;
  label: string;
  description: string;
}> = [
  { value: "ask", label: "问答", description: "只解释和查找，不改文件、不跑会改动系统的命令" },
  { value: "plan", label: "规划", description: "只出实施计划，不改文件" },
  { value: "agent", label: "代理", description: "按审批策略动手改代码、跑命令" },
  { value: "review", label: "审阅", description: "只检查当前状态，不改文件" },
];

export const approvalPolicies: Array<{
  value: ApprovalPolicy;
  label: string;
  description: string;
}> = [
  { value: "ask", label: "每次确认", description: "改文件和跑命令都先问你" },
  { value: "workspace", label: "自动改文件", description: "工作区内改文件自动允许，命令仍要确认" },
  { value: "read_only", label: "只读", description: "拒绝所有改动" },
];

export const MODE_PREFIX: Record<Exclude<InteractionMode, "agent">, string> = {
  ask: "【问答模式】只解释和查找，不要修改文件，不要运行会改动系统的命令。\n\n",
  plan: "【规划模式】只输出可执行的实施计划，不要修改文件，不要运行会改动系统的命令。\n\n",
  review: "【审阅模式】只检查当前代码和状态，不要修改文件，不要运行会改动系统的命令。\n\n",
};

export function effectiveApprovalPolicy(
  mode: InteractionMode,
  policy: ApprovalPolicy,
): ApprovalPolicy {
  return mode === "agent" ? policy : "read_only";
}

export function approvalDecision(
  policy: ApprovalPolicy,
  approval: ApprovalRequest,
): boolean | null {
  if (policy === "read_only") return false;
  if (policy === "workspace" && (approval.toolName === "edit" || approval.toolName === "write")) {
    return true;
  }
  return null;
}

export function applyModePrefix(mode: InteractionMode, message: string): string {
  if (mode === "agent") return message;
  const prefix = MODE_PREFIX[mode];
  if (message.startsWith(prefix)) return message;
  return `${prefix}${message}`;
}

export function stripModePrefix(message: string): string {
  for (const prefix of Object.values(MODE_PREFIX)) {
    if (message.startsWith(prefix)) return message.slice(prefix.length);
  }
  return message;
}

export function rememberKey(cwd: string, toolName: string, target: string): string {
  return `${cwd}\0${toolName}\0${target}`;
}
