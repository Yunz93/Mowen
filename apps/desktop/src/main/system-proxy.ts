import { session } from "electron";
import { normalizeProxyEnv, parsePacProxyResult, readProxyUrl } from "@mowen/server";

/** If the user did not set HTTP(S)_PROXY, copy the OS/Clash system proxy into env. */
export async function adoptSystemProxy(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (readProxyUrl(env)) return normalizeProxyEnv(env);
  try {
    const pac = await session.defaultSession.resolveProxy("https://api.openai.com");
    const proxy = parsePacProxyResult(pac);
    if (!proxy) return null;
    env.HTTPS_PROXY = proxy;
    env.HTTP_PROXY = env.HTTP_PROXY ?? proxy;
    return normalizeProxyEnv(env);
  } catch {
    return null;
  }
}
