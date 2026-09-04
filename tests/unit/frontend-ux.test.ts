import { describe, expect, it } from "vitest";
import { approvalRiskLevel, splitDangerousCommand } from "../../apps/web/src/lib/approval-risk.ts";
import { clampInspectorWidth, INSPECTOR_WIDTH_MIN } from "../../apps/web/src/lib/ui-prefs.ts";
import { groupToolExecutions, toolGroupLabel } from "../../apps/web/src/lib/tool-groups.ts";
import { shortcutLabel } from "../../apps/web/src/lib/hotkeys.ts";
import { taskStatusTone, workViewTone } from "../../apps/web/src/lib/status-tone.ts";
import type { ToolExecution } from "@mowen/protocol";

function tool(name: string, id = name): ToolExecution {
  return {
    toolCallId: id,
    toolName: name,
    status: "succeeded",
    target: name,
  };
}

describe("tool grouping", () => {
  it("collapses consecutive read-only tools", () => {
    const grouped = groupToolExecutions([tool("read", "1"), tool("grep", "2"), tool("write", "3"), tool("ls", "4")]);
    expect(grouped).toHaveLength(3);
    expect(grouped[0]).toMatchObject({ kind: "group" });
    expect(grouped[1]).toMatchObject({ kind: "single" });
    expect(grouped[2]).toMatchObject({ kind: "single" });
    expect(toolGroupLabel([tool("read", "a"), tool("read", "b")])).toBe("读取了 2 个文件");
  });
});

describe("approval risk", () => {
  it("marks high-risk bash and highlights fragments", () => {
    expect(approvalRiskLevel({ toolName: "bash", rawCommand: "sudo rm -rf /tmp", target: "" })).toBe("high");
    expect(approvalRiskLevel({ toolName: "write", rawCommand: "", target: "a.ts" })).toBe("medium");
    const parts = splitDangerousCommand("echo hi && sudo rm -rf /tmp");
    expect(parts.some((part) => part.danger && part.text.includes("sudo"))).toBe(true);
  });
});

describe("ui prefs and tones", () => {
  it("clamps inspector width and maps status colors", () => {
    expect(clampInspectorWidth(120, 1200)).toBe(INSPECTOR_WIDTH_MIN);
    expect(clampInspectorWidth(900, 1000)).toBe(600);
    expect(taskStatusTone("running")).toBe("busy");
    expect(taskStatusTone("waiting_approval")).toBe("wait");
    expect(taskStatusTone("error")).toBe("danger");
    expect(workViewTone("completed")).toBe("ok");
  });

  it("formats shortcut labels", () => {
    expect(shortcutLabel("Mod+N")).toMatch(/N/);
  });
});
