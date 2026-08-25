import { describe, expect, it } from "vitest";
import { extractAtMentions } from "../../packages/protocol/src/mentions.ts";

describe("extractAtMentions", () => {
  it("collects unique @paths", () => {
    expect(extractAtMentions("see @README.md and @src/app.ts then @README.md")).toEqual([
      "README.md",
      "src/app.ts",
    ]);
  });

  it("ignores email-like tokens and empty mentions", () => {
    expect(extractAtMentions("write user@example.com then @")).toEqual([]);
    expect(extractAtMentions("@.")).toEqual([]);
  });
});
