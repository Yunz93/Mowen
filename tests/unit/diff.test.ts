import { describe, expect, it } from "vitest";
import { diffFromApproval, unifiedDiff } from "../../packages/protocol/src/diff.ts";

describe("unifiedDiff", () => {
  it("marks added and removed lines", () => {
    const lines = unifiedDiff("alpha\nbeta", "alpha\ngamma");
    expect(lines).toEqual([
      { type: "equal", text: "alpha" },
      { type: "remove", text: "beta" },
      { type: "add", text: "gamma" },
    ]);
  });

  it("builds a write preview from content only", () => {
    const lines = diffFromApproval({ content: "hello" });
    expect(lines?.some((line) => line.type === "add" && line.text === "hello")).toBe(true);
  });
});
