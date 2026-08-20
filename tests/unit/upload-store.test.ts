import { describe, expect, it } from "vitest";
import { UploadStore } from "../../apps/server/src/tasks/upload-store.ts";

describe("upload store", () => {
  it("caps retained bytes and consumes uploads once", () => {
    const store = new UploadStore(5);
    expect(store.add("first", "image/png", Buffer.alloc(3))).toBe(true);
    expect(store.add("second", "image/png", Buffer.alloc(3))).toBe(false);
    expect(store.consume(["first"])).toHaveLength(1);
    expect(store.consume(["first"])).toHaveLength(0);
    expect(store.add("second", "image/png", Buffer.alloc(3))).toBe(true);
  });
});
