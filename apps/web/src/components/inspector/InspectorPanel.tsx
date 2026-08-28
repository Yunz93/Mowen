import { useEffect, useMemo, useRef, useState } from "react";
import { X, PanelRight, PanelRightClose } from "lucide-react";
import {
  gitPatchForPath,
  parseGitPatch,
  patchLineCounts,
  type PiResources,
} from "@mowen/protocol";
import { ancestorDirs, buildFileTree, gitMarksByPath, type InspectorFileEntry } from "../../lib/inspector-files";
import { FileTree } from "./FileTree";
import { FilePreview } from "./FilePreview";
import { DiffView } from "../diff/DiffView";
import { InspectorTerminal } from "./InspectorTerminal";
import { InspectorBrowser } from "./InspectorBrowser";
import { InspectorRules } from "./InspectorRules";
import { InspectorSkills } from "./InspectorSkills";

type Tab = "files" | "git" | "term" | "browser" | "rules" | "skills";

type FileEntry = InspectorFileEntry;
type GitSnapshot = {
  isRepo?: boolean;
  branch: string | null;
  dirty: boolean;
  entries: Array<{ path: string; status: string }>;
  remoteUrl?: string | null;
};
type Props = {
  taskId?: string | null;
  cwd?: string | null;
  files: FileEntry[];
  preview: { path: string; content: string; truncated: boolean; language?: string } | null;
  git: GitSnapshot | null;
  resources?: PiResources | null;
  gitDiff?: string | null;
  onReadFile: (path: string) => void;
  onLoadTree: () => void;
  onLoadGit: () => void;
  onLoadResources?: () => void;
  onReloadResources?: () => void;
  onCreateAgents?: () => void;
  onGitDiff?: () => void;
  onGitCommit?: (message: string, push?: boolean) => void;
  onGitInit?: () => void;
  onExport?: () => void;
  lastExportPath?: string | null;
  onOpenExport?: (path: string) => void;
  onReadResource?: (path: string) => Promise<{ path: string; content: string; truncated: boolean }>;
  onWriteResource?: (path: string, content: string) => Promise<void>;
  onToggleSkill?: (path: string, enabled: boolean) => void;
  drawer?: boolean;
  onClose?: () => void;
};

function isNewGitEntry(status: string): boolean {
  const mark = status.trim();
  return mark === "??" || mark.includes("A");
}

export function InspectorPanel({
  taskId = null,
  cwd = null,
  files,
  preview,
  git,
  resources = null,
  gitDiff = null,
  onReadFile,
  onLoadTree,
  onLoadGit,
  onLoadResources,
  onReloadResources,
  onCreateAgents,
  onGitDiff,
  onGitCommit,
  onGitInit,
  onExport,
  lastExportPath = null,
  onOpenExport,
  onReadResource,
  onWriteResource,
  onToggleSkill,
  drawer,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("files");
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitMode, setCommitMode] = useState<"commit" | "push">("commit");
  const commitInputRef = useRef<HTMLTextAreaElement>(null);
  const [expandedGitPath, setExpandedGitPath] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set());
  const [treeOpen, setTreeOpen] = useState(true);

  useEffect(() => {
    onLoadTree();
    onLoadGit();
  }, []);

  const fileTree = useMemo(() => buildFileTree(files), [files]);
  const gitMarks = useMemo(() => gitMarksByPath(git?.entries ?? []), [git?.entries]);
  const gitPatches = useMemo(() => parseGitPatch(gitDiff ?? ""), [gitDiff]);
  const gitTotals = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const file of gitPatches) {
      const counts = patchLineCounts(file.lines);
      added += counts.added;
      removed += counts.removed;
    }
    return { added, removed };
  }, [gitPatches]);

  useEffect(() => {
    if (!git?.entries.length) {
      setExpandedGitPath(null);
      return;
    }
    setExpandedGitPath((current) =>
      current && git.entries.some((entry) => entry.path === current) ? current : (git.entries[0]?.path ?? null),
    );
  }, [git?.entries]);

  useEffect(() => {
    if (!preview?.path) return;
    setTab("files");
    onLoadGit();
  }, [preview?.path]);

  useEffect(() => {
    if (!preview?.path) return;
    setExpandedDirs((current) => {
      const next = new Set(current);
      for (const dir of ancestorDirs(preview.path)) next.add(dir);
      return next;
    });
  }, [preview?.path]);

  useEffect(() => {
    if (!commitOpen) return;
    commitInputRef.current?.focus();
  }, [commitOpen]);

  const canCommit = Boolean(onGitCommit && git && git.isRepo !== false && git.dirty);
  const canPush = Boolean(git?.remoteUrl);
  const closeCommit = () => {
    setCommitOpen(false);
    setCommitMessage("");
    setCommitMode("commit");
  };
  const submitCommit = () => {
    const message = commitMessage.trim();
    if (!message || !onGitCommit) return;
    onGitCommit(message, commitMode === "push" && canPush);
    closeCommit();
  };

  return (
    <>
    <aside
      className={`material-sidebar flex h-full shrink-0 flex-col border-l border-line ${drawer ? "w-full shadow-dialog" : "w-[360px]"}`}
      aria-label="详情"
    >
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {(["files", "git", "term", "browser", "rules", "skills"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`pressable h-7 shrink-0 whitespace-nowrap rounded-md px-2 text-[12px] ${tab === item ? "bg-fill-strong text-ink" : "hover-fill text-mute"}`}
              onClick={() => {
                setTab(item);
                if (item === "files") {
                  onLoadTree();
                  onLoadGit();
                }
                if (item === "git") {
                  onLoadGit();
                  onGitDiff?.();
                }
                if (item === "skills" || item === "rules") onLoadResources?.();
              }}
            >
              {item === "files"
                ? "文件"
                : item === "git"
                  ? "Git"
                  : item === "term"
                    ? "终端"
                    : item === "browser"
                      ? "浏览器"
                      : item === "rules"
                        ? "约定"
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
      <div className={`min-h-0 flex-1 ${tab === "files" || tab === "term" || tab === "browser" || tab === "rules" ? "flex flex-col overflow-hidden" : "overflow-y-auto p-3"}`}>
        {tab === "files" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {fileTree.length === 0 && !preview ? (
              <p className="p-3 text-sm text-mute">这个文件夹里还没有可预览的文件。</p>
            ) : (
              <>
                <div className="flex h-8 shrink-0 items-center gap-1 border-b border-line px-1.5">
                  {fileTree.length > 0 ? (
                    <button
                      type="button"
                      className="pressable icon-btn"
                      aria-label={treeOpen ? "隐藏文件树" : "显示文件树"}
                      aria-expanded={treeOpen}
                      title={treeOpen ? "隐藏文件树" : "显示文件树"}
                      onClick={() => setTreeOpen((open) => !open)}
                    >
                      {treeOpen ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
                    </button>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                    {preview?.path.replaceAll("\\", "/").split("/").pop() || "文件"}
                  </span>
                  {preview?.truncated ? <span className="shrink-0 pr-1.5 text-[11px] text-mute">已截断</span> : null}
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {preview ? (
                    <FilePreview
                      path={preview.path}
                      content={preview.content}
                      language={preview.language}
                      truncated={preview.truncated}
                      chrome={false}
                    />
                  ) : (
                    <p className="p-3 text-sm text-mute">点右侧文件预览。这里只能看，不能直接编辑。</p>
                  )}
                  {treeOpen && fileTree.length > 0 ? (
                    <aside
                      className="slide-in-right absolute inset-y-0 right-0 z-10 flex w-[168px] flex-col border-l border-line bg-surface"
                      aria-label="文件树"
                    >
                      <div className="min-h-0 flex-1 overflow-auto px-0.5">
                        <FileTree
                          nodes={fileTree}
                          expanded={expandedDirs}
                          selectedPath={preview?.path}
                          gitMarks={gitMarks}
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
                    </aside>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ) : null}
        {tab === "git" ? (
          <div className="flex min-h-0 flex-col gap-3">
            {git == null ? (
              <p className="text-sm text-mute">正在读取 Git 状态…</p>
            ) : git.isRepo !== false ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-ink">
                    未提交
                    {gitTotals.added > 0 || gitTotals.removed > 0 ? (
                      <>
                        <span className="ml-2 font-mono text-[12px] text-success tabular">+{gitTotals.added}</span>
                        <span className="ml-1.5 font-mono text-[12px] text-danger tabular">-{gitTotals.removed}</span>
                      </>
                    ) : (
                      <span className="ml-2 text-mute">{git.dirty ? "有未提交改动" : "工作区干净"}</span>
                    )}
                  </p>
                  {onGitCommit ? (
                    <button
                      type="button"
                      className="pressable btn btn-primary h-7 shrink-0"
                      disabled={!canCommit}
                      onClick={() => setCommitOpen(true)}
                    >
                      提交
                    </button>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-mute">remote</p>
                  <p className="break-all font-mono text-[11px] text-ink">
                    {git.remoteUrl ? git.remoteUrl : "还没有配置 remote"}
                  </p>
                  <p className="pt-1 text-[11px] text-mute">分支</p>
                  <p className="text-sm text-ink">{git.branch ?? "无分支"}</p>
                </div>
                {git.entries.length === 0 ? <p className="text-sm text-mute">没有改动。</p> : null}
                <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
                  {git.entries.map((entry) => {
                    const patch = gitPatchForPath(gitPatches, entry.path);
                    const counts = patch ? patchLineCounts(patch.lines) : { added: 0, removed: 0 };
                    const open = expandedGitPath === entry.path;
                    const isNew = isNewGitEntry(entry.status);
                    return (
                      <li key={entry.path} className="bg-surface">
                        <button
                          type="button"
                          aria-expanded={open}
                          className={`pressable flex min-h-8 w-full items-center gap-2 px-2 py-1.5 text-left ${
                            open ? "bg-fill" : "hover-fill"
                          }`}
                          onClick={() => setExpandedGitPath(open ? null : entry.path)}
                        >
                          <span className="min-w-0 flex-1 break-all text-[12px] leading-4 text-ink">{entry.path}</span>
                          {isNew ? <span className="shrink-0 text-[11px] text-success">新</span> : null}
                          {counts.added > 0 ? (
                            <span className="shrink-0 font-mono text-[11px] text-success tabular">+{counts.added}</span>
                          ) : null}
                          {counts.removed > 0 ? (
                            <span className="shrink-0 font-mono text-[11px] text-danger tabular">-{counts.removed}</span>
                          ) : null}
                        </button>
                        {open ? (
                          <div className="border-t border-line p-1.5">
                            {patch?.binary ? (
                              <p className="px-1 py-2 text-sm text-mute">这是二进制文件，无法预览差异。</p>
                            ) : patch && patch.lines.length > 0 ? (
                              <DiffView review lines={patch.lines} fallback="还没有差异。" />
                            ) : (
                              <p className="px-1 py-2 text-sm text-mute">
                                {isNew ? "未跟踪文件，提交后才会进入 diff。" : "这个文件没有文本 diff。"}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
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
          </div>
        ) : null}
        {tab === "term" ? <InspectorTerminal taskId={taskId} cwd={cwd} /> : null}
        {tab === "browser" ? <InspectorBrowser /> : null}
        {tab === "rules" ? (
          <InspectorRules
            files={resources?.agentsFiles ?? []}
            cwd={cwd}
            onRead={onReadResource ?? (async () => ({ path: "", content: "", truncated: false }))}
            onWrite={onWriteResource ?? (async () => {})}
            onCreate={onCreateAgents}
          />
        ) : null}
        {tab === "skills" ? (
          <InspectorSkills
            skills={resources?.skills ?? []}
            trustProject={Boolean(resources?.trustProject)}
            onToggle={(path, enabled) => onToggleSkill?.(path, enabled)}
            lastExportPath={lastExportPath}
            onExport={onExport}
            onOpenExport={onOpenExport}
            onReload={onReloadResources}
          />
        ) : null}
      </div>
    </aside>
    {commitOpen ? (
      <div className="dialog-scrim z-[60]">
        <button type="button" className="absolute inset-0" aria-label="关闭" onClick={closeCommit} />
        <form
          className="dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="git-commit-title"
          onSubmit={(event) => {
            event.preventDefault();
            submitCommit();
          }}
        >
          <div className="dialog-head">
            <div className="dialog-head-text">
              <h2 id="git-commit-title" className="dialog-title">
                {commitMode === "push" ? "提交并推送" : "提交改动"}
              </h2>
              <p className="dialog-copy">
                {gitTotals.added > 0 || gitTotals.removed > 0 ? (
                  <>
                    <span className="font-mono text-success tabular">+{gitTotals.added}</span>
                    <span className="ml-1.5 font-mono text-danger tabular">-{gitTotals.removed}</span>
                    <span className="ml-2">{git?.entries.length ?? 0} 个文件</span>
                  </>
                ) : (
                  "填写这次改动的说明。"
                )}
              </p>
            </div>
            <button type="button" className="pressable icon-btn -mr-1 -mt-1" aria-label="关闭" onClick={closeCommit}>
              <X size={16} />
            </button>
          </div>
          <div className="dialog-body">
            <div className="mb-3 flex rounded-md bg-fill p-0.5">
              <button
                type="button"
                className={`pressable h-7 flex-1 rounded-[6px] text-[12px] ${commitMode === "commit" ? "bg-surface text-ink" : "text-mute"}`}
                onClick={() => setCommitMode("commit")}
              >
                仅提交
              </button>
              <button
                type="button"
                className={`pressable h-7 flex-1 rounded-[6px] text-[12px] ${commitMode === "push" ? "bg-surface text-ink" : "text-mute"}`}
                disabled={!canPush}
                title={canPush ? undefined : "还没有 remote"}
                onClick={() => canPush && setCommitMode("push")}
              >
                提交并推送
              </button>
            </div>
            <label className="block text-[12px] text-mute" htmlFor="git-commit-message">
              提交说明
            </label>
            <textarea
              ref={commitInputRef}
              id="git-commit-message"
              className="field mt-1.5 w-full text-[13px] text-ink"
              rows={4}
              value={commitMessage}
              placeholder="简述这次改动"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeCommit();
                }
              }}
              onChange={(event) => setCommitMessage(event.target.value)}
            />
          </div>
          <div className="dialog-actions">
            <button type="button" className="pressable btn btn-ghost" onClick={closeCommit}>
              取消
            </button>
            <button type="submit" className="pressable btn btn-primary" disabled={!commitMessage.trim()}>
              {commitMode === "push" ? "提交并推送" : "提交"}
            </button>
          </div>
        </form>
      </div>
    ) : null}
    </>
  );
}
