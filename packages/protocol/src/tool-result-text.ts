/** CSI / OSC ANSI sequences commonly present in command output. */
const ANSI_RE =
  /\u001B(?:\[[0-9;?]*[ -/]*[@-~]|][^\u0007\u001B]*(?:\u0007|\u001B\\))/g;

const BINARY_PLACEHOLDER = "（输出包含无法显示的二进制内容，已省略）";

/** Sample size for binary heuristics — large enough for ratio, cheap to scan. */
const SAMPLE_CHARS = 8_000;

function isUnsafeControl(code: number): boolean {
  if (code === 0x09 || code === 0x0a || code === 0x0d) return false; // tab / LF / CR
  return code < 0x20 || code === 0x7f;
}

/** True when text is dominated by replacement chars, NULs, or other non-printables. */
export function looksLikeBinaryToolOutput(text: string): boolean {
  if (!text) return false;
  if (text.includes("\0")) return true;
  const sample = text.length > SAMPLE_CHARS ? text.slice(0, SAMPLE_CHARS) : text;
  let bad = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0xfffd || isUnsafeControl(code)) bad += 1;
  }
  const ratio = bad / sample.length;
  return bad >= 24 && ratio >= 0.08;
}

/**
 * Make tool/command stdout safe for the timeline UI:
 * strip ANSI, drop control chars, and replace largely-binary dumps with a clear notice.
 */
export function sanitizeToolResultText(text: string): string {
  if (!text) return "";
  const stripped = text.replace(ANSI_RE, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (looksLikeBinaryToolOutput(stripped)) return BINARY_PLACEHOLDER;
  return stripped.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
