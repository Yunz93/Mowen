import { readdir, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isInsideRoot } from "../security/path-policy.js";

export type FolderEntry = {
  path: string;
  name: string;
  kind: "dir";
};

const HIDDEN = new Set([".git", "node_modules", ".Trash", "Library"]);

export async function listFolders(
  requestPath: string | undefined,
  browseRoots: string[],
): Promise<{ cwd: string; parent: string | null; entries: FolderEntry[]; roots: string[] }> {
  const roots = await Promise.all(
    browseRoots.map(async (root) => {
      try {
        return await realpath(root);
      } catch {
        return path.resolve(root);
      }
    }),
  );

  const fallback = roots[0] ?? os.homedir();
  const target = requestPath?.trim() ? path.resolve(requestPath) : fallback;

  let resolved: string;
  try {
    resolved = await realpath(target);
  } catch {
    throw new Error(`Folder does not exist: ${target}`);
  }

  const allowed = roots.some((root) => isInsideRoot(resolved, root));
  if (!allowed) {
    throw new Error("Folder is outside the allowed browse area");
  }

  const stats = await stat(resolved);
  if (!stats.isDirectory()) {
    throw new Error("Path is not a folder");
  }

  const dirents = await readdir(resolved, { withFileTypes: true });
  const entries: FolderEntry[] = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    if (dirent.name.startsWith(".") && dirent.name !== ".ohmypi" && dirent.name !== ".mypi-web") continue;
    if (HIDDEN.has(dirent.name)) continue;
    entries.push({
      path: path.join(resolved, dirent.name),
      name: dirent.name,
      kind: "dir",
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const parentDir = path.dirname(resolved);
  const parentAllowed = roots.some((root) => isInsideRoot(parentDir, root));
  const parent = parentAllowed && parentDir !== resolved ? parentDir : null;

  return { cwd: resolved, parent, entries, roots };
}
