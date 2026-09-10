import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCasualChatCwd } from "../../apps/server/src/tasks/casual-chat.ts";

describe("casual chat workspace", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    for (const dir of dirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("creates Qingzhou Chat under home when that root is allowed", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "qingzhou-casual-"));
    dirs.push(home);
    const cwd = await ensureCasualChatCwd(home, [home]);
    expect(cwd).toBe(path.join(await realpath(home), "Qingzhou Chat"));
  });

  it("falls back to the first allowed root", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "qingzhou-casual-home-"));
    const root = await mkdtemp(path.join(os.tmpdir(), "qingzhou-casual-root-"));
    dirs.push(home, root);
    const cwd = await ensureCasualChatCwd(home, [root]);
    expect(cwd).toBe(path.join(await realpath(root), "Qingzhou Chat"));
  });
});
