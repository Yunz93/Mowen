import { diffFromApproval, type DiffLine } from "@mowen/protocol";

type Props = {
  oldText?: string;
  newText?: string;
  content?: string;
  fallback?: string;
};

function lineClass(type: DiffLine["type"]): string {
  if (type === "add") return "bg-success/15 text-ink";
  if (type === "remove") return "bg-danger/15 text-ink";
  return "text-mute";
}

export function DiffView({ oldText, newText, content, fallback }: Props) {
  const lines = diffFromApproval({ oldText, newText, content });
  if (!lines || lines.length === 0) {
    return <p className="text-sm text-mute">{fallback ?? "还没有差异。"}</p>;
  }
  const visible = lines.length > 200 ? lines.slice(0, 200) : lines;
  return (
    <pre className="overflow-auto rounded-md bg-canvas p-2 font-mono text-[11px] leading-5">
      {visible.map((line, index) => (
        <div key={`${line.type}-${index}`} className={lineClass(line.type)}>
          {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "} {line.text}
        </div>
      ))}
      {lines.length > 200 ? <div className="text-mute">…还有 {lines.length - 200} 行</div> : null}
    </pre>
  );
}
