import { describe, expect, it } from "vitest";
import { loadConfig, parseAllowedRoots } from "../../apps/server/src/config.ts";

describe("config", () => {
  it("defaults allowed roots to the launch directory", () => {
    expect(parseAllowedRoots(undefined, "/workspace/project")).toEqual(["/workspace/project"]);
  });

  it("rejects invalid process and port limits", () => {
    expect(() => loadConfig({ MYPI_MAX_PROCESSES: "0" })).toThrow();
    expect(() => loadConfig({ PORT: "70000" })).toThrow();
  });
});
