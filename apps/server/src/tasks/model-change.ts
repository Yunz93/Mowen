import type { ModelRef, SessionTreeNode, TimelineMessage } from "@qingzhou/protocol";

export const MODEL_CHANGE_NOTICE_PREFIX = "model-change:";
const MODEL_CHANGE_SEP = " -> ";

export function modelDisplayName(
  model: { name?: string | null; id?: string; provider?: string } | null | undefined,
): string {
  if (!model) return "";
  if (typeof model.name === "string" && model.name.trim()) return model.name.trim();
  if (typeof model.id === "string" && model.id.trim()) return model.id.trim();
  return "";
}

export function resolveModelLabel(
  ref: string,
  models: Array<Pick<ModelRef, "provider" | "id" | "name">> = [],
): string {
  const trimmed = ref.trim();
  if (!trimmed) return "";
  const found = models.find(
    (model) =>
      `${model.provider}/${model.id}` === trimmed ||
      model.id === trimmed ||
      model.name === trimmed,
  );
  if (found) return modelDisplayName(found);
  if (trimmed.includes("/")) {
    const id = trimmed.slice(trimmed.indexOf("/") + 1);
    const byId = models.find((model) => model.id === id);
    if (byId) return modelDisplayName(byId);
    return id || trimmed;
  }
  return trimmed;
}

export function formatModelChangeText(from: string, to: string): string {
  const previous = from.trim();
  const next = to.trim();
  if (!next || previous === next) return "";
  if (previous) return `模型已从 ${previous} 更改为 ${next}。`;
  return `模型已切换为 ${next}。`;
}

export function isModelChangeNotice(message: Pick<TimelineMessage, "id" | "role">): boolean {
  return message.role === "system" && message.id.startsWith(MODEL_CHANGE_NOTICE_PREFIX);
}

export function modelChangeNoticeId(key: string): string {
  return `${MODEL_CHANGE_NOTICE_PREFIX}${key}`;
}

export function createModelChangeNotice(
  key: string,
  from: string,
  to: string,
  createdAt = new Date().toISOString(),
): TimelineMessage | null {
  const text = formatModelChangeText(from, to);
  if (!text) return null;
  return {
    id: modelChangeNoticeId(key),
    role: "system",
    text,
    createdAt,
    streaming: false,
  };
}

export function encodeModelChangeText(fromKey: string, toKey: string): string {
  const from = fromKey.trim();
  const to = toKey.trim();
  if (from && to) return `${from}${MODEL_CHANGE_SEP}${to}`;
  return to;
}

export function parseModelChangeText(text: string): { from: string; to: string } {
  const idx = text.indexOf(MODEL_CHANGE_SEP);
  if (idx === -1) return { from: "", to: text.trim() };
  return { from: text.slice(0, idx).trim(), to: text.slice(idx + MODEL_CHANGE_SEP.length).trim() };
}

export function modelKeyFromRecord(record: Record<string, unknown>): string {
  if (typeof record.model === "string" && record.model.trim()) return record.model.trim();
  const provider = typeof record.provider === "string" ? record.provider.trim() : "";
  const modelId =
    (typeof record.modelId === "string" && record.modelId.trim()) ||
    (typeof record.id === "string" && record.id.trim()) ||
    "";
  if (provider && modelId) return `${provider}/${modelId}`;
  return modelId || provider;
}

export function previousModelKeyFromRecord(record: Record<string, unknown>): string {
  if (typeof record.previousModel === "string" && record.previousModel.trim()) {
    return record.previousModel.trim();
  }
  if (typeof record.from === "string" && record.from.trim()) return record.from.trim();
  return "";
}

export function noticesFromSessionTree(
  tree: SessionTreeNode[],
  models: Array<Pick<ModelRef, "provider" | "id" | "name">> = [],
): Array<{ afterChatCount: number; notice: TimelineMessage }> {
  const out: Array<{ afterChatCount: number; notice: TimelineMessage }> = [];
  let chatCount = 0;
  for (const node of tree) {
    if (node.role === "user" || node.role === "assistant" || node.role === "toolResult") {
      chatCount += 1;
      continue;
    }
    if (node.role !== "model_change") continue;
    const parsed = parseModelChangeText(node.text);
    const from = resolveModelLabel(parsed.from, models);
    const to = resolveModelLabel(parsed.to, models);
    const notice = createModelChangeNotice(node.id || `${chatCount}:${to}`, from, to);
    if (notice) out.push({ afterChatCount: chatCount, notice });
  }
  return out;
}

export function mergeModelChangeNotices(
  messages: TimelineMessage[],
  tree: SessionTreeNode[],
  models: Array<Pick<ModelRef, "provider" | "id" | "name">> = [],
): TimelineMessage[] {
  const banners = noticesFromSessionTree(tree, models);
  if (banners.length === 0) return messages;
  const base = messages.filter((message) => !isModelChangeNotice(message));
  const out: TimelineMessage[] = [];
  let bannerIndex = 0;
  for (let index = 0; index <= base.length; index += 1) {
    while (bannerIndex < banners.length && banners[bannerIndex]?.afterChatCount === index) {
      const notice = banners[bannerIndex]?.notice;
      if (notice) out.push(notice);
      bannerIndex += 1;
    }
    if (index < base.length) {
      const message = base[index];
      if (message) out.push(message);
    }
  }
  return out;
}
