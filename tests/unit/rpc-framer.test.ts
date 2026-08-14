import { describe, expect, it } from "vitest";
import { splitJsonlChunk, serializeJsonLine } from "../../apps/server/src/pi/rpc-framer.ts";

describe("JSONL framer", () => {
  it("reassembles records split across arbitrary chunks", () => {
    const record = serializeJsonLine({ type: "prompt", message: "hello" }).trim();
    const chunks = [record.slice(0, 3), record.slice(3, 11), `${record.slice(11)}\n`];
    let buffer = "";
    const lines: string[] = [];
    for (const chunk of chunks) {
      const split = splitJsonlChunk(buffer, chunk);
      buffer = split.buffer;
      lines.push(...split.lines);
    }
    expect(lines).toEqual([record]);
  });

  it("does not split on U+2028 or U+2029", () => {
    const payload = { type: "prompt", message: "a\u2028b\u2029c" };
    const encoded = `${JSON.stringify(payload)}\nmore\n`;
    const split = splitJsonlChunk("", encoded);
    expect(split.lines).toHaveLength(2);
    expect(JSON.parse(split.lines[0]!).message).toBe("a\u2028b\u2029c");
  });
});
