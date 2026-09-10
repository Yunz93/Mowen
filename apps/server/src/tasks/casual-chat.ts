import { mkdir } from "node:fs/promises";
import path from "node:path";
import { assertAllowedCwd } from "../security/path-policy.js";

export const CASUAL_CHAT_DIRNAME = "Qingzhou Chat";

export async function ensureCasualChatCwd(homeDir: string, allowedRoots: string[]): Promise<string> {
  const candidates = [path.join(homeDir, CASUAL_CHAT_DIRNAME)];
  if (allowedRoots[0]) candidates.push(path.join(allowedRoots[0], CASUAL_CHAT_DIRNAME));
  let lastError: unknown;
  for (const dir of candidates) {
    try {
      await mkdir(dir, { recursive: true });
      return await assertAllowedCwd(dir, allowedRoots);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("没法创建随便聊聊的文件夹。");
}
