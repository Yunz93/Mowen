const FENCE_LINE = /^```/;

export function stabilizeMarkdown(text: string): string {
  const fences = text.split("\n").filter((line) => FENCE_LINE.test(line)).length;
  return fences % 2 === 1 ? `${text}\n\`\`\`` : text;
}

export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function shouldOpenMarkdownLink(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href, "http://127.0.0.1");
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
