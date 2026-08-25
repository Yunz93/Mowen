import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { defaultPiAgentDir } from "./setup/pi-agent-dir.js";

const execFileAsync = promisify(execFile);

export const mutationsSchema = z.enum(["approval", "disabled"]);

export type PiRuntime = {
  command: string;
  prefixArgs: string[];
  extraEnv: NodeJS.ProcessEnv;
};

export type AppConfig = {
  host: string;
  port: number;
  piBin: string;
  piCommand: string;
  piPrefixArgs: string[];
  piExtraEnv: NodeJS.ProcessEnv;
  dataDir: string;
  allowedRoots: string[];
  maxProcesses: number;
  mutations: "approval" | "disabled";
  nodeEnv: string;
  approvalTimeoutMs: number;
  allowedOrigins: string[];
  webDistDir: string;
  approvalExtensionPath: string;
  homeDir: string;
  piBundled: boolean;
  piAgentDir: string;
  trustProject: boolean;
};

export function mowenEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const current = env[`MOWEN_${name}`];
  if (current != null && current !== "") return current;
  const legacy = env[`OHMYPI_${name}`];
  if (legacy != null && legacy !== "") return legacy;
  return current ?? legacy;
}

export function defaultDataDir(homeDir = os.homedir()): string {
  const current = path.join(homeDir, ".mowen");
  const ohmypi = path.join(homeDir, ".ohmypi");
  const legacy = path.join(homeDir, ".mypi-web");
  if (existsSync(current)) return current;
  if (existsSync(ohmypi)) return ohmypi;
  if (existsSync(legacy)) return legacy;
  return current;
}

export function defaultAllowedRoots(homeDir = os.homedir()): string[] {
  return [homeDir];
}

export function parseAllowedRoots(
  value: string | undefined,
  fallback: string[] = defaultAllowedRoots(),
): string[] {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolvePiBin(bin: string): string {
  if (bin === "pi" || path.isAbsolute(bin)) return bin;
  return path.resolve(bin);
}

export function isJavaScriptFile(file: string): boolean {
  return /\.[cm]?js$/i.test(file);
}

/**
 * Desktop builds set MOWEN_PI_ENTRY to Pi's CLI file and run it with Electron's
 * Node (`ELECTRON_RUN_AS_NODE=1`). Browser/dev installs keep using `pi` on PATH.
 * A `PI_BIN` that points at a .js/.mjs/.cjs file is launched with the current
 * Node executable so Windows can run it (shebang spawn is Unix-only).
 */
export function resolvePiRuntime(env: NodeJS.ProcessEnv = process.env): PiRuntime {
  const entry = mowenEnv(env, "PI_ENTRY")?.trim();
  if (entry) {
    const command = mowenEnv(env, "NODE_BIN")?.trim() || process.execPath;
    const extraEnv: NodeJS.ProcessEnv = {};
    if (process.versions.electron || command === process.execPath) {
      extraEnv.ELECTRON_RUN_AS_NODE = "1";
    }
    return { command, prefixArgs: [path.resolve(entry)], extraEnv };
  }
  const bin = resolvePiBin(env.PI_BIN ?? "pi");
  if (isJavaScriptFile(bin)) {
    return { command: process.execPath, prefixArgs: [bin], extraEnv: {} };
  }
  return {
    command: bin,
    prefixArgs: [],
    extraEnv: {},
  };
}

export function expandHome(input: string, homeDir = os.homedir()): string {
  if (input === "~") return homeDir;
  if (input.startsWith("~/")) return path.join(homeDir, input.slice(2));
  return input;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { workspaceRoot?: string | null; homeDir?: string; trustProject?: boolean } = {},
): AppConfig {
  const homeDir = path.resolve(expandHome(options.homeDir ?? mowenEnv(env, "HOME_DIR") ?? os.homedir()));
  const host = env.HOST ?? "127.0.0.1";
  const port = Number(env.PORT ?? "4310");
  const nodeEnv = env.NODE_ENV ?? "development";
  const origins = new Set([
    `http://${host}:${port}`,
    "http://127.0.0.1:4310",
    "http://localhost:4310",
  ]);
  if (nodeEnv !== "production") {
    origins.add("http://127.0.0.1:5173");
    origins.add("http://localhost:5173");
  }

  const allowedRootsValue = mowenEnv(env, "ALLOWED_ROOTS");
  const envRoots = parseAllowedRoots(
    allowedRootsValue,
    options.workspaceRoot
      ? [expandHome(options.workspaceRoot, homeDir)]
      : defaultAllowedRoots(homeDir),
  ).map((root) => path.resolve(expandHome(root, homeDir)));

  // Prefer an explicit workspace from settings when env did not override roots.
  if (!allowedRootsValue?.trim() && options.workspaceRoot) {
    const workspace = path.resolve(expandHome(options.workspaceRoot, homeDir));
    if (!envRoots.includes(workspace)) {
      envRoots.unshift(workspace);
    }
  }

  const pi = resolvePiRuntime(env);

  return {
    host,
    port,
    piBin: entryDisplay(env, pi),
    piCommand: pi.command,
    piPrefixArgs: pi.prefixArgs,
    piExtraEnv: pi.extraEnv,
    dataDir: path.resolve(expandHome(mowenEnv(env, "DATA_DIR") ?? defaultDataDir(homeDir), homeDir)),
    allowedRoots: envRoots,
    maxProcesses: Number(mowenEnv(env, "MAX_PROCESSES") ?? "3"),
    mutations: mutationsSchema.parse(mowenEnv(env, "MUTATIONS") ?? "approval"),
    nodeEnv,
    approvalTimeoutMs: Number(mowenEnv(env, "APPROVAL_TIMEOUT_MS") ?? String(5 * 60 * 1000)),
    allowedOrigins: [...origins],
    webDistDir: mowenEnv(env, "WEB_DIST") ?? fileURLToPath(new URL("../../web/dist", import.meta.url)),
    approvalExtensionPath:
      mowenEnv(env, "APPROVAL_EXTENSION") ??
      fileURLToPath(new URL("../extensions/approval.ts", import.meta.url)),
    homeDir,
    piBundled: mowenEnv(env, "PI_BUNDLED") === "1" || Boolean(mowenEnv(env, "PI_ENTRY")?.trim()),
    piAgentDir: defaultPiAgentDir(homeDir),
    trustProject: options.trustProject === true,
  };
}

function entryDisplay(env: NodeJS.ProcessEnv, pi: PiRuntime): string {
  return mowenEnv(env, "PI_ENTRY")?.trim() || pi.command;
}

export async function readPiVersion(
  runtime: Pick<AppConfig, "piCommand" | "piPrefixArgs" | "piExtraEnv"> | string,
): Promise<{ version: string | null; error: string | null }> {
  const command = typeof runtime === "string" ? runtime : runtime.piCommand;
  const prefixArgs = typeof runtime === "string" ? [] : runtime.piPrefixArgs;
  const extraEnv = typeof runtime === "string" ? {} : runtime.piExtraEnv;
  try {
    const { stdout } = await execFileAsync(command, [...prefixArgs, "--version"], {
      timeout: 8000,
      env: { ...process.env, ...extraEnv },
    });
    const version = stdout.trim().split("\n")[0] ?? "";
    return { version: version || null, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT/i.test(message)) {
      return { version: null, error: "还没有安装 Pi，或找不到可执行文件。" };
    }
    return { version: null, error: `无法读取 Pi 版本：${message}` };
  }
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[], bindHost = "127.0.0.1"): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (bindHost !== "127.0.0.1" && bindHost !== "localhost") return false;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}
