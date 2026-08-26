import { useEffect, useMemo, useState } from "react";
import { gitPatchForPath, parseGitPatch, type PiResources, type SessionStats, type SessionTreeNode, type ToolExecution } from "@mowen/protocol";
import hljs from "highlight.js";
import { branchRoleLabel, visibleBranchNodes } from "../../copy";
import { ancestorDirs, buildFileTree, type InspectorFileEntry } from "../../lib/inspector-files";
import { FileTree } from "./FileTree";
import { ToolExecutionRow } from "../timeline/ToolExecutionRow";
import { DiffView } from "../diff/DiffView";

type Tab = "files" | "activity" | "git" | "branch" | "skills";

type FileEntry = InspectorFileEntry;
type GitSnapshot = {
  isRepo?: boolean;
  branch: string | null;
  dirty: boolean;
  entries: Array<{ path: string; status: string }>;
  remoteUrl?: string | null;
};
type Props = {
  tools: ToolExecution[];
  stats: SessionStats | null;
  files: FileEntry[];
  preview: { path: string; content: string; truncated: boolean; language?: string } | null;
  git: GitSnapshot | null;
  sessionTree?: SessionTreeNode[];
  sessionLeafId?: string | null;
  resources?: PiResources | null;
  gitDiff?: string | null;
  onReadFile: (path: string) => void;
  onLoadTree: () => void;
  onLoadGit: () => void;
  onLoadBranch?: () => void;
  onBranch?: (entryId: string) => void;
  onLoadResources?: () => void;
  onReloadResources?: () => void;
  onCreateAgents?: () => void;
  onOpenFile?: (path: string) => void;
  onUndoFile?: (path: string) => void;
  onGitDiff?: () => void;
  onGitCommit?: (message: string) => void;
  onGitInit?: () => void;
  onExport?: () => void;
  lastExportPath?: string | null;
  onOpenExport?: (path: string) => void;
  onCompact?: (customInstructions?: string) => void;
  drawer?: boolean;
  onClose?: () => void;
};

function gitStatusTone(status: string): string {
  const mark = status.trim();
  if (mark.includes("D")) return "text-danger";
  if (mark.includes("A") || mark === "??") return "text-accent";
  if (mark.includes("M")) return "text-warn";
  return "text-mute";
}

function highlight(content: string, language?: string): string {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(content, { language }).value;
  }
  return hljs.highlightAuto(content).value;
}

export function InspectorPanel({
  tools,
  stats,
  files,
  preview,
  git,
  sessionTree = [],
  sessionLeafId = null,
  resources = null,
  gitDiff = null,
  onReadFile,
  onLoadTree,
  onLoadGit,
  onLoadBranch,
  onBranch,
  onLoadResources,
  onReloadResources,
  onCreateAgents,
  onOpenFile,
  onUndoFile,
  onGitDiff,
  onGitCommit,
  onGitInit,
  onExport,
  lastExportPath = null,
  onOpenExport,
  onCompact,
  drawer,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("activity");
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedGitPath, setSelectedGitPath] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set());
  const branchNodes = visibleBranchNodes(sessionTree);
  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const gitPatches = useMemo(() => parseGitPatch(gitDiff ?? ""), [gitDiff]);
  const selectedGitPatch = selectedGitPath ? gitPatchForPath(gitPatches, selectedGitPath) : undefined;

  useEffect(() => {
    if (!git?.entries.length) {
      setSelectedGitPath(null);
      return;
    }
    setSelectedGitPath((current) =>
      current && git.entries.some((entry) => entry.path === current) ? current : (git.entries[0]?.path ?? null),
    );
  }, [git?.entries]);

  useEffect(() => {
    if (preview?.path) setTab("files");
  }, [preview?.path]);

  useEffect(() => {
    if (fileTree.length === 0) return;
    setExpandedDirs((current) => {
      if (current.size > 0) return current;
      return new Set(fileTree.filter((node) => node.kind === "dir").map((node) => node.path));
    });
  }, [fileTree]);

  useEffect(() => {
    if (!preview?.path) return;
    setExpandedDirs((current) => {
      const next = new Set(current);
      for (const dir of ancestorDirs(preview.path)) next.add(dir);
      return next;
    });
  }, [preview?.path]);

  return (
    <aside
      className={`material-sidebar flex h-full shrink-0 flex-col border-l border-line ${drawer ? "w-full shadow-dialog" : "w-[360px]"}`}
      aria-label="详情"
    >
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {(["files", "git", "activity", "branch", "skills"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`pressable h-7 shrink-0 whitespace-nowrap rounded-md px-2 text-[12px] ${tab === item ? "bg-fill-strong text-ink" : "hover-fill text-mute"}`}
              onClick={() => {
                setTab(item);
                if (item === "files") onLoadTree();
                if (item === "git") {
                  onLoadGit();
                  onGitDiff?.();
                }
                if (item === "branch") onLoadBranch?.();
                if (item === "skills") onLoadResources?.();
              }}
            >
              {item === "files"
                ? "文件"
                : item === "git"
                  ? "Git"
                  : item === "activity"
                    ? "动态"
                    : item === "branch"
                      ? "分支"
                      : "技能"}
            </button>
          ))}
        </div>
        {drawer ? (
          <button type="button" className="pressable h-7 shrink-0 px-2 text-[12px] text-mute" onClick={onClose}>
            关闭
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "activity" ? (
          <div className="space-y-2">
            {stats ? (
              <p className="mb-3 font-mono text-[11px] text-mute tabular">
                用量 {stats.tokens?.total ?? "—"} · 费用 {stats.cost?.toFixed?.(4) ?? "—"}
              </p>
            ) : null}
            {onCompact ? (
              <button type="button" className="pressable mb-3 h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink" onClick={() => onCompact()}>
                压缩上下文
              </button>
            ) : null}
            {onExport ? (
              <button type="button" className="pressable mb-3 ml-2 h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink" onClick={onExport}>
                导出 HTML
              </button>
            ) : null}
            {lastExportPath && onOpenExport ? (
              <button
                type="button"
                className="pressable mb-3 ml-2 h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink"
                onClick={() => onOpenExport(lastExportPath)}
              >
                打开
              </button>
            ) : null}
            {tools.length === 0 ? <p className="text-sm text-mute">还没有操作记录。</p> : null}
            {tools.map((tool) => (
              <ToolExecutionRow
                key={tool.toolCallId}
                tool={tool}
                onOpen={onOpenFile}
                onUndo={onUndoFile}
              />
            ))}
          </div>
        ) : null}
        {tab === "files" ? (
          <div className="space-y-3">
            {fileTree.length === 0 ? (
              <p className="text-sm text-mute">这个文件夹里还没有可预览的文件。</p>
            ) : (
              <div className="max-h-56 overflow-auto rounded-md bg-fill/40">
                <FileTree
                  nodes={fileTree}
                  expanded={expandedDirs}
                  selectedPath={preview?.path}
                  onToggleDir={(path) => {
                    setExpandedDirs((current) => {
                      const next = new Set(current);
                      if (next.has(path)) next.delete(path);
                      else next.add(path);
                      return next;
                    });
                  }}
                  onOpenFile={onReadFile}
                />
              </div>
            )}
            {preview ? (
              <pre
                className="max-h-[min(28rem,50vh)] overflow-auto rounded-md bg-canvas p-2 font-mono text-[12px] leading-5 text-ink"
                dangerouslySetInnerHTML={{
                  __html: highlight(preview.content, preview.language),
                }}
              />
            ) : fileTree.length > 0 ? (
              <p className="text-sm text-mute">点一个文件预览。这里只能看，不能直接编辑。</p>
            ) : null}
          </div>
        ) : null}
        {tab === "git" ? (
          <div className="space-y-3">
            {git?.isRepo !== false && git ? (
              <>
                <p className="text-sm text-ink">
                  {git.branch ?? "（无分支）"}
                  <span className="ml-2 text-mute">{git.dirty ? "有未提交改动" : "工作区干净"}</span>
                </p>
                <p className="break-all font-mono text-[11px] text-mute">
                  {git.remoteUrl ? `remote · ${git.remoteUrl}` : "还没有配置 remote"}
                </p>
                {git.entries.length === 0 ? <p className="text-sm text-mute">没有改动。</p> : null}
                <ul className="max-h-48 space-y-0.5 overflow-auto font-mono text-xs">
                  {git.entries.map((entry) => (
                    <li key={entry.path}>
                      <button
                        type="button"
                        className={`pressable flex min-h-8 w-full items-start gap-2 rounded-md px-1.5 py-1 text-left ${
                          selectedGitPath === entry.path ? "bg-accent-soft text-ink" : "hover-fill text-ink"
                        }`}
                        onClick={() => setSelectedGitPath(entry.path)}
                      >
                        <span className={`w-6 shrink-0 pt-0.5 ${gitStatusTone(entry.status)}`}>{entry.status.trim()}</span>
                        <span className="min-w-0 break-all">{entry.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-mute">这里不是 Git 仓库，或读不到状态。</p>
                {onGitInit ? (
                  <button
                    type="button"
                    className="pressable h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink"
                    onClick={() => onGitInit()}
                  >
                    git init
                  </button>
                ) : null}
              </div>
            )}
            {git?.isRepo !== false && git ? (
              <>
                {selectedGitPatch?.binary ? (
                  <p className="text-sm text-mute">这是二进制文件，无法预览差异。</p>
                ) : selectedGitPatch && selectedGitPatch.lines.length > 0 ? (
                  <div className="max-h-80 overflow-auto">
                    <DiffView lines={selectedGitPatch.lines} fallback="还没有差异。" />
                  </div>
                ) : gitDiff ? (
                  <p className="text-sm text-mute">
                    {selectedGitPath ? "这个文件没有文本 diff，可能是未跟踪或重命名。" : "点上面的文件看差异。"}
                  </p>
                ) : (
                  <p className="text-sm text-mute">没有 diff，或还没加载。</p>
                )}
                {onGitCommit ? (
                  <div className="space-y-2 border-t border-line pt-3">
                    <label className="block text-[12px] text-mute" htmlFor="git-commit-message">
                      提交说明
                    </label>
                    <input
                      id="git-commit-message"
                      className="field w-full text-[13px] text-ink"
                      value={commitMessage}
                      placeholder="简述这次改动"
                      onChange={(event) => setCommitMessage(event.target.value)}
                    />
                    <button
                      type="button"
                      className="pressable h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink"
                      disabled={!commitMessage.trim()}
                      onClick={() => {
                        const message = commitMessage.trim();
                        if (!message) return;
                        onGitCommit(message);
                        setCommitMessage("");
                      }}
                    >
                      提交
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        {tab === "branch" ? (
          <div className="space-y-2">
            {branchNodes.length === 0 ? <p className="text-sm text-mute">还没有分支记录。</p> : null}
            <ul className="space-y-1">
              {branchNodes.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className={`pressable flex min-h-8 w-full items-start gap-2 rounded-md px-2 py-1.5 text-left ${node.id === sessionLeafId || node.leaf ? "bg-fill" : "hover-fill"}`}
                    disabled={node.role !== "user" || !onBranch}
                    onClick={() => onBranch?.(node.id)}
                  >
                    <span className="mt-0.5 shrink-0 whitespace-nowrap rounded-md bg-fill-strong px-1.5 py-0.5 text-[11px] leading-none text-mute">
                      {branchRoleLabel(node.role)}
                    </span>
                    <span className="min-w-0 flex-1 break-all text-sm leading-5 text-ink line-clamp-2" title={node.text || undefined}>
                      {node.text.trim() || "（无文本）"}
                    </span>
                    {node.leaf ? <span className="mt-0.5 shrink-0 text-[11px] text-accent">当前</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {tab === "skills" ? (
          <div className="space-y-4">
            {onReloadResources ? (
              <button
                type="button"
                className="pressable h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink"
                onClick={() => onReloadResources()}
              >
                刷新技能
              </button>
            ) : null}
            <div>
              <p className="mb-2 text-sm text-ink">上下文文件</p>
              {resources?.agentsFiles.length ? (
                <ul className="space-y-1 font-mono text-[11px] text-mute">
                  {resources.agentsFiles.map((file) => (
                    <li key={file.path} className="break-all">
                      {file.kind} · {file.path}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  {onCreateAgents ? (
                    <button
                      type="button"
                      className="pressable h-7 rounded-md bg-fill-strong px-3 text-[12px] text-ink"
                      onClick={() => onCreateAgents()}
                    >
                      创建 AGENTS.md
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm text-ink">技能</p>
              {resources?.skills.length ? (
                <ul className="space-y-1 text-sm text-ink">
                  {resources.skills.map((skill) => (
                    <li key={skill.path} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate">{skill.name}</span>
                      <span className="shrink-0 text-[11px] text-mute">{skill.scope === "user" ? "用户" : "项目"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mute">
                  {resources?.trustProject ? "这个项目还没有技能。" : "未信任项目，只显示用户技能。"}
                </p>
              )}
            </div>
            {resources?.templates.length ? (
              <div>
                <p className="mb-2 text-sm text-ink">提示模板</p>
                <ul className="space-y-1 text-sm text-ink">
                  {resources.templates.map((item) => (
                    <li key={item.path}>{item.name}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
