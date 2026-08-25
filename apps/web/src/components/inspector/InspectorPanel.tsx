import { useEffect, useState } from "react";
import type { PiResources, SessionStats, SessionTreeNode, ToolExecution } from "@mowen/protocol";
import hljs from "highlight.js";
import { branchRoleLabel, visibleBranchNodes } from "../../copy";
import { ToolExecutionRow } from "../timeline/ToolExecutionRow";
import { DiffView } from "../diff/DiffView";

type Tab = "changes" | "files" | "activity" | "git" | "branch" | "skills";

type FileEntry = { path: string; name: string; kind: "file" | "dir" };
type GitSnapshot = {
  branch: string | null;
  dirty: boolean;
  entries: Array<{ path: string; status: string }>;
};
type CheckpointRecord = {
  id: string;
  path: string;
  createdAt: string;
  toolName?: string;
};

type Props = {
  tools: ToolExecution[];
  stats: SessionStats | null;
  files: FileEntry[];
  preview: { path: string; content: string; truncated: boolean; language?: string } | null;
  git: GitSnapshot | null;
  checkpoints: CheckpointRecord[];
  sessionTree?: SessionTreeNode[];
  sessionLeafId?: string | null;
  resources?: PiResources | null;
  gitDiff?: string | null;
  onReadFile: (path: string) => void;
  onLoadTree: () => void;
  onLoadGit: () => void;
  onRestore: (checkpointId: string) => void;
  onLoadBranch?: () => void;
  onBranch?: (entryId: string) => void;
  onLoadResources?: () => void;
  onReloadResources?: () => void;
  onOpenFile?: (path: string) => void;
  onUndoFile?: (path: string) => void;
  onGitDiff?: () => void;
  onGitCommit?: (message: string) => void;
  onExport?: () => void;
  lastExportPath?: string | null;
  onOpenExport?: (path: string) => void;
  onCompact?: (customInstructions?: string) => void;
  drawer?: boolean;
  onClose?: () => void;
};

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
  checkpoints,
  sessionTree = [],
  sessionLeafId = null,
  resources = null,
  gitDiff = null,
  onReadFile,
  onLoadTree,
  onLoadGit,
  onRestore,
  onLoadBranch,
  onBranch,
  onLoadResources,
  onReloadResources,
  onOpenFile,
  onUndoFile,
  onGitDiff,
  onGitCommit,
  onExport,
  lastExportPath = null,
  onOpenExport,
  onCompact,
  drawer,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("activity");
  const [commitMessage, setCommitMessage] = useState("");
  const branchNodes = visibleBranchNodes(sessionTree);

  useEffect(() => {
    if (preview?.path) setTab("files");
  }, [preview?.path]);
  const changed = tools.filter((tool) => tool.toolName === "write" || tool.toolName === "edit");
  const sortedFiles = [...files].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  return (
    <aside
      className={`material-sidebar flex h-full shrink-0 flex-col border-l border-line ${drawer ? "w-full shadow-dialog" : "w-[360px]"}`}
      aria-label="详情"
    >
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {(["changes", "files", "git", "activity", "branch", "skills"] as const).map((item) => (
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
              {item === "changes"
                ? "改动"
                : item === "files"
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
        {tab === "changes" ? (
          <div className="space-y-4">
            {changed.length === 0 ? <p className="text-sm text-mute">这次对话还没有改文件。</p> : null}
            {changed.map((tool) => {
              const args = tool.args as Record<string, unknown> | undefined;
              return (
                <div key={tool.toolCallId}>
                  <p className="font-mono text-xs text-accent">{tool.target}</p>
                  <div className="mt-1">
                    <DiffView
                      oldText={typeof args?.oldText === "string" ? args.oldText : undefined}
                      newText={typeof args?.newText === "string" ? args.newText : undefined}
                      content={typeof args?.content === "string" ? args.content : undefined}
                      fallback={tool.resultText ?? "还没有差异。"}
                    />
                  </div>
                </div>
              );
            })}
            {checkpoints.length > 0 ? (
              <div className="border-t border-line pt-3">
                <p className="mb-2 text-sm text-ink">检查点</p>
                <ul className="space-y-2">
                  {checkpoints.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-all font-mono text-[11px] text-mute">
                        {item.path}
                        <span className="block">{new Date(item.createdAt).toLocaleTimeString()}</span>
                      </span>
                      <button
                        type="button"
                        className="pressable h-7 shrink-0 rounded-md bg-fill-strong px-2 text-[12px] text-ink"
                        onClick={() => onRestore(item.id)}
                      >
                        还原
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {tab === "files" ? (
          <div className="grid grid-rows-[auto_1fr] gap-3">
            <ul className="max-h-48 overflow-auto font-mono text-xs">
              {sortedFiles.map((entry) => (
                <li key={entry.path}>
                  {entry.kind === "file" ? (
                    <button
                      type="button"
                      className="pressable block h-8 w-full truncate px-1 text-left text-ink"
                      onClick={() => onReadFile(entry.path)}
                    >
                      {entry.path}
                    </button>
                  ) : (
                    <span className="block px-1 py-2 text-mute">{entry.path}/</span>
                  )}
                </li>
              ))}
            </ul>
            {preview ? (
              <pre
                className="overflow-auto rounded-md bg-canvas p-2 font-mono text-[12px] leading-5 text-ink"
                dangerouslySetInnerHTML={{
                  __html: highlight(preview.content, preview.language),
                }}
              />
            ) : (
              <p className="text-sm text-mute">点一个文件预览。这里只能看，不能直接编辑。</p>
            )}
          </div>
        ) : null}
        {tab === "git" ? (
          <div className="space-y-3">
            {git ? (
              <>
                <p className="text-sm text-ink">
                  {git.branch ?? "（无分支）"}
                  <span className="ml-2 text-mute">{git.dirty ? "有未提交改动" : "工作区干净"}</span>
                </p>
                {git.entries.length === 0 ? <p className="text-sm text-mute">没有改动。</p> : null}
                <ul className="space-y-1 font-mono text-xs">
                  {git.entries.map((entry) => (
                    <li key={entry.path} className="flex gap-2">
                      <span className="w-8 shrink-0 text-mute">{entry.status}</span>
                      <span className="min-w-0 break-all text-ink">{entry.path}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-mute">这里不是 Git 仓库，或读不到状态。</p>
            )}
            {gitDiff ? (
              <pre className="max-h-64 overflow-auto rounded-md bg-canvas p-2 font-mono text-[11px] leading-5 text-mute">
                {gitDiff}
              </pre>
            ) : git ? (
              <p className="text-sm text-mute">没有 diff，或还没加载。</p>
            ) : null}
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
          </div>
        ) : null}
        {tab === "branch" ? (
          <div className="space-y-2">
            <p className="text-sm leading-5 text-mute">这是 Pi 的会话树。可以从任意一条用户消息重新分叉。</p>
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
                <p className="text-sm text-mute">没有找到 AGENTS.md 或同类文件。</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm text-ink">技能</p>
              {resources?.skills.length ? (
                <ul className="space-y-1 text-sm text-ink">
                  {resources.skills.map((skill) => (
                    <li key={skill.path}>
                      {skill.name}
                      <span className="ml-2 text-[11px] text-mute">{skill.scope === "user" ? "用户" : "项目"}</span>
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
