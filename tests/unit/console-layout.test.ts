import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { escapeHtml, shouldOpenMarkdownLink, stabilizeMarkdown } from "../../apps/web/src/lib/assistant-markdown.ts";
import { isNearBottom } from "../../apps/web/src/lib/stick-to-bottom.ts";

describe("assistant markdown helpers", () => {
  it("closes an unclosed fence so incomplete streaming markdown does not swallow the page", () => {
    expect(stabilizeMarkdown("hi\n```ts\nconst x = 1")).toBe("hi\n```ts\nconst x = 1\n```");
    expect(stabilizeMarkdown("hi\n```ts\nconst x = 1\n```")).toBe("hi\n```ts\nconst x = 1\n```");
  });

  it("only opens real external http(s) links", () => {
    expect(shouldOpenMarkdownLink("https://github.com/Yunz93/Mowen")).toBe(true);
    expect(shouldOpenMarkdownLink("http://example.com/docs")).toBe(true);
    expect(shouldOpenMarkdownLink("/settings")).toBe(false);
    expect(shouldOpenMarkdownLink("")).toBe(false);
    expect(shouldOpenMarkdownLink("javascript:alert(1)")).toBe(false);
    expect(shouldOpenMarkdownLink("http://127.0.0.1:5173/")).toBe(false);
    expect(shouldOpenMarkdownLink("http://localhost:4310/")).toBe(false);
  });

  it("escapes HTML when highlight falls back", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("stick to bottom", () => {
  it("treats a small remaining gap as pinned", () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 920, clientHeight: 80 })).toBe(true);
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 0, clientHeight: 80 })).toBe(false);
  });
});

describe("conversation bubbles", () => {
  it("lets user bubbles shrink instead of stretching into each other", () => {
    const src = readFileSync(path.resolve("apps/web/src/components/timeline/ConversationTimeline.tsx"), "utf8");
    expect(src).toMatch(/flex-col gap-6/);
    expect(src).toMatch(/w-fit max-w-\[78%\] shrink-0[\s\S]*self-end/);
  });
});
