import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { z } from "zod";

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
};

export function defaultDataDir(homeDir = os.homedir()): string {
  return path.join(homeDir, ".mypi-web");
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

/**
 * Desktop builds set MYPI_PI_ENTRY to Pi's CLI file and run it with Electron's
 * Node (`ELECTRON_RUN_AS_NODE=1`). Browser/dev installs keep using `pi` on PATH.
 */
export function resolvePiRuntime(env: NodeJS.ProcessEnv = process.env): PiRuntime {
  const entry = env.MYPI_PI_ENTRY?.trim();
  if (entry) {
    const command = env.MYPI_NODE_BIN?.trim() || process.execPath;
    const extraEnv: NodeJS.ProcessEnv = {};
    if (process.versions.electron || command === process.execPath) {
      extraEnv.ELECTRON_RUN_AS_NODE = "1";
    }
    return { command, prefixArgs: [path.resolve(entry)], extraEnv };
  }
  return {
    command: resolvePiBin(env.PI_BIN ?? "pi"),
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
  options: { workspaceRoot?: string | null; homeDir?: string } = {},
): AppConfig {
  const homeDir = options.homeDir ?? os.homedir();
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

  const envRoots = parseAllowedRoots(
    env.MYPI_ALLOWED_ROOTS,
    options.workspaceRoot
      ? [expandHome(options.workspaceRoot, homeDir)]
      : defaultAllowedRoots(homeDir),
  ).map((root) => path.resolve(expandHome(root, homeDir)));

  // Prefer an explicit workspace from settings when env did not override roots.
  if (!env.MYPI_ALLOWED_ROOTS?.trim() && options.workspaceRoot) {
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
    dataDir: path.resolve(expandHome(env.MYPI_DATA_DIR ?? defaultDataDir(homeDir), homeDir)),
    allowedRoots: envRoots,
    maxProcesses: Number(env.MYPI_MAX_PROCESSES ?? "3"),
    mutations: mutationsSchema.parse(env.MYPI_MUTATIONS ?? "approval"),
    nodeEnv,
    approvalTimeoutMs: Number(env.MYPI_APPROVAL_TIMEOUT_MS ?? String(5 * 60 * 1000)),
    allowedOrigins: [...origins],
    webDistDir: env.MYPI_WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url)),
    approvalExtensionPath:
      env.MYPI_APPROVAL_EXTENSION ??
      fileURLToPath(new URL("../extensions/approval.ts", import.meta.url)),
    homeDir,
    piBundled: env.MYPI_PI_BUNDLED === "1" || Boolean(env.MYPI_PI_ENTRY?.trim()),
  };
}

function entryDisplay(env: NodeJS.ProcessEnv, pi: PiRuntime): string {
  return env.MYPI_PI_ENTRY?.trim() || pi.command;
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
      return { version: null, error: "Pi is not installed or PI_BIN is not executable." };
    }
    return { version: null, error: `Could not read Pi version: ${message}` };
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
