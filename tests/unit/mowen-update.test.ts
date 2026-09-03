import { describe, expect, it } from "vitest";
import {
  fetchLatestMowenRelease,
  isMowenUpdateAvailable,
  parseMowenRelease,
} from "../../apps/server/src/setup/mowen-update.ts";

describe("Mowen update metadata", () => {
  it("parses a GitHub release and compares semver tags", () => {
    const release = parseMowenRelease({
      tag_name: "v0.1.6",
      name: "Mowen 0.1.6",
      html_url: "https://github.com/Yunz93/Mowen/releases/tag/v0.1.6",
      body: "notes",
      published_at: "2026-09-03T00:00:00Z",
      prerelease: false,
      assets: [{ name: "Mowen.dmg", browser_download_url: "https://example.test/Mowen.dmg", size: 42 }],
    });
    expect(release.version).toBe("0.1.6");
    expect(release.assets[0]?.name).toBe("Mowen.dmg");
    expect(isMowenUpdateAvailable(release.version, "0.1.5")).toBe(true);
    expect(isMowenUpdateAvailable(release.version, "0.1.6")).toBe(false);
    expect(isMowenUpdateAvailable("v0.1.5", "0.1.6")).toBe(false);
  });

  it("returns a user-facing error when GitHub metadata cannot be fetched", async () => {
    const result = await fetchLatestMowenRelease({ fetchJson: async () => { throw new Error("offline"); } });
    expect(result.release).toBeNull();
    expect(result.error).toBe("offline");
  });
});
