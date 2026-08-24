import { useState } from "react";
import type { SessionStats, ToolExecution } from "@mowen/protocol";
import hljs from "highlight.js";
import { ToolExecutionRow } from "../timeline/ToolExecutionRow";
import { DiffView } from "../diff/DiffView";

type Tab = "changes" | "files" | "activity" | "git";

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
  onReadFile: (path: string) => void;
  onLoadTree: () => void;
  onLoadGit: () => void;
  onRestore: (checkpointId: string) => void;
  onCompact?: () => void;
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
  onReadFile,
  onLoadTree,
  onLoadGit,
  onRestore,
  onCompact,
  drawer,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("activity");
  const changed = tools.filter((tool) => tool.toolName === "write" || tool.toolName === "edit");
  const sortedFiles = [...files].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  return (
    <aside
      className={`flex h-full w-[360px] max-w-full shrink-0 flex-col border-l border-line bg-sidebar ${drawer ? "absolute inset-y-0 right-0 z-30 shadow-dialog" : ""}`}
    >
      <div className="flex h-[52px] items-center gap-1 border-b border-line px-2">
        {(["changes", "files", "git", "activity"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`pressable h-10 rounded-sm px-3 text-sm ${tab === item ? "bg-fill text-ink" : "hover-fill text-mute"}`}
            onClick={() => {
              setTab(item);
              if (item === "files") onLoadTree();
              if (item === "git") onLoadGit();
            }}
          >
            {item === "changes" ? "改动" : item === "files" ? "文件" : item === "git" ? "Git" : "动态"}
          </button>
        ))}
        {drawer ? (
          <button type="button" className="pressable ml-auto h-10 px-3 text-sm text-mute" onClick={onClose}>
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
              <button type="button" className="pressable mb-3 h-10 rounded-sm border border-line bg-elevated px-3 text-sm text-ink" onClick={onCompact}>
                压缩上下文
              </button>
            ) : null}
            {tools.length === 0 ? <p className="text-sm text-mute">还没有操作记录。</p> : null}
            {tools.map((tool) => (
              <ToolExecutionRow key={tool.toolCallId} tool={tool} />
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
                      <span className="min-w-0 font-mono text-[11px] text-mute">
                        {item.path}
                        <span className="block">{new Date(item.createdAt).toLocaleTimeString()}</span>
                      </span>
                      <button
                        type="button"
                        className="pressable h-10 shrink-0 rounded-sm border border-line px-2 text-xs text-ink"
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
                      className="pressable block h-10 w-full truncate px-1 text-left text-ink"
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
                      <span className="w-8 text-mute">{entry.status}</span>
                      <span className="min-w-0 truncate text-ink">{entry.path}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-mute">这里不是 Git 仓库，或读不到状态。</p>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
