import { describe, expect, it } from "vitest";
import { buildPiRpcArgs } from "../../apps/server/src/pi/rpc-args.ts";

describe("buildPiRpcArgs", () => {
  it("loads user extensions and still injects the approval gate", () => {
    const args = buildPiRpcArgs({
      approvalExtensionPath: "/tmp/approval.ts",
      trustProject: false,
      sessionDir: "/tmp/sessions",
    });
    expect(args).toEqual([
      "--mode",
      "rpc",
      "--extension",
      "/tmp/approval.ts",
      "--no-approve",
      "--session-dir",
      "/tmp/sessions",
    ]);
    expect(args).not.toContain("--no-extensions");
  });

  it("passes --approve and --session when the project is trusted", () => {
    const args = buildPiRpcArgs({
      approvalExtensionPath: "/tmp/approval.ts",
      trustProject: true,
      sessionPath: "/tmp/session.jsonl",
      sessionDir: "/tmp/sessions",
    });
    expect(args).toContain("--approve");
    expect(args).not.toContain("--no-approve");
    expect(args).toContain("--session");
    expect(args).toContain("/tmp/session.jsonl");
  });
});
