import { opendir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { PiSessionRef } from "@mowen/protocol";
import { isInsideRoot } from "../security/path-policy.js";

export function piSessionsRoot(homeDir: string): string {
  return path.join(homeDir, ".pi", "agent", "sessions");
}

export function assertPiSessionPath(sessionPath: string, allowedRoots: string[]): string {
  const resolved = path.resolve(sessionPath);
  if (!resolved.endsWith(".jsonl") && !resolved.endsWith(".json")) {
    throw new Error("不是有效的 Pi 会话文件");
  }
  if (!allowedRoots.some((root) => isInsideRoot(resolved, path.resolve(root)))) {
    throw new Error("只能恢复本机允许范围内的 Pi 会话");
  }
  return resolved;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const record = block as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .join("")
    .trim();
}

async function walkJsonl(root: string, files: string[], depth: number): Promise<void> {
  if (depth > 4 || files.length > 200) return;
  try {
    const directory = await opendir(root);
    for await (const child of directory) {
      if (files.length > 200) break;
      const full = path.join(root, child.name);
      if (child.isDirectory()) await walkJsonl(full, files, depth + 1);
      else if (child.name.endsWith(".jsonl")) files.push(full);
    }
  } catch {
    // Missing sessions dir is fine.
  }
}

export async function listPiSessions(homeDir: string, cwd?: string): Promise<PiSessionRef[]> {
  const root = piSessionsRoot(homeDir);
  const files: string[] = [];
  await walkJsonl(root, files, 0);
  const sessions: PiSessionRef[] = [];
  for (const filePath of files) {
    try {
      const raw = await readFile(filePath, "utf8");
      const lines = raw.split("\n").filter(Boolean).slice(0, 40);
      let header: Record<string, unknown> | null = null;
      let name: string | undefined;
      let preview: string | undefined;
      for (const line of lines) {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (parsed.type === "session") header = parsed;
        if (parsed.type === "session_info" && typeof parsed.name === "string") name = parsed.name;
        if (!preview && parsed.type === "message") {
          const message = parsed.message as Record<string, unknown> | undefined;
          if (message?.role === "user") {
            const text = textFromContent(message.content);
            if (text) preview = text.slice(0, 120);
          }
        }
      }
      const sessionCwd = typeof header?.cwd === "string" ? header.cwd : undefined;
      if (cwd && sessionCwd && path.resolve(sessionCwd) !== path.resolve(cwd)) continue;
      const info = await stat(filePath);
      sessions.push({
        path: filePath,
        id: typeof header?.id === "string" ? header.id : undefined,
        cwd: sessionCwd,
        name,
        preview,
        updatedAt: info.mtime.toISOString(),
      });
    } catch {
      // Skip unreadable session files.
    }
  }
  return sessions.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, 80);
}
