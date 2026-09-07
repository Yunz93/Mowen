const DRAFTS_KEY = "qingzhou.composer-drafts";
const DRAFT_MAX = 20_000;
const memory = new Map<string, string>();

function storageGet(): string | null {
  if (typeof sessionStorage !== "undefined") return sessionStorage.getItem(DRAFTS_KEY);
  return memory.get(DRAFTS_KEY) ?? null;
}

function storageSet(value: string): void {
  if (typeof sessionStorage !== "undefined") sessionStorage.setItem(DRAFTS_KEY, value);
  else memory.set(DRAFTS_KEY, value);
}

export function readComposerDrafts(): Record<string, string> {
  try {
    const raw = storageGet();
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function readComposerDraft(taskId: string | null | undefined): string {
  if (!taskId) return "";
  return readComposerDrafts()[taskId] ?? "";
}

export function writeComposerDraft(taskId: string | null | undefined, text: string): void {
  if (!taskId) return;
  try {
    const drafts = readComposerDrafts();
    const next = text.slice(0, DRAFT_MAX);
    if (next.trim()) drafts[taskId] = next;
    else delete drafts[taskId];
    storageSet(JSON.stringify(drafts));
  } catch {
    // Quota or private-mode failures should not break the live session.
  }
}
