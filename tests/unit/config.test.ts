import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultAllowedRoots,
  defaultDataDir,
  expandHome,
  loadConfig,
  parseAllowedRoots,
  resolvePiRuntime,
} from "../../apps/server/src/config.ts";
import { loadDotEnv } from "../../apps/server/src/env.ts";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";

describe("portable config", () => {
  it("defaults data dir and roots to the home directory", () => {
    const home = path.resolve(os.tmpdir(), "ohmypi-home-test");
    expect(defaultDataDir(home)).toBe(path.join(home, ".ohmypi"));
    expect(defaultAllowedRoots(home)).toEqual([home]);
    const config = loadConfig({}, { homeDir: home });
    expect(config.dataDir).toBe(path.join(home, ".ohmypi"));
    expect(config.allowedRoots).toEqual([home]);
  });

  it("keeps using a legacy ~/.mypi-web data dir when it already exists", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "ohmypi-legacy-"));
    const legacy = path.join(home, ".mypi-web");
    await mkdir(legacy);
    expect(defaultDataDir(home)).toBe(legacy);
    const config = loadConfig({}, { homeDir: home });
    expect(config.dataDir).toBe(legacy);
    await rm(home, { recursive: true, force: true });
  });

  it("expands ~ in paths", () => {
    const home = os.homedir();
    expect(expandHome("~", home)).toBe(home);
    expect(expandHome("~/Projects", home)).toBe(path.join(home, "Projects"));
  });

  it("uses explicit roots when provided", () => {
    expect(parseAllowedRoots("/a,/b")).toEqual(["/a", "/b"]);
  });

  it("loads .env without overriding existing env", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ohmypi-env-"));
    const file = path.join(dir, ".env");
    await writeFile(file, "OHMYPI_TEST_UNIQUE=from-file\nHOST=should-not-win\n");
    process.env.HOST = "already-set";
    delete process.env.OHMYPI_TEST_UNIQUE;
    loadDotEnv(file);
    expect(process.env.OHMYPI_TEST_UNIQUE).toBe("from-file");
    expect(process.env.HOST).toBe("already-set");
    delete process.env.OHMYPI_TEST_UNIQUE;
    await rm(dir, { recursive: true, force: true });
  });

  it("launches bundled Pi via node entry", () => {
    const entry = path.resolve(os.tmpdir(), "pi-cli.js");
    const runtime = resolvePiRuntime({
      OHMYPI_PI_ENTRY: entry,
      OHMYPI_NODE_BIN: process.execPath,
    });
    expect(runtime.command).toBe(process.execPath);
    expect(runtime.prefixArgs[0]).toBe(entry);
  });

  it("launches a JavaScript PI_BIN via the current node executable", () => {
    const script = path.resolve(os.tmpdir(), "fake-pi.mjs");
    const runtime = resolvePiRuntime({ PI_BIN: script });
    expect(runtime.command).toBe(process.execPath);
    expect(runtime.prefixArgs).toEqual([script]);
  });
});
