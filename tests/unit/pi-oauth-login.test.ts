import { describe, expect, it, vi } from "vitest";
import {
  findPiCodingAgentRoot,
  resolvePiAiImportRoots,
  resolvePiCodingAgentRoot,
} from "../../apps/server/src/setup/pi-package.ts";
import {
  oauthAuthIds,
  resolveOAuthLoginId,
  runPiOAuthLogin,
} from "../../apps/server/src/setup/pi-oauth-login.ts";
import { openBrowser } from "../../apps/server/src/setup/open-browser.ts";
import { matchAuthEntry } from "../../apps/server/src/setup/auth-status.ts";
import path from "node:path";
import { existsSync } from "node:fs";

describe("oauth provider mapping", () => {
  it("maps UI ids to Pi auth.json oauth keys", () => {
    expect(resolveOAuthLoginId("openai")).toBe("openai-codex");
    expect(resolveOAuthLoginId("github")).toBe("github-copilot");
    expect(oauthAuthIds("openai")).toEqual(["openai-codex"]);
    expect(oauthAuthIds("github")).toEqual(["github-copilot", "github"]);
  });

  it("matches openai-codex entries for the OpenAI oauth tile", () => {
    const entries = [
      { id: "openai-codex", label: "OpenAI (ChatGPT)", kind: "oauth" as const },
      { id: "openai", label: "OpenAI", kind: "api_key" as const },
    ];
    expect(matchAuthEntry(entries, "openai", "oauth")?.id).toBe("openai-codex");
    expect(matchAuthEntry(entries, "openai", "api_key")?.id).toBe("openai");
  });
});

describe("pi package resolution", () => {
  it("finds pi-coding-agent root from the global pi install when present", () => {
    const root = resolvePiCodingAgentRoot({ piCommand: "pi", prefixArgs: [] });
    if (!root) {
      // CI / machines without a global pi — skip soft.
      expect(root).toBeNull();
      return;
    }
    expect(findPiCodingAgentRoot(root)).toBe(root);
    expect(resolvePiAiImportRoots(root).some((dir) => existsSync(path.join(dir, "package.json")))).toBe(
      true,
    );
  });
});

describe("runPiOAuthLogin fallbacks", () => {
  it("rejects unknown providers without opening a browser", async () => {
    const openUrl = vi.fn();
    const result = await runPiOAuthLogin({
      provider: "not-a-provider",
      piCommand: "pi",
      prefixArgs: [],
      homeDir: "/tmp",
      openUrl,
      timeoutMs: 1000,
    });
    expect(result.started).toBe(false);
    expect(result.completed).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
    expect(result.hint).toMatch(/不支持|API Key|\/login/);
  });
});

describe("openBrowser", () => {
  it("ignores non-http targets", () => {
    expect(() => openBrowser("file:///etc/passwd")).not.toThrow();
    expect(() => openBrowser("not a url")).not.toThrow();
  });
});
