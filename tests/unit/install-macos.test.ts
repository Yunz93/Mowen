import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    expect(out).toContain("--nightly");
    expect(out).toContain("GitHub Release");
    expect(out).toContain("Yunz93/Mowen");
  });

  it("does not expand an empty auth header array", () => {
    const src = readFileSync(script, "utf8");
    expect(src).not.toMatch(/"\$\{auth_header\[@\]\}"/);
    expect(src).toContain("curl_github");
  });

  it("passes a nounset self-test without GitHub tokens", () => {
    const out = execFileSync("bash", [script], {
      encoding: "utf8",
      env: { ...process.env, MOWEN_SELF_TEST: "1", GITHUB_TOKEN: "", GH_TOKEN: "" },
    });
    expect(out).toContain("self-test passed");
  });

  it("prefers zip over dmg and parses volume paths that contain spaces", () => {
    const src = readFileSync(script, "utf8");
    const zipIndex = src.indexOf('"Mowen-mac-${arch}.zip"');
    const dmgIndex = src.indexOf('"Mowen-mac-${arch}.dmg"');
    expect(zipIndex).toBeGreaterThan(0);
    expect(dmgIndex).toBeGreaterThan(zipIndex);
    expect(src.indexOf('"ohMyPi-mac-${arch}.zip"')).toBeGreaterThan(dmgIndex);
    expect(src).toContain("parse_hdiutil_mount");
    expect(src).not.toMatch(/awk '\/\\\/Volumes/);
    expect(src).toContain("SHA256SUMS.txt");
    expect(src).toContain("verify_release_file");
    expect(src).toContain("Intel 需要 x64");
  });
});
