import { describe, expect, it } from "vitest";
import {
  authStatusLabel,
  findAuthEntry,
  logoutNotice,
  mergeAuthCatalog,
  oauthButtonLabel,
  pickDefaultProvider,
  providersForMode,
} from "../../apps/web/src/lib/settings-auth.ts";
import { OAUTH_PROVIDERS } from "../../apps/server/src/setup/auth-status.ts";

describe("settings auth catalog", () => {
  it("puts GitHub Copilot and OpenAI first and merges oauth with API keys", () => {
    const catalog = mergeAuthCatalog(
      [
        { id: "github", label: "GitHub Copilot" },
        { id: "openai", label: "OpenAI (ChatGPT)" },
      ],
      [
        { id: "anthropic", label: "Anthropic (Claude)", hint: "sk-ant" },
        { id: "openai", label: "OpenAI", hint: "sk-" },
        { id: "google", label: "Google Gemini", hint: "Gemini" },
      ],
      [{ id: "groq", label: "Groq" }],
    );
    expect(catalog.map((item) => item.id)).toEqual(["github", "openai", "anthropic", "google", "groq"]);
    expect(catalog.find((item) => item.id === "openai")).toEqual({
      id: "openai",
      label: "OpenAI (ChatGPT)",
      hint: "sk-",
      oauth: true,
      apiKey: true,
    });
    expect(catalog.find((item) => item.id === "github")?.oauth).toBe(true);
    expect(catalog.find((item) => item.id === "github")?.apiKey).toBe(false);
  });

  it("filters providers by auth mode so login and API key stay separate", () => {
    const catalog = mergeAuthCatalog(
      [
        { id: "github", label: "GitHub Copilot" },
        { id: "openai", label: "OpenAI (ChatGPT)" },
      ],
      [
        { id: "anthropic", label: "Anthropic (Claude)", hint: "sk-ant" },
        { id: "openai", label: "OpenAI", hint: "sk-" },
      ],
    );
    expect(providersForMode(catalog, "oauth").map((item) => item.id)).toEqual(["github", "openai"]);
    expect(providersForMode(catalog, "api_key").map((item) => item.id)).toEqual(["openai", "anthropic"]);
    expect(pickDefaultProvider(catalog, "oauth")).toBe("github");
    expect(pickDefaultProvider(catalog, "api_key", "anthropic")).toBe("anthropic");
  });

  it("labels saved api keys and oauth without sounding like buttons", () => {
    expect(authStatusLabel("oauth")).toBe("已登录");
    expect(authStatusLabel("api_key")).toBe("已保存密钥");
    expect(authStatusLabel(undefined, { oauth: true })).toBe("未登录");
    expect(authStatusLabel(undefined, { apiKey: true })).toBe("未配置密钥");
    expect(oauthButtonLabel(undefined)).toBe("订阅登录");
    expect(oauthButtonLabel("oauth")).toBe("重新登录");
    expect(logoutNotice("api_key")).toBe("已移除密钥。");
    expect(logoutNotice("oauth")).toBe("已退出登录。");
  });

  it("exposes OpenAI as an oauth login provider", () => {
    expect(OAUTH_PROVIDERS.map((item) => item.id)).toEqual(["github", "openai"]);
  });

  it("treats openai-codex auth as the OpenAI subscription login", () => {
    const entries = [
      { id: "openai-codex", label: "OpenAI (ChatGPT)", kind: "oauth" as const },
      { id: "openai", label: "OpenAI", kind: "api_key" as const },
    ];
    expect(findAuthEntry(entries, "openai", "oauth")?.id).toBe("openai-codex");
    expect(findAuthEntry(entries, "openai", "api_key")?.id).toBe("openai");
  });
});
