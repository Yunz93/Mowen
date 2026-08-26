import { ChevronRight, File, Folder } from "lucide-react";
import type { FileTreeNode } from "../../lib/inspector-files";

type Props = {
  nodes: FileTreeNode[];
  expanded: ReadonlySet<string>;
  selectedPath?: string | null;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  depth?: number;
};

export function FileTree({ nodes, expanded, selectedPath, onToggleDir, onOpenFile, depth = 0 }: Props) {
  return (
    <ul className={depth === 0 ? "font-mono text-xs" : undefined} role={depth === 0 ? "tree" : "group"}>
      {nodes.map((node) => {
        const open = node.kind === "dir" && expanded.has(node.path);
        const selected = node.kind === "file" && selectedPath === node.path;
        return (
          <li key={node.path} role="treeitem" aria-expanded={node.kind === "dir" ? open : undefined}>
            <button
              type="button"
              className={`pressable flex h-7 w-full items-center gap-1 rounded-md pr-1.5 text-left ${
                selected ? "bg-accent-soft text-ink" : "hover-fill text-ink"
              }`}
              style={{ paddingLeft: 6 + depth * 12 }}
              onClick={() => (node.kind === "dir" ? onToggleDir(node.path) : onOpenFile(node.path))}
            >
              {node.kind === "dir" ? (
                <ChevronRight size={12} className={`shrink-0 text-mute transition-transform ${open ? "rotate-90" : ""}`} />
              ) : (
                <span className="inline-block w-3 shrink-0" />
              )}
              {node.kind === "dir" ? (
                <Folder size={13} className="shrink-0 text-mute" />
              ) : (
                <File size={13} className="shrink-0 text-mute" />
              )}
              <span className="min-w-0 truncate">{node.name}</span>
            </button>
            {node.kind === "dir" && open && node.children.length > 0 ? (
              <FileTree
                nodes={node.children}
                expanded={expanded}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onOpenFile={onOpenFile}
                depth={depth + 1}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
