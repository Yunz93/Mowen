import { describe, expect, it } from "vitest";
import type { ApprovalRequest } from "@mypi/protocol";
import { approvalDecision, effectiveApprovalPolicy } from "../../apps/web/src/lib/interaction-policy";

const approval: ApprovalRequest = {
  requestId: "request-1",
  taskId: "task-1",
  toolCallId: "tool-1",
  toolName: "write",
  cwd: "/workspace",
  target: "src/app.ts",
  risk: "Writes a file",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe("interaction policy", () => {
  it("only auto-allows validated file mutation tool classes", () => {
    expect(approvalDecision("workspace", approval)).toBe(true);
    expect(approvalDecision("workspace", { ...approval, toolName: "bash", rawCommand: "npm test" })).toBeNull();
  });

  it("denies mutations in read-only modes", () => {
    expect(effectiveApprovalPolicy("ask", "workspace")).toBe("read_only");
    expect(effectiveApprovalPolicy("agent", "workspace")).toBe("workspace");
    expect(approvalDecision("read_only", approval)).toBe(false);
  });
});
