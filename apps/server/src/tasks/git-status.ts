import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitEntry = { path: string; status: string };

export type GitSnapshot = {
  branch: string | null;
  dirty: boolean;
  entries: GitEntry[];
};

export async function readGitStatus(cwd: string): Promise<GitSnapshot | null> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "-b"], {
      cwd,
      timeout: 4000,
    });
    const lines = stdout.split("\n").filter(Boolean);
    const header = lines[0] ?? "";
    const branchMatch = header.match(/## ([^\s.]+)/);
    const entries = lines.slice(1).map((line) => ({
      status: line.slice(0, 2).trim() || line.slice(0, 2),
      path: line.slice(3),
    }));
    return {
      branch: branchMatch?.[1] ?? null,
      dirty: entries.length > 0,
      entries: entries.slice(0, 200),
    };
  } catch {
    return null;
  }
}
