import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

export const DEFAULT_MOWEN_REPO = "Yunz93/Mowen";
const GITHUB_TIMEOUT_MS = 8_000;

export type MowenRelease = {
  tagName: string;
  version: string;
  name: string;
  url: string;
  body: string;
  publishedAt: string | null;
  prerelease: boolean;
  assets: Array<{ name: string; url: string; size: number }>;
};

export function mowenRepo(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.MOWEN_REPO?.trim() || DEFAULT_MOWEN_REPO;
  if (!/^[\w.-]+\/[\w.-]+$/.test(value)) throw new Error("墨问更新仓库配置无效。");
  return value;
}

export function parseMowenRelease(raw: unknown): MowenRelease {
  if (!raw || typeof raw !== "object") throw new Error("无法解析墨问 Release。");
  const item = raw as Record<string, unknown>;
  const tagName = typeof item.tag_name === "string" ? item.tag_name.trim() : "";
  const version = normalizeVersion(tagName);
  if (!tagName || !version) throw new Error("墨问 Release 没有有效版本号。");
  const assets = Array.isArray(item.assets)
    ? item.assets.flatMap((asset) => {
        if (!asset || typeof asset !== "object") return [];
        const entry = asset as Record<string, unknown>;
        return typeof entry.name === "string" && typeof entry.browser_download_url === "string"
          ? [{ name: entry.name, url: entry.browser_download_url, size: typeof entry.size === "number" ? entry.size : 0 }]
          : [];
      })
    : [];
  return {
    tagName,
    version,
    name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : tagName,
    url: typeof item.html_url === "string" ? item.html_url : `https://github.com/${mowenRepo()}/releases/tag/${tagName}`,
    body: typeof item.body === "string" ? item.body : "",
    publishedAt: typeof item.published_at === "string" ? item.published_at : null,
    prerelease: item.prerelease === true,
    assets,
  };
}

export function normalizeVersion(value: string | null | undefined): string | null {
  const match = value?.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : null;
}

export function isMowenUpdateAvailable(latest: string | null | undefined, current: string | null | undefined): boolean {
  const next = normalizeVersion(latest);
  const have = normalizeVersion(current);
  if (!next) return false;
  if (!have) return true;
  const a = next.split(".").map(Number);
  const b = have.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index]! > b[index]!) return true;
    if (a[index]! < b[index]!) return false;
  }
  return false;
}

export async function fetchLatestMowenRelease(options: {
  env?: NodeJS.ProcessEnv;
  fetchJson?: (url: string) => Promise<unknown>;
} = {}): Promise<{ release: MowenRelease | null; error: string | null }> {
  try {
    const repo = mowenRepo(options.env);
    const fetchJson = options.fetchJson ?? fetchGithubJson;
    const raw = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
    return { release: parseMowenRelease(raw), error: null };
  } catch (error) {
    return { release: null, error: error instanceof Error ? error.message : "无法检查墨问更新。" };
  }
}

export async function startMowenUpdate(options: {
  version: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  fetchText?: (url: string) => Promise<string>;
}): Promise<{ ok: true; version: string; platform: string }> {
  const env = options.env ?? process.env;
  const version = normalizeVersion(options.version);
  if (!version) throw new Error("更新版本号无效。");
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin" && platform !== "win32") throw new Error("当前平台暂不支持应用内更新。");
  const repo = mowenRepo(env);
  const tag = `v${version}`;
  const extension = platform === "darwin" ? "install-macos.sh" : "install-windows.ps1";
  const scriptUrl = `https://github.com/${repo}/releases/download/${tag}/${extension}`;
  const fetchText = options.fetchText ?? fetchTextDocument;
  const script = await fetchText(scriptUrl);
  const dir = await mkdtemp(path.join(tmpdir(), "mowen-update-"));
  const scriptPath = path.join(dir, extension);
  await writeFile(scriptPath, script, "utf8");
  if (platform === "darwin") await chmod(scriptPath, 0o700);
  const command = platform === "darwin" ? "/bin/bash" : "powershell.exe";
  const args = platform === "darwin"
    ? [scriptPath, "--version", tag, "--user", "--no-open"]
    : ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-Repo", repo, "-Version", tag];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    env: { ...env, MOWEN_REPO: repo, MOWEN_VERSION: tag, MOWEN_UPDATE_PARENT_PID: String(process.pid) },
  });
  child.unref();
  return { ok: true, version: tag, platform };
}

async function fetchGithubJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    headers: { "user-agent": "mowen-update-check", accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub 返回 HTTP ${response.status}`);
  return response.json();
}

async function fetchTextDocument(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS), headers: { "user-agent": "mowen-updater" } });
  if (!response.ok) throw new Error(`无法下载更新脚本（HTTP ${response.status}）。`);
  return response.text();
}
