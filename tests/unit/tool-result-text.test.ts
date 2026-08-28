import { describe, expect, it } from "vitest";
import { looksLikeBinaryToolOutput, sanitizeToolResultText } from "../../packages/protocol/src/tool-result-text.ts";
import { resultTextFromPi } from "../../apps/server/src/pi/event-normalizer.ts";

describe("sanitizeToolResultText", () => {
  it("strips ANSI color codes from normal command output", () => {
    expect(sanitizeToolResultText("\u001B[31mFAIL\u001B[0m exit 1\n")).toBe("FAIL exit 1\n");
  });

  it("keeps printable UTF-8 including CJK", () => {
    expect(sanitizeToolResultText("测试通过\nOK")).toBe("测试通过\nOK");
  });

  it("replaces largely-binary dumps with a clear placeholder", () => {
    const junk = Array.from({ length: 80 }, (_, i) =>
      String.fromCharCode(i % 2 === 0 ? 0xfffd : (i % 31) + 1),
    ).join("");
    const lines = Array.from({ length: 12 }, () => `+ ${junk}`).join("\n");
    expect(looksLikeBinaryToolOutput(lines)).toBe(true);
    expect(sanitizeToolResultText(lines)).toBe("（输出包含无法显示的二进制内容，已省略）");
  });

  it("treats NUL-containing output as binary", () => {
    expect(sanitizeToolResultText("abc\0def")).toBe("（输出包含无法显示的二进制内容，已省略）");
  });

  it("is applied by resultTextFromPi for tool content blocks", () => {
    const junk = `${"\uFFFD".repeat(40)}${"\u0001".repeat(40)}`;
    const text = resultTextFromPi({ content: [{ type: "text", text: `+ ${junk}\n+ ${junk}` }] });
    expect(text).toBe("（输出包含无法显示的二进制内容，已省略）");
  });
});
