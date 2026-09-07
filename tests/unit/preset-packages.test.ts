import { describe, expect, it } from "vitest";
import {
  PRESET_PI_PACKAGES,
  normalizePackageSource,
  packageSourcesEqual,
  presetPackageInstalled,
  resolvePresetPackages,
} from "../../packages/protocol/src/preset-packages.ts";

describe("preset pi packages", () => {
  it("lists the recommended community extensions", () => {
    expect(PRESET_PI_PACKAGES.map((item) => item.id)).toEqual([
      "pi-web-access",
      "pi-memory",
      "rpiv-todo",
      "pi-subagents",
      "pi-mcp-adapter",
      "context-mode",
    ]);
    expect(PRESET_PI_PACKAGES.find((item) => item.id === "context-mode")?.mcp?.name).toBe("context-mode");
  });

  it("normalizes npm sources and detects installed presets", () => {
    expect(normalizePackageSource("pi-memory")).toBe("npm:pi-memory");
    expect(packageSourcesEqual("pi-web-access", "npm:pi-web-access")).toBe(true);
    expect(
      presetPackageInstalled(
        PRESET_PI_PACKAGES[0]!,
        [{ source: "npm:pi-web-access" }],
        [],
      ),
    ).toBe(true);
    expect(
      presetPackageInstalled(PRESET_PI_PACKAGES.find((item) => item.id === "rpiv-todo")!, [], [
        { name: "rpiv-todo" },
      ]),
    ).toBe(true);
    expect(presetPackageInstalled(PRESET_PI_PACKAGES[1]!, [], [{ name: "demo-ext" }])).toBe(false);
  });

  it("resolves ids or the full catalog", () => {
    expect(resolvePresetPackages().map((item) => item.id)).toHaveLength(6);
    expect(resolvePresetPackages(["pi-memory", "pi-subagents"]).map((item) => item.id)).toEqual([
      "pi-memory",
      "pi-subagents",
    ]);
    expect(() => resolvePresetPackages(["not-a-plugin"])).toThrow("未知的预置插件");
  });
});
