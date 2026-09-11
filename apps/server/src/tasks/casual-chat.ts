import { mkdir } from "node:fs/promises";
import path from "node:path";
import { assertAllowedCwd, userCwdRoots } from "../security/path-policy.js";

export const CASUAL_CHAT_DIRNAME = "Qingzhou Chat";

export async function ensureCasualChatCwd(homeDir: string, allowedRoots: string[]): Promise<string> {
  const policyRoots = userCwdRoots(homeDir, allowedRoots);
  const homeChat = path.join(homeDir, CASUAL_CHAT_DIRNAME);
  const candidates = [homeChat];
  if (allowedRoots[0]) {
    const fallback = path.join(allowedRoots[0], CASUAL_CHAT_DIRNAME);
    if (path.resolve(fallback) !== path.resolve(homeChat)) candidates.push(fallback);
  }
  let lastError: unknown;
  for (const dir of candidates) {
    try {
      await mkdir(dir, { recursive: true });
      return await assertAllowedCwd(dir, policyRoots);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("没法创建随便聊聊的文件夹。");
}
