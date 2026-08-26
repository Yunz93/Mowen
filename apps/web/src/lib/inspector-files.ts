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
