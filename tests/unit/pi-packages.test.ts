import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addPackageSources,
  ensureMcpServer,
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
    expect(again.installed).toEqual([]);
    expect(again.already).toEqual(["pi-web-access", "context-mode"]);
    const settings = JSON.parse(await readFile(path.join(agentDir, "settings.json"), "utf8")) as {
      packages: string[];
    };
    const mcp = JSON.parse(await readFile(path.join(agentDir, "mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(settings.packages).toEqual(["npm:pi-web-access", "npm:context-mode"]);
    expect(mcp.mcpServers).toHaveProperty("context-mode");
  });
});
