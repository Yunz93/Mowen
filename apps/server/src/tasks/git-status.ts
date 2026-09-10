import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 8000;

export function gitStatusPaths(raw: string): string[] {
  const stripped = raw.trim().replace(/^"(.*)"$/s, "$1").replace(/\\"/g, '"');
  if (stripped.includes(" -> ")) {
    return stripped.split(" -> ").map((part) => part.trim().replace(/^"(.*)"$/s, "$1")).filter(Boolean);
  }
  return stripped ? [stripped] : [];
}

export function assertGitRelativePath(input: string): string {
  const normalized = input.trim().replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new Error("无效的文件路径。");
  }
  const parts = normalized.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("无效的文件路径。");
  }
  return normalized;
}

const gitIdentity = ["-c", "user.name=Qingzhou", "-c", "user.email=qingzhou@local"];

export type GitEntry = { path: string; status: string };

export type GitSnapshot = {
  isRepo: boolean;
  branch: string | null;
  dirty: boolean;
  entries: GitEntry[];
  remoteUrl: string | null;
};

const emptySnapshot = (): GitSnapshot => ({
  isRepo: false,
  branch: null,
  dirty: false,
  entries: [],
  remoteUrl: null,
});

async function readRemoteUrl(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd,
      timeout: GIT_TIMEOUT_MS,
    });
    const url = stdout.trim();
    return url || null;
  } catch {
    try {
      const { stdout } = await execFileAsync("git", ["remote", "-v"], {
        cwd,
        timeout: GIT_TIMEOUT_MS,
      });
      const line = stdout
        .split("\n")
        .map((item) => item.trim())
        .find((item) => item.length > 0);
      if (!line) return null;
      const parts = line.split(/\s+/);
      return parts[1] ?? null;
    } catch {
      return null;
    }
  }
}

export async function readGitStatus(cwd: string): Promise<GitSnapshot> {
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
    const remoteUrl = await readRemoteUrl(cwd);
    return {
      isRepo: true,
      branch: branchMatch?.[1] ?? null,
      dirty: entries.length > 0,
      entries: entries.slice(0, 200),
      remoteUrl,
    };
  } catch {
    return emptySnapshot();
  }
}

export async function initGit(cwd: string): Promise<GitSnapshot> {
  try {
    await execFileAsync("git", ["init"], { cwd, timeout: GIT_TIMEOUT_MS });
  } catch {
    throw new Error("git init 失败。确认当前文件夹可写，并且已安装 Git。");
  }
  const status = await readGitStatus(cwd);
  if (!status.isRepo) throw new Error("git init 失败。确认当前文件夹可写，并且已安装 Git。");
  return status;
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

export async function restoreGit(cwd: string, target?: string): Promise<void> {
  const status = await readGitStatus(cwd);
  if (!status.isRepo) throw new Error("不是 Git 仓库。");
  if (!status.dirty) throw new Error("没有可撤销的改动。");

  if (!target) {
    try {
      await execFileAsync("git", ["restore", "--source=HEAD", "--staged", "--worktree", "--", "."], {
        cwd,
        timeout: GIT_TIMEOUT_MS,
      });
    } catch {
      // Empty repo / only untracked files: HEAD restore can fail.
    }
    await execFileAsync("git", ["clean", "-fd"], { cwd, timeout: GIT_TIMEOUT_MS });
    return;
  }

  const wanted = assertGitRelativePath(target);
  const entry = status.entries.find((item) => item.path === target || gitStatusPaths(item.path).includes(wanted));
  if (!entry) throw new Error("找不到这个文件的改动。");
  const paths = gitStatusPaths(entry.path);
  const untracked = entry.status.includes("?");

  if (untracked) {
    await execFileAsync("git", ["clean", "-fd", "--", ...paths], { cwd, timeout: GIT_TIMEOUT_MS });
    return;
  }

  try {
    await execFileAsync("git", ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...paths], {
      cwd,
      timeout: GIT_TIMEOUT_MS,
    });
  } catch {
    await execFileAsync("git", ["restore", "--staged", "--", ...paths], { cwd, timeout: GIT_TIMEOUT_MS }).catch(
      () => undefined,
    );
    await execFileAsync("git", ["clean", "-fd", "--", ...paths], { cwd, timeout: GIT_TIMEOUT_MS });
  }
}

const GIT_PUSH_TIMEOUT_MS = 60_000;

export async function pushGit(cwd: string): Promise<void> {
  try {
    await execFileAsync("git", ["push", "-u", "origin", "HEAD"], {
      cwd,
      timeout: GIT_PUSH_TIMEOUT_MS,
    });
  } catch (error) {
    const detail = [
      error instanceof Error ? error.message : String(error),
      error && typeof error === "object" && "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "") : "",
    ].join("\n");
    if (/no upstream|has no upstream|does not appear to be a git repository/i.test(detail)) {
      throw new Error("推送失败。当前分支还没有 remote。");
    }
    if (/Could not read from remote|Authentication|could not find remote|Permission denied/i.test(detail)) {
      throw new Error("推送失败。检查 remote 和登录。");
    }
    throw new Error("推送失败。");
  }
}
