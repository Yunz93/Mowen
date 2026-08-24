import { describe, expect, it } from "vitest";
import { branchRoleLabel, isVisibleBranchNode, visibleBranchNodes } from "../../apps/web/src/copy.ts";

describe("branch tree presentation", () => {
  it("uses short Chinese labels instead of raw Pi role names", () => {
    expect(branchRoleLabel("user")).toBe("你");
    expect(branchRoleLabel("assistant")).toBe("AI");
    expect(branchRoleLabel("toolResult")).toBe("工具");
    expect(branchRoleLabel("model_change")).toBe("模型");
    expect(branchRoleLabel("thinking_level")).toBe("思考");
    expect(branchRoleLabel("compaction")).toBe("压缩");
    expect(branchRoleLabel("unknown_role")).toBe("其他");
  });

  it("hides model/thinking noise and empty assistant rows", () => {
    expect(isVisibleBranchNode({ role: "user", text: "" })).toBe(true);
    expect(isVisibleBranchNode({ role: "assistant", text: "收到" })).toBe(true);
    expect(isVisibleBranchNode({ role: "assistant", text: "" })).toBe(false);
    expect(isVisibleBranchNode({ role: "toolResult", text: "Operation aborted" })).toBe(true);
    expect(isVisibleBranchNode({ role: "toolResult", text: "  " })).toBe(false);
    expect(isVisibleBranchNode({ role: "model_change", text: "" })).toBe(false);
    expect(isVisibleBranchNode({ role: "thinking_level", text: "high" })).toBe(false);
  });

  it("keeps forkable user turns and promotes 当前 when the leaf is hidden", () => {
    const nodes = visibleBranchNodes([
      { id: "u1", role: "user", text: "测试", leaf: false },
      { id: "m1", role: "model_change", text: "", leaf: false },
      { id: "a1", role: "assistant", text: "", leaf: false },
      { id: "t1", role: "toolResult", text: "On branch main", leaf: false },
      { id: "a2", role: "assistant", text: "", leaf: true },
    ]);
    expect(nodes.map((node) => node.id)).toEqual(["u1", "t1"]);
    expect(nodes[1]?.leaf).toBe(true);
  });
});
