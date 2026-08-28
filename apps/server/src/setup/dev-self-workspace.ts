import path from "node:path";
import { fileURLToPath } from "node:url";
import { isInsideRoot } from "../security/path-policy.js";

/** `apps/server` package root (parent of `src/`). */
export function serverPackageRoot(moduleUrl = import.meta.url): string {
  // This file lives at apps/server/src/setup/*.ts → ../../ = apps/server
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "../..");
}

/**
 * True when the agent workspace contains this running server's source tree.
 * Under `pnpm dev` (tsx watch + Vite), agent edits then restart the process /
 * reload the page and kill in-flight Pi runs.
 */
export function isDevSelfWorkspace(
  workspaceRoot: string | null | undefined,
  options?: { serverRoot?: string; watchEnabled?: boolean },
): boolean {
  const watchEnabled =
    options?.watchEnabled ??
    (process.env.MOWEN_DEV_WATCH === "1" || Boolean(process.env.TSX_WATCH));
  if (!watchEnabled) return false;
  if (!workspaceRoot?.trim()) return false;
  const serverRoot = path.resolve(options?.serverRoot ?? serverPackageRoot());
  const workspace = path.resolve(workspaceRoot);
  // Repo root is parent of apps/server
  const repoRoot = path.resolve(serverRoot, "../..");
  return isInsideRoot(serverRoot, workspace) || isInsideRoot(repoRoot, workspace);
}
