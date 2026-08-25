import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveApiKey } from "../../apps/server/src/setup/auth-status.ts";
import {
  humanizeAuthAccessError,
  isMissingCredentialError,
  resolvePiAgentDir,
} from "../../apps/server/src/setup/pi-agent-dir.ts";

describe("Pi agent dir and auth errors", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    for (const dir of dirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("humanizes EACCES on auth.json and does not treat it as a missing API key", () => {
    const error = Object.assign(new Error("EACCES: permission denied, open '/Users/yunz/.pi/agent/auth.json'"), {
      code: "EACCES",
    });
    const message = humanizeAuthAccessError(error);
    expect(message).toMatch(/登录文件/);
    expect(message).toMatch(/chown/);
    expect(isMissingCredentialError(error.message)).toBe(false);
    expect(isMissingCredentialError("Invalid API key")).toBe(true);
  });

  it("keeps ~/.pi/agent when it is writable", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "mowen-agent-ok-"));
    const data = await mkdtemp(path.join(os.tmpdir(), "mowen-data-ok-"));
    dirs.push(home, data);
    const resolved = await resolvePiAgentDir(home, data);
    expect(resolved).toBe(path.join(home, ".pi", "agent"));
  });

  it("falls back when ~/.pi/agent cannot be used as a directory", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "mowen-agent-bad-"));
    const data = await mkdtemp(path.join(os.tmpdir(), "mowen-data-bad-"));
    dirs.push(home, data);
    await mkdir(path.join(home, ".pi"), { recursive: true });
    await writeFile(path.join(home, ".pi", "agent"), "not a directory");
    const resolved = await resolvePiAgentDir(home, data);
    expect(resolved).toBe(path.join(data, "pi-agent"));
  });

  it("repairs an owner-locked auth.json then writes the key", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "mowen-auth-fix-"));
    dirs.push(home);
    const agentDir = path.join(home, ".pi", "agent");
    const authPath = path.join(agentDir, "auth.json");
    await mkdir(agentDir, { recursive: true });
    await writeFile(authPath, "{}\n", { mode: 0o600 });
    await chmod(authPath, 0);
    await saveApiKey("anthropic", "sk-ant-repaired-key-123456", home, agentDir);
    const info = await stat(authPath);
    expect(info.mode & 0o777).toBe(0o600);
    const raw = await (await import("node:fs/promises")).readFile(authPath, "utf8");
    expect(raw).toContain("sk-ant-repaired-key-123456");
  });
});
