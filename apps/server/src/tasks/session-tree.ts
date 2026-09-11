import type { SessionTreeNode } from "@qingzhou/protocol";
import { encodeModelChangeText, modelKeyFromRecord } from "./model-change.js";

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
    provider?: string;
    modelId?: string;
    model?: string;
    message?: { role?: string; content?: unknown };
  };
  children?: PiTreeNode[];
  label?: string;
};

export function flattenSessionTree(tree: unknown, leafId: string | null): SessionTreeNode[] {
  const out: SessionTreeNode[] = [];
  let lastModelKey = "";
  const walk = (node: PiTreeNode): void => {
    const entry = node.entry ?? {};
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id) return;
    const message = (entry.message ?? {}) as Record<string, unknown>;
    const role = String(message.role ?? entry.type ?? "entry");
    let text = textFromContent(message.content) || (typeof node.label === "string" ? node.label : "");
    if (role === "model_change") {
      const nextKey = modelKeyFromRecord({ ...entry, ...message });
      text = encodeModelChangeText(lastModelKey, nextKey);
      if (nextKey) lastModelKey = nextKey;
    }
    out.push({
      id,
      parentId: typeof entry.parentId === "string" ? entry.parentId : null,
      role,
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
