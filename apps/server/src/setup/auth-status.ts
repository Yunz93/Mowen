import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { AuthEntry } from "@mowen/protocol";
import {
  defaultPiAgentDir,
  humanizeUserFacingError,
  isAccessDenied,
  piAuthFile,
  tryRepairAgentDir,
} from "./pi-agent-dir.js";

const execFileAsync = promisify(execFile);

export const OAUTH_PROVIDERS = [{ id: "github", label: "GitHub Copilot" }] as const;

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

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  google: "Google Gemini",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  github: "GitHub Copilot",
  "github-copilot": "GitHub Copilot",
  copilot: "GitHub Copilot",
  groq: "Groq",
  xai: "xAI",
  mistral: "Mistral",
  grok: "xAI",
  kimi: "Kimi",
  minimax: "MiniMax",
};

export type BeginnerProviderId = (typeof BEGINNER_PROVIDERS)[number]["id"];

export function piAuthPath(homeDir = os.homedir(), agentDir = defaultPiAgentDir(homeDir)): string {
  return piAuthFile(agentDir);
}

export function piModelsPath(homeDir = os.homedir(), agentDir = defaultPiAgentDir(homeDir)): string {
  return path.join(agentDir, "models.json");
}

type AuthFile = Record<string, { type?: string; key?: string } | undefined>;

async function readAuthFile(homeDir = os.homedir(), agentDir = defaultPiAgentDir(homeDir)): Promise<AuthFile> {
  try {
    const raw = await readFile(piAuthPath(homeDir, agentDir), "utf8");
    const parsed = JSON.parse(raw) as AuthFile;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function authKind(type: string | undefined): AuthEntry["kind"] {
  if (type === "api_key") return "api_key";
  if (type && /oauth|subscription|login|token/i.test(type)) return "oauth";
  return type ? "other" : "other";
}

export async function listAuthEntries(
  homeDir = os.homedir(),
  agentDir = defaultPiAgentDir(homeDir),
): Promise<AuthEntry[]> {
  const auth = await readAuthFile(homeDir, agentDir);
  const fromFile: AuthEntry[] = Object.entries(auth)
    .filter(([, value]) => {
      if (!value || typeof value !== "object") return false;
      if (value.type === "api_key" && typeof value.key === "string" && value.key.length > 0) {
        return true;
      }
      return Boolean(value.type);
    })
    .map(([id, value]) => ({
      id,
      label: PROVIDER_LABELS[id] ?? id,
      kind: authKind(value?.type),
    }));

  const fromEnv = BEGINNER_PROVIDERS.filter((provider) => {
    const value = process.env[provider.envVar];
    return Boolean(value && value.trim()) && !fromFile.some((entry) => entry.id === provider.id);
  }).map((provider) => ({
    id: provider.id,
    label: provider.label,
    kind: "api_key" as const,
  }));

  return [...fromFile, ...fromEnv].sort((a, b) => a.id.localeCompare(b.id));
}

export async function listConfiguredProviders(
  homeDir = os.homedir(),
  agentDir = defaultPiAgentDir(homeDir),
): Promise<string[]> {
  const entries = await listAuthEntries(homeDir, agentDir);
  return entries.map((entry) => entry.id);
}

export async function inspectModelsFile(
  homeDir = os.homedir(),
  agentDir = defaultPiAgentDir(homeDir),
): Promise<{ present: boolean; count: number }> {
  try {
    const raw = await readFile(piModelsPath(homeDir, agentDir), "utf8");
    const parsed = JSON.parse(raw) as { models?: unknown[]; providers?: unknown } | unknown[];
    if (Array.isArray(parsed)) return { present: true, count: parsed.length };
    if (parsed && typeof parsed === "object") {
      const models = (parsed as { models?: unknown[] }).models;
      if (Array.isArray(models)) return { present: true, count: models.length };
      return { present: true, count: Object.keys(parsed).length };
    }
    return { present: true, count: 0 };
  } catch {
    return { present: false, count: 0 };
  }
}

export async function hasAnyAuth(
  homeDir = os.homedir(),
  agentDir = defaultPiAgentDir(homeDir),
): Promise<boolean> {
  const configured = await listConfiguredProviders(homeDir, agentDir);
  return configured.length > 0;
}

export async function saveApiKey(
  providerId: BeginnerProviderId,
  apiKey: string,
  homeDir = os.homedir(),
  agentDir = defaultPiAgentDir(homeDir),
): Promise<void> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("请填写 API Key");
  }
  if (!BEGINNER_PROVIDERS.some((provider) => provider.id === providerId)) {
    throw new Error("不支持这个服务商");
  }
  const authPath = piAuthPath(homeDir, agentDir);
  const persist = async () => {
    await mkdir(agentDir, { recursive: true, mode: 0o700 });
    const auth = await readAuthFile(homeDir, agentDir);
    auth[providerId] = { type: "api_key", key };
    await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  };
  try {
    await persist();
  } catch (error) {
    if (!isAccessDenied(error) && !/auth\.json/i.test(error instanceof Error ? error.message : String(error))) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    if (await tryRepairAgentDir(agentDir)) {
      try {
        await persist();
      } catch (retry) {
        throw new Error(humanizeUserFacingError(retry));
      }
    } else {
      throw new Error(humanizeUserFacingError(error));
    }
  }

  // Also set in the current process so newly spawned Pi children see it immediately.
  const provider = BEGINNER_PROVIDERS.find((item) => item.id === providerId);
  if (provider) {
    process.env[provider.envVar] = key;
  }
}

export async function removeAuth(
  providerId: string,
  homeDir = os.homedir(),
  agentDir = defaultPiAgentDir(homeDir),
): Promise<void> {
  const id = providerId.trim();
  if (!id) throw new Error("请选择要退出的登录");
  const authPath = piAuthPath(homeDir, agentDir);
  const persist = async () => {
    const auth = await readAuthFile(homeDir, agentDir);
    if (!(id in auth)) {
      throw new Error("没有这条登录");
    }
    delete auth[id];
    await mkdir(agentDir, { recursive: true, mode: 0o700 });
    await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  };
  try {
    await persist();
  } catch (error) {
    if (error instanceof Error && error.message === "没有这条登录") throw error;
    if (!isAccessDenied(error) && !/auth\.json/i.test(error instanceof Error ? error.message : String(error))) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    if (await tryRepairAgentDir(agentDir)) {
      try {
        await persist();
      } catch (retry) {
        throw new Error(humanizeUserFacingError(retry));
      }
    } else {
      throw new Error(humanizeUserFacingError(error));
    }
  }

  const beginner = BEGINNER_PROVIDERS.find((item) => item.id === id);
  if (beginner) {
    delete process.env[beginner.envVar];
  }
}

export async function tryPiLogin(options: {
  piCommand: string;
  prefixArgs: string[];
  extraEnv?: NodeJS.ProcessEnv;
  provider: string;
  homeDir: string;
}): Promise<{ started: boolean; hint: string }> {
  const label = PROVIDER_LABELS[options.provider] ?? options.provider;
  const hint = `在终端运行 pi，然后输入 /login 登录 ${label}。完成后点「刷新登录状态」。墨问不会代填登录令牌。`;
  if (!options.piCommand.trim()) {
    return { started: false, hint };
  }
  try {
    await execFileAsync(options.piCommand, [...options.prefixArgs, "login", options.provider], {
      timeout: 1200,
      env: { ...process.env, ...options.extraEnv, HOME: options.homeDir },
    });
    return { started: true, hint: `如果浏览器已打开，完成 ${label} 登录后点「刷新登录状态」。` };
  } catch {
    return { started: false, hint };
  }
}
