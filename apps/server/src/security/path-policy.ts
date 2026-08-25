import { lstat, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export class PathPolicyError extends Error {
  readonly status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "PathPolicyError";
    this.status = status;
  }
}

export function exportAllowedRoots(input: {
  homeDir: string;
  dataDir: string;
  allowedRoots: string[];
  tmpDir?: string;
}): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const root of [...input.allowedRoots, input.homeDir, input.dataDir, input.tmpDir ?? os.tmpdir()]) {
    const resolved = path.resolve(root);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    unique.push(resolved);
  }
  return unique;
}

export async function resolveReadableExportPath(inputPath: string, roots: string[]): Promise<string> {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new PathPolicyError("Missing export path", 400);
  }
  const absolute = path.resolve(trimmed);
  if (path.extname(absolute).toLowerCase() !== ".html") {
    throw new PathPolicyError("Only HTML exports can be opened", 400);
  }

  let resolved: string;
  try {
    resolved = await realpath(absolute);
  } catch {
    throw new PathPolicyError("Export file not found", 404);
  }

  if (path.extname(resolved).toLowerCase() !== ".html") {
    throw new PathPolicyError("Only HTML exports can be opened", 400);
  }

  const stats = await lstat(resolved);
  if (!stats.isFile()) {
    throw new PathPolicyError("Export path is not a file", 400);
  }

  const realRoots = await Promise.all(
    roots.map(async (root) => {
      try {
        return await realpath(root);
      } catch {
        return path.resolve(root);
      }
    }),
  );
  if (!realRoots.some((root) => isInsideRoot(resolved, root))) {
    throw new PathPolicyError("Export path is outside allowed roots", 403);
  }
  return resolved;
}

export function isInsideRoot(candidate: string, root: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function isProtectedWriteTarget(resolvedPath: string): boolean {
  const parts = resolvedPath.split(path.sep);
  const base = path.basename(resolvedPath);
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (parts.includes(".ssh")) return true;
  if (base === "auth.json" && (parts.includes(".pi") || parts.includes("pi-agent"))) return true;
  return false;
}

export async function resolveAllowedPath(
  inputPath: string,
  cwd: string,
  allowedRoots: string[],
): Promise<string> {
  const absolute = path.isAbsolute(inputPath) ? inputPath : path.join(cwd, inputPath);
  let resolved: string;
  try {
    resolved = await realpath(absolute);
  } catch {
    const parent = await realpath(path.dirname(absolute));
    resolved = path.join(parent, path.basename(absolute));
  }

  const realCwd = await realpath(cwd);
  if (!isInsideRoot(resolved, realCwd)) {
    throw new PathPolicyError(`Path escapes working directory: ${inputPath}`);
  }

  const realRoots = await Promise.all(allowedRoots.map((root) => realpath(root)));
  if (!realRoots.some((root) => isInsideRoot(resolved, root))) {
    throw new PathPolicyError(`Path is outside allowed roots: ${inputPath}`);
  }

  try {
    const stats = await lstat(absolute);
    if (stats.isSymbolicLink()) {
      if (!isInsideRoot(resolved, realCwd)) {
        throw new PathPolicyError(`Symlink escapes working directory: ${inputPath}`);
      }
    }
  } catch {
    // File may not exist yet.
  }

  if (isProtectedWriteTarget(resolved)) {
    throw new PathPolicyError(`Writes to ${path.basename(resolved)} are blocked`);
  }

  return resolved;
}

export async function assertAllowedCwd(cwd: string, allowedRoots: string[]): Promise<string> {
  let resolved: string;
  try {
    resolved = await realpath(cwd);
  } catch {
    throw new PathPolicyError(`Working directory does not exist: ${cwd}`);
  }
  const stats = await lstat(cwd).catch(() => null);
  if (stats?.isSymbolicLink()) {
    const real = await realpath(cwd);
    if (real !== resolved) {
      throw new PathPolicyError(`Working directory symlink is invalid: ${cwd}`);
    }
  }
  const realRoots = await Promise.all(allowedRoots.map((root) => realpath(root)));
  if (!realRoots.some((root) => isInsideRoot(resolved, root))) {
    throw new PathPolicyError("Working directory is outside allowed roots");
  }
  return resolved;
}
