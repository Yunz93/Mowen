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
import { mkdtemp, writeFile, rm } from "node:fs/promises";

describe("portable config", () => {
  it("defaults data dir and roots to the home directory", () => {
    const home = "/tmp/mypi-home-test";
    expect(defaultDataDir(home)).toBe(path.join(home, ".mypi-web"));
    expect(defaultAllowedRoots(home)).toEqual([home]);
    const config = loadConfig({}, { homeDir: home });
    expect(config.dataDir).toBe(path.join(home, ".mypi-web"));
    expect(config.allowedRoots).toEqual([home]);
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
    const dir = await mkdtemp(path.join(os.tmpdir(), "mypi-env-"));
    const file = path.join(dir, ".env");
    await writeFile(file, "MYPI_TEST_UNIQUE=from-file\nHOST=should-not-win\n");
    process.env.HOST = "already-set";
    delete process.env.MYPI_TEST_UNIQUE;
    loadDotEnv(file);
    expect(process.env.MYPI_TEST_UNIQUE).toBe("from-file");
    expect(process.env.HOST).toBe("already-set");
    delete process.env.MYPI_TEST_UNIQUE;
    await rm(dir, { recursive: true, force: true });
  });

  it("launches bundled Pi via node entry", () => {
    const runtime = resolvePiRuntime({
      MYPI_PI_ENTRY: "/tmp/pi-cli.js",
      MYPI_NODE_BIN: "/usr/bin/node",
    });
    expect(runtime.command).toBe("/usr/bin/node");
    expect(runtime.prefixArgs[0]).toBe(path.resolve("/tmp/pi-cli.js"));
  });
});
