const BLOCKED = /^(javascript|data|file|vbscript|blob):/i;

export function normalizeBrowserUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || BLOCKED.test(trimmed)) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${looksLikeLocalHost(trimmed) ? "http" : "https"}://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function looksLikeLocalHost(value: string): boolean {
  const host = hostOfBare(value);
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]") {
    return true;
  }
  if (/^10(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (/^192\.168(?:\.\d{1,3}){2}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/.test(host)) return true;
  return false;
}

function hostOfBare(value: string): string {
  const withoutPath = value.split("/")[0] ?? value;
  if (withoutPath.startsWith("[")) {
    const end = withoutPath.indexOf("]");
    return end === -1 ? withoutPath : withoutPath.slice(0, end + 1);
  }
  return withoutPath.split(":")[0] ?? withoutPath;
}
