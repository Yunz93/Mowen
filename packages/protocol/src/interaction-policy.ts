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
  {
    value: "auto",
    label: "自动审核",
    description: "自动放行普通操作，高危命令（sudo、rm -rf、格式化、强制推送等）仍需确认",
  },
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

// 高危命令：命中任意一条就视为需要人工确认。
// 匹配的是常见危险操作（提权、递归删除、磁盘写入、远程脚本执行、
// 强制推送、批量销毁等）；普通命令（测试、构建、git add/commit 等）不受影响。
const HIGH_RISK_PATTERNS: RegExp[] = [
  /\bsudo\b/, // 提权
  /\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*[rf][a-zA-Z]*/, // rm -rf 递归强制删除
  /\b(dd|mkfs\.\w+|fdisk|parted|gdisk)\b/, // 磁盘/分区操作
  /\b(curl|wget)\b[^|;]*\|\s*(sudo\s+)?(ba)?sh\b/, // curl|sh 远程脚本
  /\b(ba)?sh\s+-c\b/, // 任意命令注入
  /\bchmod\s+-[a-zA-Z]*R[a-zA-Z]*\b/, // 递归改权限
  /\bchown\s+-[a-zA-Z]*R[a-zA-Z]*\b/, // 递归改属主
  /\bgit\s+push\b[^|;&]*\s+(?:-f|--force)\b/, // 强制推送
  /\bgit\s+reset\s+--hard\b/, // 丢弃提交历史
  /\bgit\s+clean\s+-[a-zA-Z]*[fdx][a-zA-Z]*/, // 删除未跟踪文件
  /\b(kill|pkill)\s+-9\b|\bkillall\s+-9\b/, // 强杀进程
  /\b(useradd|userdel|usermod|passwd)\b/, // 账号管理
  /\b(shutdown|reboot|poweroff|halt)\b|\binit\s+[06]\b/, // 关机/重启
  /\b(pnpm|npm|yarn|bun|cargo)\s+publish\b|\bgem\s+push\b/, // 发布上线
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/, // fork bomb
];

export function isHighRiskCommand(command: string): boolean {
  return HIGH_RISK_PATTERNS.some((pattern) => pattern.test(command));
}

export function approvalDecision(
  policy: ApprovalPolicy,
  approval: ApprovalRequest,
): boolean | null {
  if (policy === "read_only") return false;
  if (policy === "workspace" && (approval.toolName === "edit" || approval.toolName === "write")) {
    return true;
  }
  if (policy === "auto") {
    if (approval.toolName === "bash") {
      const command = approval.rawCommand ?? approval.target ?? "";
      return isHighRiskCommand(command) ? null : true;
    }
    // edit/write 已在 Pi 扩展里做过路径与受保护文件校验，其余工具只读或无害。
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
