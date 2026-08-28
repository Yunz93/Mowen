import { ChevronRight, Folder } from "lucide-react";
import { fileKindBadge, type FileTreeNode, type GitFileMark } from "../../lib/inspector-files";

type Props = {
  nodes: FileTreeNode[];
  expanded: ReadonlySet<string>;
  selectedPath?: string | null;
  gitMarks?: ReadonlyMap<string, GitFileMark>;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  depth?: number;
};

const toneClass: Record<GitFileMark["tone"], string> = {
  accent: "text-accent",
  warn: "text-warn",
  danger: "text-danger",
};

export function FileTree({
  nodes,
  expanded,
  selectedPath,
  gitMarks,
  onToggleDir,
  onOpenFile,
  depth = 0,
}: Props) {
  return (
    <ul className={depth === 0 ? "py-1 text-[12px]" : undefined} role={depth === 0 ? "tree" : "group"}>
      {nodes.map((node) => {
        const open = node.kind === "dir" && expanded.has(node.path);
        const selected = node.kind === "file" && selectedPath === node.path;
        const mark = node.kind === "file" ? gitMarks?.get(node.path) : undefined;
        const badge = node.kind === "file" ? fileKindBadge(node.name) : null;
        return (
          <li key={node.path} role="treeitem" aria-expanded={node.kind === "dir" ? open : undefined}>
            <button
              type="button"
              className={`pressable flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left ${
                selected ? "bg-fill-strong text-ink" : "hover-fill text-ink"
              }`}
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() => (node.kind === "dir" ? onToggleDir(node.path) : onOpenFile(node.path))}
            >
              {node.kind === "dir" ? (
                <ChevronRight size={12} className={`shrink-0 text-mute transition-transform ${open ? "rotate-90" : ""}`} />
              ) : (
                <span className="inline-block w-3 shrink-0" />
              )}
              {node.kind === "dir" ? (
                <Folder size={14} className="shrink-0 text-mute" />
              ) : (
                <span
                  className={`inline-flex h-4 w-5 shrink-0 items-center justify-center rounded-[3px] font-mono text-[8px] leading-none ${badge?.className ?? ""}`}
                >
                  {badge?.label}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              {mark ? (
                <span className={`w-3 shrink-0 text-center font-mono text-[11px] ${toneClass[mark.tone]}`}>
                  {mark.letter}
                </span>
              ) : null}
            </button>
            {node.kind === "dir" && open && node.children.length > 0 ? (
              <FileTree
                nodes={node.children}
                expanded={expanded}
                selectedPath={selectedPath}
                gitMarks={gitMarks}
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
