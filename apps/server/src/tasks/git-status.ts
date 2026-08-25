import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 8000;

const gitIdentity = ["-c", "user.name=Mowen", "-c", "user.email=mowen@local"];

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
      timeout: GIT_TIMEOUT_MS,
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

export async function readGitDiff(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["diff", "HEAD"], {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 2_000_000,
    });
    return stdout;
  } catch {
    return null;
  }
}

export async function commitGit(cwd: string, message: string): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("请填写提交说明");
  try {
    await execFileAsync("git", ["add", "-A"], { cwd, timeout: GIT_TIMEOUT_MS });
  } catch {
    throw new Error("git add 失败。确认这是一个 Git 仓库。");
  }
  try {
    await execFileAsync("git", [...gitIdentity, "commit", "-m", trimmed], {
      cwd,
      timeout: GIT_TIMEOUT_MS,
    });
  } catch (error) {
    const detail = [
      error instanceof Error ? error.message : String(error),
      error && typeof error === "object" && "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "") : "",
    ].join("\n");
    if (/nothing to commit|no changes added/i.test(detail)) {
      throw new Error("没有可提交的改动");
    }
    throw new Error("提交失败。确认这是一个 Git 仓库，并且有可提交的改动。");
  }
}
