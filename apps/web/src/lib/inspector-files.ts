export type GitFileMark = { letter: string; tone: "accent" | "warn" | "danger" };

export function gitMarkForStatus(status: string): GitFileMark | null {
  const mark = status.trim();
  if (mark === "??" || mark.includes("A")) return { letter: "U", tone: "accent" };
  if (mark.includes("D")) return { letter: "D", tone: "danger" };
  if (mark.includes("M")) return { letter: "M", tone: "warn" };
  if (mark.includes("R")) return { letter: "R", tone: "accent" };
  return null;
}

export function gitMarksByPath(entries: Array<{ path: string; status: string }>): Map<string, GitFileMark> {
  const map = new Map<string, GitFileMark>();
  for (const entry of entries) {
    const mark = gitMarkForStatus(entry.status);
    if (!mark) continue;
    const cleaned = entry.path.replace(/^"(.*)"$/u, "$1").split(" -> ").pop()?.trim() ?? entry.path;
    map.set(cleaned, mark);
  }
  return map;
}

export type FileKindBadge = { label: string; className: string };

export function fileKindBadge(name: string): FileKindBadge {
  const lower = name.toLowerCase();
  if (lower === ".env" || lower.startsWith(".env.") || lower.endsWith(".env") || lower.includes(".env.")) {
    return { label: "ENV", className: "bg-fill-strong text-mute" };
  }
  const ext = lower.includes(".") ? (lower.split(".").pop() ?? "") : "";
  if (ext === "ts" || ext === "tsx" || ext === "mts" || ext === "cts") {
    return { label: "TS", className: "bg-accent-soft text-accent" };
  }
  if (ext === "js" || ext === "jsx" || ext === "mjs" || ext === "cjs") {
    return { label: "JS", className: "bg-warn/20 text-warn" };
  }
  if (ext === "json" || ext === "jsonc") return { label: "{}", className: "bg-warn/15 text-warn" };
  if (ext === "md" || ext === "mdx") return { label: "MD", className: "bg-info/15 text-info" };
  if (ext === "css" || ext === "scss") return { label: "CSS", className: "bg-accent-soft text-accent" };
  if (ext === "yml" || ext === "yaml") return { label: "YML", className: "bg-danger/15 text-danger" };
  if (lower === "dockerfile") return { label: "DK", className: "bg-info/15 text-info" };
  return { label: ext.slice(0, 3).toUpperCase() || "·", className: "bg-fill-strong text-mute" };
}

export type InspectorFileEntry = { path: string; name: string; kind: "file" | "dir" };

export type FileTreeNode = InspectorFileEntry & { children: FileTreeNode[] };

/** Entries shown in the Files tab: only previewable files, path-sorted. */
export function previewableFileEntries(entries: InspectorFileEntry[]): InspectorFileEntry[] {
  return entries
    .filter((entry) => entry.kind === "file")
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function parentDir(filePath: string): string | null {
  const normalized = filePath.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return index === 0 ? "/" : null;
  return normalized.slice(0, index);
}

/** Folder paths from workspace root down to the file's parent. */
export function ancestorDirs(filePath: string): string[] {
  const dirs: string[] = [];
  let current = parentDir(filePath);
  while (current) {
    dirs.unshift(current);
    current = parentDir(current);
  }
  return dirs;
}

function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  nodes.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "dir" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
  for (const node of nodes) sortTree(node.children);
  return nodes;
}

/** Nest a flat `files.tree` listing into a directory tree. */
export function buildFileTree(entries: InspectorFileEntry[]): FileTreeNode[] {
  const dirs = new Map<string, FileTreeNode>();
  const roots: FileTreeNode[] = [];

  const ensureDir = (dirPath: string): FileTreeNode => {
    const existing = dirs.get(dirPath);
    if (existing) return existing;
    const name = dirPath.replaceAll("\\", "/").split("/").pop() || dirPath;
    const node: FileTreeNode = { path: dirPath, name, kind: "dir", children: [] };
    dirs.set(dirPath, node);
    const parent = parentDir(dirPath);
    if (!parent) roots.push(node);
    else ensureDir(parent).children.push(node);
    return node;
  };

  for (const entry of entries) {
    if (entry.kind === "dir") {
      const node = ensureDir(entry.path);
      node.name = entry.name;
      continue;
    }
    const file: FileTreeNode = { ...entry, children: [] };
    const parent = parentDir(entry.path);
    if (!parent) roots.push(file);
    else ensureDir(parent).children.push(file);
  }

  return sortTree(roots);
}
