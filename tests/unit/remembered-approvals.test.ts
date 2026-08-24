import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RememberedApprovals } from "../../apps/server/src/tasks/remembered-approvals.ts";
import type { ApprovalRequest } from "@mowen/protocol";

function approval(target: string): ApprovalRequest {
  return {
    requestId: "r1",
    taskId: "t1",
    toolCallId: "c1",
    toolName: "write",
    cwd: "/tmp/project",
    target,
    risk: "write",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

describe("remembered approvals", () => {
  it("matches a previously allowed target", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mowen-remember-"));
    const store = new RememberedApprovals(dir);
    await store.load();
    const first = approval("src/app.ts");
    expect(store.match(first)).toBe(false);
    await store.remember(first);
    const again = new RememberedApprovals(dir);
    await again.load();
    expect(again.match(approval("src/app.ts"))).toBe(true);
    expect(again.match(approval("src/other.ts"))).toBe(false);
  });
});
