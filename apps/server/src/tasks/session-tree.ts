import type { SessionTreeNode } from "@mowen/protocol";

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const record = block as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .join("")
    .trim();
}

type PiTreeNode = {
  entry?: {
    id?: string;
    parentId?: string | null;
    type?: string;
    message?: { role?: string; content?: unknown };
  };
  children?: PiTreeNode[];
  label?: string;
};

export function flattenSessionTree(tree: unknown, leafId: string | null): SessionTreeNode[] {
  const out: SessionTreeNode[] = [];
  const walk = (node: PiTreeNode): void => {
    const entry = node.entry ?? {};
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id) return;
    const message = entry.message ?? {};
    const text = textFromContent(message.content) || (typeof node.label === "string" ? node.label : "");
    out.push({
      id,
      parentId: typeof entry.parentId === "string" ? entry.parentId : null,
      role: String(message.role ?? entry.type ?? "entry"),
      text: text.slice(0, 200),
      leaf: leafId != null && id === leafId,
    });
    for (const child of node.children ?? []) walk(child);
  };
  if (!Array.isArray(tree)) return out;
  for (const node of tree) {
    if (node && typeof node === "object") walk(node as PiTreeNode);
  }
  return out;
}
