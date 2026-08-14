const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bBearer\s+[A-Za-z0-9._\-+=/]+/gi,
  /\b(api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi,
  /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, "[redacted]");
  }
  return out;
}
