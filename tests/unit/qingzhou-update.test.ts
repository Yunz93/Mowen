import { describe, expect, it } from "vitest";
import {
  assertChecksum,
  currentQingzhouVersion,
  fetchLatestQingzhouRelease,
  isQingzhouUpdateAvailable,
  parseQingzhouRelease,
  parseSha256Sums,
  sha256Hex,
  startQingzhouUpdate,
} from "../../apps/server/src/setup/qingzhou-update.ts";

describe("Qingzhou update metadata", () => {
  it("parses a GitHub release and compares semver tags", () => {
    const release = parseQingzhouRelease({
      tag_name: "v0.1.6",
      name: "Qingzhou 0.1.6",
      html_url: "https://github.com/Yunz93/Mowen/releases/tag/v0.1.6",
      body: "notes",
      published_at: "2026-09-03T00:00:00Z",
      prerelease: false,
      assets: [{ name: "Qingzhou.dmg", browser_download_url: "https://example.test/Qingzhou.dmg", size: 42 }],
    });
    expect(release.version).toBe("0.1.6");
    expect(release.assets[0]?.name).toBe("Qingzhou.dmg");
    expect(isQingzhouUpdateAvailable(release.version, "0.1.5")).toBe(true);
    expect(isQingzhouUpdateAvailable(release.version, "0.1.6")).toBe(false);
    expect(isQingzhouUpdateAvailable("v0.1.5", "0.1.6")).toBe(false);
  });

  it("returns a user-facing error when GitHub metadata cannot be fetched", async () => {
    const result = await fetchLatestQingzhouRelease({ fetchJson: async () => { throw new Error("offline"); } });
    expect(result.release).toBeNull();
    expect(result.error).toBe("offline");
  });

  it("reads the package version when QINGZHOU_VERSION is unset", () => {
    expect(currentQingzhouVersion({})).toMatch(/^\d+\.\d+\.\d+$/);
    expect(currentQingzhouVersion({ QINGZHOU_VERSION: "v1.2.3" })).toBe("1.2.3");
    expect(currentQingzhouVersion({ MOWEN_VERSION: "v0.1.8" })).toBe("0.1.8");
  });

  it("rejects updater payloads that do not match SHA256SUMS.txt", () => {
    const script = "#!/bin/bash\necho ok\n";
    const sums = parseSha256Sums(`${sha256Hex(script)}  install-macos.sh\n`);
    expect(() => assertChecksum("install-macos.sh", script, sums)).not.toThrow();
    expect(() => assertChecksum("install-macos.sh", `${script}tampered`, sums)).toThrow(/校验和/);
    expect(() => assertChecksum("missing.sh", script, sums)).toThrow(/没有/);
  });

  it("does not spawn an updater when the downloaded script fails the checksum", async () => {
    await expect(
      startQingzhouUpdate({
        version: "0.1.8",
        platform: "darwin",
        fetchText: async (url) => {
          if (url.endsWith("SHA256SUMS.txt")) return `${sha256Hex("good")}  install-macos.sh\n`;
          return "tampered";
        },
      }),
    ).rejects.toThrow(/校验和/);
  });
});
