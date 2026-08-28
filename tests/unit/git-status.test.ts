import { mkdtemp, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { commitGit, initGit, pushGit, readGitDiff, readGitStatus } from "../../apps/server/src/tasks/git-status.ts";

const execFileAsync = promisify(execFile);

describe("git helpers", () => {
  it("reads status/diff and commits in a temp repo", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-git-"));
    await execFileAsync("git", ["init"], { cwd: root });
    await execFileAsync("git", ["-c", "user.name=T", "-c", "user.email=t@t", "commit", "--allow-empty", "-m", "init"], {
      cwd: root,
    });
    await writeFile(path.join(root, "note.txt"), "hello");
    const status = await readGitStatus(root);
    expect(status.isRepo).toBe(true);
    expect(status.dirty).toBe(true);
    expect(status.entries.some((entry) => entry.path.includes("note.txt"))).toBe(true);
    expect(status.remoteUrl).toBeNull();
    const diffBefore = await readGitDiff(root);
    expect(diffBefore).toBeTypeOf("string");
    await commitGit(root, "add note");
    const after = await readGitStatus(root);
    expect(after.dirty).toBe(false);
    await expect(commitGit(root, "nothing")).rejects.toThrow(/没有可提交的改动|提交失败/);
  });

  it("initializes a non-repo folder and reports remote when configured", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-git-init-"));
    const before = await readGitStatus(root);
    expect(before.isRepo).toBe(false);

    const initialized = await initGit(root);
    expect(initialized.isRepo).toBe(true);
    expect(initialized.remoteUrl).toBeNull();

    await execFileAsync("git", ["remote", "add", "origin", "https://example.com/demo.git"], { cwd: root });
    const withRemote = await readGitStatus(root);
    expect(withRemote.remoteUrl).toBe("https://example.com/demo.git");
  });

  it("push without a remote fails clearly", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-git-push-"));
    await execFileAsync("git", ["init"], { cwd: root });
    await execFileAsync("git", ["-c", "user.name=T", "-c", "user.email=t@t", "commit", "--allow-empty", "-m", "init"], {
      cwd: root,
    });
    await expect(pushGit(root)).rejects.toThrow(/推送失败/);
  });
});
