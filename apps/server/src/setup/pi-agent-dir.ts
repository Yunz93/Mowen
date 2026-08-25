import { access, chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AppConfig } from "../config.js";

export function defaultPiAgentDir(homeDir = os.homedir()): string {
  return path.join(homeDir, ".pi", "agent");
}

export function fallbackPiAgentDir(dataDir: string): string {
  return path.join(dataDir, "pi-agent");
}

export function piAuthFile(agentDir: string): string {
  return path.join(agentDir, "auth.json");
}

export function isAccessDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "EACCES" || code === "EPERM";
}

export function humanizeAuthAccessError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const denied = isAccessDenied(error) || /EACCES: permission denied/i.test(message);
  if (!denied || !/auth\.json/i.test(message)) return null;
  return [
    "没法读写 Pi 的登录文件（~/.pi/agent/auth.json）。",
    "多半是这个目录属于管理员或别人（例如以前用 sudo 装过 Pi）。",
    "在终端运行：",
    '  sudo chown -R "$(whoami)" ~/.pi',
    "然后重新打开墨问。",
  ].join("\n");
}

export function humanizeUserFacingError(error: unknown): string {
  return humanizeAuthAccessError(error) ?? (error instanceof Error ? error.message : String(error));
}

/** True for missing API keys / login — not filesystem errors on auth.json. */
export function isMissingCredentialError(text: string): boolean {
  if (/EACCES|EPERM|permission denied/i.test(text) && /auth\.json/i.test(text)) return false;
  return /api key|missing key|no credentials|unauthorized|\b401\b|please (?:log\s*in|authenticate)|not logged in/i.test(
    text,
  );
}

export async function tryRepairAgentDir(agentDir: string): Promise<boolean> {
  try {
    await chmod(agentDir, 0o700);
  } catch {
    // Directory may not exist yet, or we are not the owner.
  }
  const authPath = piAuthFile(agentDir);
  try {
    await chmod(authPath, 0o600);
  } catch {
    // File may not exist yet, or we are not the owner.
  }
  return agentDirIsUsable(agentDir, { repair: false });
}

export async function agentDirIsUsable(
  agentDir: string,
  options: { repair?: boolean } = {},
): Promise<boolean> {
  try {
    await mkdir(agentDir, { recursive: true, mode: 0o700 });
  } catch {
    return false;
  }

  const authPath = piAuthFile(agentDir);
  try {
    await access(authPath, constants.R_OK | constants.W_OK);
    return true;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") {
      return canCreateFile(agentDir);
    }
    if (options.repair !== false && isAccessDenied(error)) {
      return tryRepairAgentDir(agentDir);
    }
    return false;
  }
}

async function canCreateFile(dir: string): Promise<boolean> {
  const probe = path.join(dir, `.mowen-write-${process.pid}`);
  try {
    await writeFile(probe, "", { flag: "wx", mode: 0o600 });
    await unlink(probe);
    return true;
  } catch {
    try {
      await unlink(probe);
    } catch {
      // Ignore cleanup failures.
    }
    return false;
  }
}

export async function resolvePiAgentDir(homeDir: string, dataDir: string): Promise<string> {
  const standard = defaultPiAgentDir(homeDir);
  if (await agentDirIsUsable(standard)) return standard;
  const fallback = fallbackPiAgentDir(dataDir);
  await mkdir(fallback, { recursive: true, mode: 0o700 });
  return fallback;
}

export function applyPiAgentDir(config: AppConfig, piAgentDir: string): AppConfig {
  return {
    ...config,
    piAgentDir,
    piExtraEnv: {
      ...config.piExtraEnv,
      PI_CODING_AGENT_DIR: piAgentDir,
    },
  };
}
