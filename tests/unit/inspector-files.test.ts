import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ancestorDirs,
  buildFileTree,
  parentDir,
  previewableFileEntries,
} from "../../apps/web/src/lib/inspector-files";

const entries = [
  { path: "apps", name: "apps", kind: "dir" as const },
  { path: "apps/desktop", name: "desktop", kind: "dir" as const },
  { path: "apps/desktop/scripts", name: "scripts", kind: "dir" as const },
  { path: "apps/desktop/src", name: "src", kind: "dir" as const },
  { path: "apps/desktop/src/main", name: "main", kind: "dir" as const },
  { path: "apps/desktop/src/preload", name: "preload", kind: "dir" as const },
  { path: "apps/desktop/package.json", name: "package.json", kind: "file" as const },
  { path: "apps/desktop/afterPack.mjs", name: "afterPack.mjs", kind: "file" as const },
  { path: "README.md", name: "README.md", kind: "file" as const },
];

describe("previewableFileEntries", () => {
  it("lists only files so the Files tab is not buried under non-clickable dirs", () => {
    const visible = previewableFileEntries(entries);

    expect(visible.every((entry) => entry.kind === "file")).toBe(true);
    expect(visible.some((entry) => entry.kind === "dir")).toBe(false);
    expect(visible.map((entry) => entry.path)).toEqual(
      ["README.md", "apps/desktop/afterPack.mjs", "apps/desktop/package.json"].sort((a, b) =>
        a.localeCompare(b),
      ),
    );
  });
});

describe("buildFileTree", () => {
  it("nests dirs above files and keeps root files at the top level", () => {
    const tree = buildFileTree(entries);
    expect(tree.map((node) => node.name)).toEqual(["apps", "README.md"]);
    const desktop = tree[0]?.children.find((node) => node.name === "desktop");
    expect(desktop?.kind).toBe("dir");
    expect(desktop?.children.map((node) => node.name)).toEqual(["scripts", "src", "afterPack.mjs", "package.json"]);
  });

  it("resolves parent folders of a previewed file", () => {
    expect(parentDir("apps/desktop/afterPack.mjs")).toBe("apps/desktop");
    expect(ancestorDirs("apps/desktop/afterPack.mjs")).toEqual(["apps", "apps/desktop"]);
  });
});

describe("InspectorPanel tabs", () => {
  it("keeps 文件 Git 动态 分支 技能 and does not offer 改动", () => {
    const src = readFileSync(path.resolve("apps/web/src/components/inspector/InspectorPanel.tsx"), "utf8");
    expect(src).toMatch(/\(\["files", "git", "activity", "branch", "skills"\] as const\)/);
    expect(src).not.toMatch(/"changes"/);
    expect(src).not.toMatch(/\? "改动"/);
    expect(src).not.toMatch(/tab === "changes"/);
  });
});
