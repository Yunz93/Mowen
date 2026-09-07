import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addPackageSources,
  ensureMcpServer,
  formatPiInstallError,
  installPresetPiPackages,
  shouldRunPiCliInstall,
} from "../../apps/server/src/tasks/pi-packages.ts";

describe("preset pi package install", () => {
  it("skips the Pi CLI in tests", () => {
    expect(shouldRunPiCliInstall({ VITEST: "true" })).toBe(false);
    expect(shouldRunPiCliInstall({ QINGZHOU_E2E: "1" })).toBe(false);
    expect(shouldRunPiCliInstall({ QINGZHOU_SKIP_PI_PACKAGE_INSTALL: "1" })).toBe(false);
    expect(shouldRunPiCliInstall({})).toBe(true);
  });

  it("appends missing package sources and leaves existing ones", async () => {
    const agentDir = await mkdtemp(path.join(os.tmpdir(), "qingzhou-pkg-"));
    await mkdir(agentDir, { recursive: true });
    const first = await addPackageSources(agentDir, ["npm:pi-web-access", "pi-memory"]);
    expect(first.added).toEqual(["npm:pi-web-access", "npm:pi-memory"]);
    const second = await addPackageSources(agentDir, ["pi-web-access", "npm:pi-subagents"]);
    expect(second.added).toEqual(["npm:pi-subagents"]);
    expect(second.already).toEqual(["npm:pi-web-access"]);
    const settings = JSON.parse(await readFile(path.join(agentDir, "settings.json"), "utf8")) as {
      packages: string[];
    };
    expect(settings.packages).toEqual(["npm:pi-web-access", "npm:pi-memory", "npm:pi-subagents"]);
  });

  it("creates an MCP server entry once", async () => {
    const agentDir = await mkdtemp(path.join(os.tmpdir(), "qingzhou-mcp-"));
    const created = await ensureMcpServer(agentDir, {
      name: "context-mode",
      command: "npx",
      args: ["-y", "context-mode"],
    });
    const skipped = await ensureMcpServer(agentDir, {
      name: "context-mode",
      command: "context-mode",
    });
    expect(created).toBe(true);
    expect(skipped).toBe(false);
    const mcp = JSON.parse(await readFile(path.join(agentDir, "mcp.json"), "utf8")) as {
      mcpServers: Record<string, { command: string; args?: string[] }>;
    };
    expect(mcp.mcpServers["context-mode"]).toEqual({
      command: "npx",
      args: ["-y", "context-mode"],
    });
  });

  it("installs missing presets into settings without calling the Pi CLI", async () => {
    const agentDir = await mkdtemp(path.join(os.tmpdir(), "qingzhou-preset-"));
    const result = await installPresetPiPackages({
      agentDir,
      ids: ["pi-web-access", "context-mode"],
      packages: [],
      extensions: [],
      piCommand: "pi",
      prefixArgs: [],
      runCli: false,
    });
    expect(result.installed).toEqual(["pi-web-access", "context-mode"]);
    expect(result.addedSources).toEqual(["npm:pi-web-access", "npm:context-mode"]);
    const again = await installPresetPiPackages({
      agentDir,
      ids: ["pi-web-access", "context-mode"],
      packages: result.addedSources.map((source) => ({ source })),
      extensions: [],
      piCommand: "pi",
      prefixArgs: [],
      runCli: false,
    });
    expect(again.installed).toEqual(["pi-web-access", "context-mode"]);
    expect(again.already).toEqual([]);
    const loaded = await installPresetPiPackages({
      agentDir,
      ids: ["pi-web-access", "context-mode"],
      packages: result.addedSources.map((source) => ({ source })),
      extensions: [{ name: "pi-web-access" }, { name: "context-mode" }],
      piCommand: "pi",
      prefixArgs: [],
      runCli: false,
    });
    expect(loaded.installed).toEqual([]);
    expect(loaded.already).toEqual(["pi-web-access", "context-mode"]);
    const settings = JSON.parse(await readFile(path.join(agentDir, "settings.json"), "utf8")) as {
      packages: string[];
    };
    const mcp = JSON.parse(await readFile(path.join(agentDir, "mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(settings.packages).toEqual(["npm:pi-web-access", "npm:context-mode"]);
    expect(mcp.mcpServers).toHaveProperty("context-mode");
  });

  it("turns npm EACCES plus a Pi source dump into a short Chinese error", () => {
    const error = Object.assign(
      new Error("Command failed: pi install npm:pi-web-access"),
      {
        stderr: [
          "npm error code EACCES",
          "npm error path /Users/yunz/.npm/_cacache/index-v5/ab/cd",
          "npm error Your cache folder contains root-owned files",
          'npm error   sudo chown -R 501:20 "/Users/yunz/.npm"',
          "file:///Users/yunz/.npm-global/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/chunks/chunk.js:1",
          "getNpmInstallRoot(){" + "x".repeat(2000),
        ].join("\n"),
      },
    );
    const message = formatPiInstallError(error);
    expect(message).toMatch(/插件下载失败/);
    expect(message).not.toMatch(/已写入 Pi 设置/);
    expect(message).toMatch(/npm 缓存/);
    expect(message).not.toMatch(/getNpmInstallRoot/);
    expect(message.length).toBeLessThan(600);
  });

  it("retries when settings list a package that never loaded, and rolls back a failed CLI", async () => {
    const agentDir = await mkdtemp(path.join(os.tmpdir(), "qingzhou-preset-fail-"));
    await addPackageSources(agentDir, ["npm:pi-web-access"]);
    await ensureMcpServer(agentDir, {
      name: "context-mode",
      command: "npx",
      args: ["-y", "context-mode"],
    });
    const result = await installPresetPiPackages({
      agentDir,
      ids: ["pi-web-access", "context-mode"],
      packages: [{ source: "npm:pi-web-access" }],
      extensions: [],
      piCommand: process.execPath,
      prefixArgs: [
        "-e",
        "process.stderr.write('npm error code EACCES\\nnpm error path /Users/yunz/.npm/_cacache\\n'); process.exit(1);",
      ],
      runCli: true,
    });
    expect(result.already).toEqual([]);
    expect(result.installed).toEqual(["pi-web-access", "context-mode"]);
    expect(result.piInstallError).toMatch(/插件下载失败/);
    expect(result.piInstallError).toMatch(/npm 缓存/);
    const settings = JSON.parse(await readFile(path.join(agentDir, "settings.json"), "utf8")) as {
      packages?: string[];
    };
    const mcp = JSON.parse(await readFile(path.join(agentDir, "mcp.json"), "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    expect(settings.packages ?? []).toEqual([]);
    expect(mcp.mcpServers ?? {}).not.toHaveProperty("context-mode");
  });
});
