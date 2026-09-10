import { describe, expect, it } from "vitest";
import { mapPiAuthEntries, mergeAuthEntries } from "../../apps/server/src/setup/pi-auth-entries.ts";

function fakeRuntime(statuses: Record<string, { configured: boolean; source?: string; label?: string }>) {
  return {
    getProviders: () =>
      Object.keys(statuses).map((id) => ({ id, name: id === "deepseek" ? "DeepSeek" : undefined })),
    getProviderAuthStatus: (providerId: string) => statuses[providerId]!,
    isUsingOAuth: (providerId: string) => providerId === "openai-codex",
  };
}

describe("pi auth entries", () => {
  it("maps pi provider auth to entries with their source", () => {
    const entries = mapPiAuthEntries(
      fakeRuntime({
        deepseek: { configured: true, source: "environment", label: "DEEPSEEK_API_KEY" },
        "openai-codex": { configured: true, source: "stored" },
        "kimi-coding": { configured: false, source: "environment", label: "KIMI_API_KEY" },
        acme: { configured: true, source: "models_json_key" },
        local: { configured: true, source: "environment", label: "ACME_KEY, OTHER_KEY" },
      }),
    );
    expect(entries).toEqual([
      { id: "deepseek", label: "DeepSeek", kind: "api_key", source: "env", envVar: "DEEPSEEK_API_KEY" },
      { id: "openai-codex", label: "openai-codex", kind: "oauth", source: "auth_file" },
      { id: "acme", label: "acme", kind: "api_key", source: "models_json" },
      { id: "local", label: "local", kind: "api_key", source: "env" },
    ]);
  });

  it("keeps auth.json entries and skips pi aliases of the same login", () => {
    const entries = mergeAuthEntries(
      [{ id: "github", label: "GitHub Copilot", kind: "oauth", source: "auth_file" }],
      [
        { id: "github-copilot", label: "GitHub Copilot", kind: "oauth", source: "auth_file" },
        { id: "kimi-coding", label: "Kimi For Coding", kind: "api_key", source: "env", envVar: "KIMI_API_KEY" },
      ],
    );
    expect(entries.map((entry) => entry.id)).toEqual(["github", "kimi-coding"]);
  });
});
