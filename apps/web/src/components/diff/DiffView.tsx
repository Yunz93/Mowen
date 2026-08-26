import { diffFromApproval, type DiffLine } from "@mowen/protocol";

type Props = {
  oldText?: string;
  newText?: string;
  content?: string;
  lines?: DiffLine[] | null;
  fallback?: string;
};

function lineClass(line: DiffLine): string {
  if (line.type === "add") return "bg-success/15 text-ink";
  if (line.type === "remove") return "bg-danger/15 text-ink";
  if (line.text.startsWith("@@")) return "bg-accent-soft text-accent";
  return "text-mute";
}

export function DiffView({ oldText, newText, content, lines: provided, fallback }: Props) {
  const lines = provided ?? diffFromApproval({ oldText, newText, content });
  if (!lines || lines.length === 0) {
    return <p className="text-sm text-mute">{fallback ?? "还没有差异。"}</p>;
  }
  const visible = lines.length > 200 ? lines.slice(0, 200) : lines;
  return (
    <pre className="overflow-auto rounded-md bg-canvas p-2 font-mono text-[11px] leading-5">
      {visible.map((line, index) => (
        <div key={`${line.type}-${index}`} className={lineClass(line)}>
          {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "} {line.text}
        </div>
      ))}
      {lines.length > 200 ? <div className="text-mute">…还有 {lines.length - 200} 行</div> : null}
    </pre>
  );
}
