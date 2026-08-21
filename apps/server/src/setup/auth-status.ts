import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Providers we expose in the beginner setup wizard. */
export const BEGINNER_PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    envVar: "ANTHROPIC_API_KEY",
    hint: "以 sk-ant- 开头",
  },
  {
    id: "openai",
    label: "OpenAI",
    envVar: "OPENAI_API_KEY",
    hint: "以 sk- 开头",
  },
  {
    id: "google",
    label: "Google Gemini",
    envVar: "GEMINI_API_KEY",
    hint: "Gemini API Key",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    hint: "以 sk-or- 开头",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    hint: "DeepSeek API Key",
  },
] as const;

export type BeginnerProviderId = (typeof BEGINNER_PROVIDERS)[number]["id"];

export function piAuthPath(homeDir = os.homedir()): string {
  return path.join(homeDir, ".pi", "agent", "auth.json");
}

type AuthFile = Record<string, { type?: string; key?: string } | undefined>;

async function readAuthFile(homeDir = os.homedir()): Promise<AuthFile> {
  try {
    const raw = await readFile(piAuthPath(homeDir), "utf8");
    const parsed = JSON.parse(raw) as AuthFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function listConfiguredProviders(homeDir = os.homedir()): Promise<string[]> {
  const auth = await readAuthFile(homeDir);
  const fromFile = Object.entries(auth)
    .filter(([, value]) => {
      if (!value || typeof value !== "object") return false;
      if (value.type === "api_key" && typeof value.key === "string" && value.key.length > 0) {
        return true;
      }
      // OAuth / subscription entries also count as configured.
      return Boolean(value.type);
    })
    .map(([id]) => id);

  const fromEnv = BEGINNER_PROVIDERS.filter((provider) => {
    const value = process.env[provider.envVar];
    return Boolean(value && value.trim());
  }).map((provider) => provider.id);

  return [...new Set([...fromFile, ...fromEnv])].sort();
}

export async function hasAnyAuth(homeDir = os.homedir()): Promise<boolean> {
  const configured = await listConfiguredProviders(homeDir);
  return configured.length > 0;
}

export async function saveApiKey(
  providerId: BeginnerProviderId,
  apiKey: string,
  homeDir = os.homedir(),
): Promise<void> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("请填写 API Key");
  }
  if (!BEGINNER_PROVIDERS.some((provider) => provider.id === providerId)) {
    throw new Error("不支持这个服务商");
  }
  const authPath = piAuthPath(homeDir);
  await mkdir(path.dirname(authPath), { recursive: true });
  const auth = await readAuthFile(homeDir);
  auth[providerId] = { type: "api_key", key };
  await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, "utf8");

  // Also set in the current process so newly spawned Pi children see it immediately.
  const provider = BEGINNER_PROVIDERS.find((item) => item.id === providerId);
  if (provider) {
    process.env[provider.envVar] = key;
  }
}
