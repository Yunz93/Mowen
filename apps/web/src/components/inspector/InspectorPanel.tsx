import { useState } from "react";
import type { SessionStats, ToolExecution } from "@ohmypi/protocol";
import hljs from "highlight.js";
import { ToolExecutionRow } from "../timeline/ToolExecutionRow";

type Tab = "changes" | "files" | "activity";

type FileEntry = { path: string; name: string; kind: "file" | "dir" };

type Props = {
  tools: ToolExecution[];
  stats: SessionStats | null;
  files: FileEntry[];
  preview: { path: string; content: string; truncated: boolean; language?: string } | null;
  onReadFile: (path: string) => void;
  onLoadTree: () => void;
  onCompact?: () => void;
  drawer?: boolean;
  onClose?: () => void;
};

function changeText(tool: ToolExecution): string {
  const args = tool.args as Record<string, unknown> | undefined;
  if (args && typeof args.oldText === "string" && typeof args.newText === "string") {
    return `- ${args.oldText}\n+ ${args.newText}`;
  }
  if (args && typeof args.content === "string") {
    return args.content;
  }
  return tool.resultText ?? "No diff yet.";
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
  onReadFile,
  onLoadTree,
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
      className={`flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-sidebar ${drawer ? "absolute inset-y-0 right-0 z-30 shadow-2xl" : ""}`}
    >
      <div className="flex h-[52px] items-center gap-1 border-b border-line px-2">
        {(["changes", "files", "activity"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`pressable h-10 rounded-md px-3 text-sm capitalize ${tab === item ? "bg-elevated text-ink" : "text-mute"}`}
            onClick={() => {
              setTab(item);
              if (item === "files") onLoadTree();
            }}
          >
            {item}
          </button>
        ))}
        {drawer ? (
          <button type="button" className="pressable ml-auto h-10 px-3 text-sm text-mute" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "activity" ? (
          <div className="space-y-2">
            {stats ? (
              <p className="mb-3 font-mono text-[11px] text-mute tabular">
                tokens {stats.tokens?.total ?? "—"} · cost {stats.cost?.toFixed?.(4) ?? "—"}
              </p>
            ) : null}
            {onCompact ? (
              <button type="button" className="pressable mb-3 h-10 rounded-md bg-elevated px-3 text-sm text-ink" onClick={onCompact}>
                Compact session
              </button>
            ) : null}
            {tools.length === 0 ? <p className="text-sm text-mute">No tool activity yet.</p> : null}
            {tools.map((tool) => (
              <ToolExecutionRow key={tool.toolCallId} tool={tool} />
            ))}
          </div>
        ) : null}
        {tab === "changes" ? (
          <div className="space-y-3">
            {changed.length === 0 ? <p className="text-sm text-mute">No file mutations in this session.</p> : null}
            {changed.map((tool) => (
              <div key={tool.toolCallId}>
                <p className="font-mono text-xs text-accent">{tool.target}</p>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-md bg-canvas p-2 font-mono text-[11px] text-mute">
                  {changeText(tool)}
                </pre>
              </div>
            ))}
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
              <p className="text-sm text-mute">Select a file to preview. Editor is read-only.</p>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
