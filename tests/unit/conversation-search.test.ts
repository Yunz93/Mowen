import { describe, expect, it } from "vitest";
import { MODE_PREFIX } from "../../packages/protocol/src/index.ts";
import {
  conversationMessageDomId,
  matchConversationMessages,
  searchableText,
  stepSearchIndex,
} from "../../apps/web/src/lib/conversation-search.ts";

describe("conversation search", () => {
  it("strips mode prefix from user messages", () => {
    expect(
      searchableText({
        role: "user",
        text: `${MODE_PREFIX.ask}look at the plan`,
      }),
    ).toBe("look at the plan");
    expect(matchConversationMessages(
      [
        { id: "u1", role: "user", text: `${MODE_PREFIX.ask}look at the plan` },
        { id: "a1", role: "assistant", text: "Here is the plan." },
      ],
      "问答模式",
    )).toEqual([]);
    expect(matchConversationMessages(
      [
        { id: "u1", role: "user", text: `${MODE_PREFIX.ask}look at the plan` },
        { id: "a1", role: "assistant", text: "Here is the plan." },
      ],
      "PLAN",
    )).toEqual(["u1", "a1"]);
  });

  it("ignores empty queries, tool results, and is case-insensitive", () => {
    const messages = [
      { id: "u1", role: "user" as const, text: "Hello UniqueToken" },
      { id: "t1", role: "toolResult" as const, text: "UniqueToken in tool output" },
      { id: "a1", role: "assistant" as const, text: "echo uniquetoken" },
    ];
    expect(matchConversationMessages(messages, "   ")).toEqual([]);
    expect(matchConversationMessages(messages, "uniquetoken")).toEqual(["u1", "a1"]);
  });

  it("wraps prev/next indexes", () => {
    expect(stepSearchIndex(0, 3, -1)).toBe(2);
    expect(stepSearchIndex(2, 3, 1)).toBe(0);
    expect(stepSearchIndex(0, 0, 1)).toBe(0);
    expect(conversationMessageDomId("abc")).toBe("conversation-msg-abc");
  });
});
