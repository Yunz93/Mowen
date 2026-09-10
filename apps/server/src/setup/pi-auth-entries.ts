import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AuthEntry } from "@qingzhou/protocol";
import { piAuthFile } from "./pi-agent-dir.js";
import { oauthAuthIds } from "./pi-oauth-login.js";
import { resolvePiCodingAgentRoot } from "./pi-package.js";

type PiProviderLike = { id: string; name?: string };
type PiAuthStatusLike = { configured: boolean; source?: string; label?: string };
type PiModelRuntimeLike = {
  getProviders(): readonly PiProviderLike[];
  getProviderAuthStatus(providerId: string): PiAuthStatusLike;
  isUsingOAuth(providerId: string): boolean;
};

const ENV_VAR_NAME = /^[A-Z][A-Z0-9_]*$/;

function entrySource(source: string | undefined): AuthEntry["source"] {
  if (source === "environment") return "env";
  if (source === "models_json_key" || source === "models_json_command") return "models_json";
  if (source === "runtime" || source === "fallback") return "other";
  return "auth_file";
}

/** Map pi's provider auth snapshot to Mowen auth entries without exposing secrets. */
export function mapPiAuthEntries(runtime: PiModelRuntimeLike): AuthEntry[] {
  const entries: AuthEntry[] = [];
  for (const provider of runtime.getProviders()) {
    const status = runtime.getProviderAuthStatus(provider.id);
    if (!status.configured) continue;
    const envVar =
      status.source === "environment" && status.label && ENV_VAR_NAME.test(status.label)
        ? status.label
        : undefined;
    entries.push({
      id: provider.id,
      label: provider.name?.trim() || provider.id,
      kind: runtime.isUsingOAuth(provider.id) ? "oauth" : "api_key",
      source: envVar ? "env" : entrySource(status.source),
      ...(envVar ? { envVar } : {}),
    });
  }
  return entries;
}

/** Append pi-reported providers, skipping ids already known (including oauth aliases). */
export function mergeAuthEntries(entries: AuthEntry[], piEntries: AuthEntry[]): AuthEntry[] {
  const known = new Set<string>();
  for (const entry of entries) {
    known.add(entry.id);
    for (const alias of oauthAuthIds(entry.id)) known.add(alias);
  }
  for (const entry of piEntries) {
    if (known.has(entry.id)) continue;
    entries.push(entry);
    known.add(entry.id);
    for (const alias of oauthAuthIds(entry.id)) known.add(alias);
  }
  return entries;
}

/**
 * Ask pi which providers actually have credentials — auth.json, env vars, and
 * models.json keys all count, which is exactly what pi's model list is built from.
 * Returns [] when pi cannot be resolved or loaded, so setup never breaks on it.
 */
export async function listPiAuthEntries(options: {
  agentDir: string;
  piCommand: string;
  piPrefixArgs: string[];
}): Promise<AuthEntry[]> {
  const piRoot = resolvePiCodingAgentRoot({ piCommand: options.piCommand, prefixArgs: options.piPrefixArgs });
  if (!piRoot) return [];
  const moduleUrl = pathToFileURL(path.join(piRoot, "dist", "core", "model-runtime.js")).href;
  try {
    const { ModelRuntime } = (await import(moduleUrl)) as {
      ModelRuntime: { create(options?: Record<string, unknown>): Promise<PiModelRuntimeLike> };
    };
    const runtime = await ModelRuntime.create({
      authPath: piAuthFile(options.agentDir),
      modelsPath: path.join(options.agentDir, "models.json"),
      allowModelNetwork: false,
    });
    return mapPiAuthEntries(runtime);
  } catch {
    return [];
  }
}
