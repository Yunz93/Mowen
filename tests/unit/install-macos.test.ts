import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/install-macos.sh");

describe("install-macos.sh", () => {
  it("has valid bash syntax", () => {
    execFileSync("bash", ["-n", script]);
  });

  it("prints help without requiring macOS", () => {
    const out = execFileSync("bash", [script, "--help"], { encoding: "utf8" });
    expect(out).toContain("一键安装");
    expect(out).toContain("--trust-only");
  });
});
