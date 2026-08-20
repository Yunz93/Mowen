import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const execFileAsync = promisify(execFile);

export const mutationsSchema = z.enum(["approval", "disabled"]);

export type AppConfig = {
  host: string;
  port: number;
  piBin: string;
  dataDir: string;
  allowedRoots: string[];
  maxProcesses: number;
  mutations: "approval" | "disabled";
  nodeEnv: string;
  approvalTimeoutMs: number;
  allowedOrigins: string[];
  webDistDir: string;
  approvalExtensionPath: string;
};

export function parseAllowedRoots(value: string | undefined, defaultRoot = process.cwd()): string[] {
  const raw = value ?? defaultRoot;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolvePiBin(bin: string): string {
  if (bin === "pi" || path.isAbsolute(bin)) return bin;
  return path.resolve(bin);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const host = env.HOST ?? "127.0.0.1";
  const port = z.coerce.number().int().min(0).max(65_535).parse(env.PORT ?? "4310");
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

  return {
    host,
    port,
    piBin: resolvePiBin(env.PI_BIN ?? "pi"),
    allowedRoots: parseAllowedRoots(env.MYPI_ALLOWED_ROOTS),
    maxProcesses: z.coerce.number().int().positive().parse(env.MYPI_MAX_PROCESSES ?? "3"),
    mutations: mutationsSchema.parse(env.MYPI_MUTATIONS ?? "approval"),
    nodeEnv,
    approvalTimeoutMs: z.coerce.number().int().positive().parse(
      env.MYPI_APPROVAL_TIMEOUT_MS ?? String(5 * 60 * 1000),
    ),
    allowedOrigins: [...origins],
    webDistDir: env.MYPI_WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url)),
    approvalExtensionPath:
      env.MYPI_APPROVAL_EXTENSION ??
      fileURLToPath(new URL("../extensions/approval.ts", import.meta.url)),
    dataDir: env.MYPI_DATA_DIR ?? path.join(os.homedir(), ".mypi-web"),
  };
}

export async function readPiVersion(piBin: string): Promise<{ version: string | null; error: string | null }> {
  try {
    const { stdout } = await execFileAsync(piBin, ["--version"], { timeout: 5000 });
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
