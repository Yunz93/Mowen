const MENTION_RE = /(^|[\s])@([^\s@]+)/g;

export function extractAtMentions(message: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(MENTION_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(message))) {
    const token = match[2]?.trim();
    if (!token || token === "." || token === "..") continue;
    if (seen.has(token)) continue;
    seen.add(token);
    found.push(token);
  }
  return found;
}
