import hljs from "highlight.js";

type Props = {
  path: string;
  content: string;
  language?: string;
  truncated?: boolean;
  chrome?: boolean;
};

function highlight(content: string, language?: string): string {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(content, { language }).value;
  }
  return hljs.highlightAuto(content).value;
}

export function FilePreview({ path, content, language, truncated, chrome = true }: Props) {
  const name = path.replaceAll("\\", "/").split("/").pop() || path;
  const lineCount = content.length === 0 ? 1 : content.split("\n").length;
  const html = highlight(content, language);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas" aria-label={path}>
      {chrome ? (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-3">
          <span className="min-w-0 truncate text-[12px] text-ink">{name}</span>
          {truncated ? <span className="ml-auto shrink-0 text-[11px] text-mute">已截断</span> : null}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-auto">
        <div
          aria-hidden
          className="sticky left-0 select-none border-r border-line bg-canvas py-2 pl-2 pr-1.5 text-right font-mono text-[11px] leading-5 text-mute tabular"
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>
        <pre
          className="min-w-0 flex-1 whitespace-pre px-2.5 py-2 font-mono text-[12px] leading-5 text-ink"
          dangerouslySetInnerHTML={{ __html: html || " " }}
        />
      </div>
    </div>
  );
}
