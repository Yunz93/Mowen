import { opendir, readFile } from "node:fs/promises";
import path from "node:path";
import { resolveAllowedPath } from "../security/path-policy.js";

export type FileEntry = { path: string; name: string; kind: "file" | "dir" };

const MAX_ENTRIES = 400;
const MAX_DEPTH = 6;
const MAX_PREVIEW_BYTES = 200_000;

const IGNORED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",
  "__pycache__",
  "venv",
  ".venv",
  "target",
  ".mypi-test",
  "vendor",
  "bower_components",
  ".DS_Store",
]);

export async function listProjectFiles(root: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || entries.length >= MAX_ENTRIES) return;
    const directory = await opendir(dir);
    for await (const child of directory) {
      if (entries.length >= MAX_ENTRIES) break;
      if (child.name.startsWith(".") || IGNORED_DIR_NAMES.has(child.name)) continue;
      const full = path.join(dir, child.name);
      const relative = path.relative(root, full);
      if (child.isDirectory()) {
        entries.push({ path: relative, name: child.name, kind: "dir" });
        await walk(full, depth + 1);
      } else {
        entries.push({ path: relative, name: child.name, kind: "file" });
      }
    }
  };
  await walk(root, 0);
  return entries;
}

export async function previewProjectFile(relativePath: string, cwd: string, allowedRoots: string[]) {
  const resolved = await resolveAllowedPath(relativePath, cwd, allowedRoots);
  const buffer = await readFile(resolved);
  return {
    path: relativePath,
    content: buffer.subarray(0, MAX_PREVIEW_BYTES).toString("utf8"),
    truncated: buffer.byteLength > MAX_PREVIEW_BYTES,
    language: path.extname(relativePath).slice(1) || undefined,
  };
}
