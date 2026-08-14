import { describe, expect, it } from "vitest";
import { redactSecrets } from "../../apps/server/src/security/redact.ts";

describe("log redaction", () => {
  it("strips api keys and bearer tokens", () => {
    const input = "Authorization: Bearer super-secret-token api_key=abcd1234 sk-ABCDEFGHIJKLMNOP";
    const out = redactSecrets(input);
    expect(out).not.toContain("super-secret-token");
    expect(out).not.toContain("abcd1234");
    expect(out).not.toContain("sk-ABCDEFGHIJKLMNOP");
    expect(out).toContain("[redacted]");
  });
});
