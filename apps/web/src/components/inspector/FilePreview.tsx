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
  const html = highlight(content, language);
  const lines = (html || " ").split("\n");

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas" aria-label={path}>
      {chrome ? (
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-3">
          <span className="min-w-0 truncate text-[12px] text-ink">{name}</span>
          {truncated ? <span className="ml-auto shrink-0 text-[11px] text-mute">已截断</span> : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[12px] leading-5 text-ink">
        {lines.map((line, index) => (
          <div key={index} className="flex">
            <span
              aria-hidden
              className="w-8 shrink-0 select-none pr-2 text-right text-[11px] text-mute tabular"
            >
              {index + 1}
            </span>
            <span
              className="min-w-0 flex-1 whitespace-pre-wrap break-words px-1"
              dangerouslySetInnerHTML={{ __html: line || "&nbsp;" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
