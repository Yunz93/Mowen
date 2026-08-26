import { describe, expect, it } from "vitest";
import { authStatusLabel, mergeAuthCatalog } from "../../apps/web/src/lib/settings-auth.ts";
import { OAUTH_PROVIDERS } from "../../apps/server/src/setup/auth-status.ts";

describe("settings auth catalog", () => {
  it("puts GitHub Copilot and OpenAI first and merges oauth with API keys", () => {
    const catalog = mergeAuthCatalog(
      [
        { id: "github", label: "GitHub Copilot" },
        { id: "openai", label: "OpenAI" },
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
      label: "OpenAI",
      hint: "sk-",
      oauth: true,
      apiKey: true,
    });
    expect(catalog.find((item) => item.id === "github")?.oauth).toBe(true);
    expect(catalog.find((item) => item.id === "github")?.apiKey).toBe(false);
  });

  it("labels saved api keys and oauth separately", () => {
    expect(authStatusLabel("oauth")).toBe("订阅 / 登录");
    expect(authStatusLabel("api_key")).toBe("API Key · 已保存");
    expect(authStatusLabel(undefined)).toBe("未连接");
  });

  it("exposes OpenAI as an oauth login provider", () => {
    expect(OAUTH_PROVIDERS.map((item) => item.id)).toEqual(["github", "openai"]);
  });
});
