import { isHighRiskCommand, type ApprovalRequest } from "@mowen/protocol";

export type ApprovalRiskLevel = "low" | "medium" | "high";

const DANGER_FRAGMENTS = [
  /sudo\b/gi,
  /rm\s+-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*/gi,
  /curl[^\n|;]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/gi,
  /wget[^\n|;]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/gi,
  /(?:^|[;&|]\s*)>\s*\/|>>\s*\//g,
  /git\s+push\b[^|;]*\s+(?:-f|--force)\b/gi,
];

export function approvalRiskLevel(approval: Pick<ApprovalRequest, "toolName" | "rawCommand" | "target">): ApprovalRiskLevel {
  if (approval.toolName === "bash") {
    const command = approval.rawCommand ?? approval.target ?? "";
    return isHighRiskCommand(command) ? "high" : "medium";
  }
  if (approval.toolName === "write" || approval.toolName === "edit") return "medium";
  return "low";
}

export function approvalRiskLabel(level: ApprovalRiskLevel): string {
  if (level === "high") return "高风险";
  if (level === "medium") return "需确认";
  return "低风险";
}

export function splitDangerousCommand(command: string): Array<{ text: string; danger: boolean }> {
  if (!command) return [];
  const marks: Array<{ start: number; end: number }> = [];
  for (const pattern of DANGER_FRAGMENTS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(command))) {
      marks.push({ start: match.index, end: match.index + match[0].length });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  marks.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const mark of marks) {
    const last = merged[merged.length - 1];
    if (last && mark.start <= last.end) last.end = Math.max(last.end, mark.end);
    else merged.push({ ...mark });
  }
  const parts: Array<{ text: string; danger: boolean }> = [];
  let cursor = 0;
  for (const mark of merged) {
    if (mark.start > cursor) parts.push({ text: command.slice(cursor, mark.start), danger: false });
    parts.push({ text: command.slice(mark.start, mark.end), danger: true });
    cursor = mark.end;
  }
  if (cursor < command.length) parts.push({ text: command.slice(cursor), danger: false });
  return parts;
}
