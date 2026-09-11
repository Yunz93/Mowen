import { describe, expect, it } from "vitest";
import {
  createModelChangeNotice,
  encodeModelChangeText,
  formatModelChangeText,
  mergeModelChangeNotices,
  modelDisplayName,
  parseModelChangeText,
  resolveModelLabel,
} from "../../apps/server/src/tasks/model-change.ts";

const models = [
  { provider: "openai", id: "gpt-5.4", name: "GPT-5.4" },
  { provider: "openai", id: "gpt-5.6-sol", name: "GPT-5.6 Sol" },
];

describe("model change copy", () => {
  it("prefers the display name and formats the switch sentence", () => {
    expect(modelDisplayName({ id: "gpt-5.4", name: "GPT-5.4" })).toBe("GPT-5.4");
    expect(modelDisplayName({ id: "raw-id" })).toBe("raw-id");
    expect(resolveModelLabel("openai/gpt-5.6-sol", models)).toBe("GPT-5.6 Sol");
    expect(formatModelChangeText("GPT-5.4", "GPT-5.6 Sol")).toBe("模型已从 GPT-5.4 更改为 GPT-5.6 Sol。");
    expect(formatModelChangeText("", "GPT-5.6 Sol")).toBe("模型已切换为 GPT-5.6 Sol。");
    expect(formatModelChangeText("GPT-5.4", "GPT-5.4")).toBe("");
    expect(createModelChangeNotice("a->b", "GPT-5.4", "GPT-5.4")).toBeNull();
  });

  it("encodes tree text and inserts banners after the preceding chat messages", () => {
    expect(parseModelChangeText(encodeModelChangeText("openai/gpt-5.4", "openai/gpt-5.6-sol"))).toEqual({
      from: "openai/gpt-5.4",
      to: "openai/gpt-5.6-sol",
    });
    const merged = mergeModelChangeNotices(
      [
        { id: "u1", role: "user", text: "hi", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "a1", role: "assistant", text: "hello", createdAt: "2026-01-01T00:00:01.000Z" },
      ],
      [
        { id: "u1", parentId: null, role: "user", text: "hi" },
        { id: "a1", parentId: "u1", role: "assistant", text: "hello" },
        { id: "m1", parentId: "a1", role: "model_change", text: "openai/gpt-5.4 -> openai/gpt-5.6-sol" },
      ],
      models,
    );
    expect(merged.map((item) => item.role)).toEqual(["user", "assistant", "system"]);
    expect(merged[2]?.text).toBe("模型已从 GPT-5.4 更改为 GPT-5.6 Sol。");
    expect(merged[2]?.id.startsWith("model-change:")).toBe(true);
  });
});
