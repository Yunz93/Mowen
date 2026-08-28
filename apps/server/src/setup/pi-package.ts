import { existsSync, readFileSync } from "node:fs";
import { realpathSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { isJavaScriptFile } from "../config.js";

function packageName(dir: string): string | null {
  try {
    const raw = readFileSync(path.join(dir, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === "string" ? parsed.name : null;
  } catch {
    return null;
  }
}

/** Walk up from a file/dir until `@earendil-works/pi-coding-agent` package root. */
export function findPiCodingAgentRoot(start: string): string | null {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (packageName(dir) === "@earendil-works/pi-coding-agent") return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function whichPi(): string | null {
  try {
    const out = execFileSync(process.platform === "win32" ? "where" : "which", ["pi"], {
      encoding: "utf8",
      timeout: 2000,
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Locate the installed pi-coding-agent package from the same runtime Mowen uses
 * to spawn Pi (bundled entry, PI_BIN, or `pi` on PATH).
 */
export function resolvePiCodingAgentRoot(options: {
  piCommand: string;
  prefixArgs: string[];
}): string | null {
  const candidates: string[] = [];
  for (const arg of options.prefixArgs) {
    if (arg && (isJavaScriptFile(arg) || arg.includes("pi-coding-agent"))) {
      candidates.push(arg);
    }
  }
  if (isJavaScriptFile(options.piCommand)) {
    candidates.push(options.piCommand);
  }
  const which = whichPi();
  if (which) candidates.push(which);

  for (const candidate of candidates) {
    try {
      const resolved = realpathSync(candidate);
      const root = findPiCodingAgentRoot(path.dirname(resolved));
      if (root) return root;
    } catch {
      // keep looking
    }
  }
  return null;
}

export function resolvePiAiImportRoots(piRoot: string): string[] {
  return [
    path.join(piRoot, "node_modules", "@earendil-works", "pi-ai"),
    path.join(piRoot, "pi-ai"),
    path.join(path.dirname(piRoot), "pi-ai"),
  ].filter((dir) => existsSync(path.join(dir, "package.json")));
}

export function piAiModuleUrl(piAiRoot: string, subpath = "dist/index.js"): string {
  return pathToFileURL(path.join(piAiRoot, subpath)).href;
}
