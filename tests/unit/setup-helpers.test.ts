import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listConfiguredProviders, saveApiKey } from "../../apps/server/src/setup/auth-status.ts";
import { SettingsStore } from "../../apps/server/src/setup/settings-store.ts";
import { listFolders } from "../../apps/server/src/setup/folder-browser.ts";

describe("setup helpers", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    for (const dir of dirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writes api keys into a pi auth.json under a fake home", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "mypi-auth-"));
    dirs.push(home);
    await saveApiKey("anthropic", "sk-ant-test-key-123456", home);
    const raw = await readFile(path.join(home, ".pi", "agent", "auth.json"), "utf8");
    const json = JSON.parse(raw) as { anthropic: { type: string; key: string } };
    expect(json.anthropic).toEqual({ type: "api_key", key: "sk-ant-test-key-123456" });
    const providers = await listConfiguredProviders(home);
    expect(providers).toContain("anthropic");
  });

  it("persists workspace settings", async () => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), "mypi-settings-"));
    dirs.push(dataDir);
    const store = new SettingsStore(dataDir);
    await store.save({ workspaceRoot: "/tmp/work", setupCompletedAt: "2026-01-01T00:00:00.000Z" });
    const again = new SettingsStore(dataDir);
    await again.load();
    expect(again.get().workspaceRoot).toBe("/tmp/work");
    expect(again.get().setupCompletedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("lists only child folders inside browse roots", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mypi-folders-"));
    dirs.push(root);
    await mkdir(path.join(root, "docs"));
    await mkdir(path.join(root, "node_modules"));
    const result = await listFolders(root, [root]);
    expect(result.entries.map((entry) => entry.name)).toEqual(["docs"]);
  });
});
