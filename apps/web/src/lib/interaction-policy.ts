import type { ApprovalRequest } from "@mowen/protocol";

export type InteractionMode = "ask" | "plan" | "agent" | "review";
export type ApprovalPolicy = "ask" | "workspace" | "read_only";

export const interactionModes: Array<{
  value: InteractionMode;
  label: string;
  description: string;
}> = [
  { value: "ask", label: "Ask", description: "Explore and explain without mutations" },
  { value: "plan", label: "Plan", description: "Build an implementation plan without mutations" },
  { value: "agent", label: "Agent", description: "Work through the task with the selected approval policy" },
  { value: "review", label: "Review", description: "Inspect the current state without mutations" },
];

export const approvalPolicies: Array<{
  value: ApprovalPolicy;
  label: string;
  description: string;
}> = [
  { value: "ask", label: "Ask every time", description: "Review every write and command" },
  { value: "workspace", label: "Workspace edits", description: "Auto-allow validated file edits, ask for Bash" },
  { value: "read_only", label: "Read only", description: "Automatically deny all mutations" },
];

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

export function loadTaskPreferences(): Record<
  string,
  { mode: InteractionMode; approvalPolicy: ApprovalPolicy }
> {
  try {
    const parsed = JSON.parse(localStorage.getItem("mypi.taskPreferences") ?? "{}") as Record<
      string,
      { mode?: string; approvalPolicy?: string }
    >;
    return Object.fromEntries(
      Object.entries(parsed).map(([taskId, value]) => [
        taskId,
        {
          mode: interactionModes.some((item) => item.value === value.mode)
            ? (value.mode as InteractionMode)
            : "agent",
          approvalPolicy: approvalPolicies.some((item) => item.value === value.approvalPolicy)
            ? (value.approvalPolicy as ApprovalPolicy)
            : "ask",
        },
      ]),
    );
  } catch {
    return {};
  }
}

export function saveTaskPreferences(
  preferences: Record<string, { mode: InteractionMode; approvalPolicy: ApprovalPolicy }>,
) {
  try {
    localStorage.setItem("mypi.taskPreferences", JSON.stringify(preferences));
  } catch {
    // Preferences remain active for this session when storage is unavailable.
  }
}
