import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { fetchLatestMowenRelease, isMowenUpdateAvailable, startMowenUpdate } from "../setup/mowen-update.js";

const installSchema = z.object({ version: z.string().min(1).max(32) });

export function registerUpdateRoutes(
  app: FastifyInstance,
  options: { getCurrentVersion: () => string | null; env?: NodeJS.ProcessEnv },
): void {
  app.get("/api/update/latest", async () => {
    const current = options.getCurrentVersion();
    const result = await fetchLatestMowenRelease({ env: options.env });
    return {
      current,
      latest: result.release?.version ?? null,
      tagName: result.release?.tagName ?? null,
      name: result.release?.name ?? null,
      url: result.release?.url ?? null,
      body: result.release?.body ?? "",
      publishedAt: result.release?.publishedAt ?? null,
      assets: result.release?.assets ?? [],
      updateAvailable: isMowenUpdateAvailable(result.release?.version, current),
      canUpdate: options.env?.MOWEN_DESKTOP === "1" && (process.platform === "darwin" || process.platform === "win32"),
      error: result.error,
    };
  });

  app.post("/api/update/install", async (request, reply) => {
    if (options.env?.MOWEN_DESKTOP !== "1") return reply.code(400).send({ error: "开发模式不支持替换当前源码，请使用桌面版更新。" });
    const parsed = installSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "请选择有效的墨问版本。" });
    try {
      return await startMowenUpdate({ version: parsed.data.version, env: options.env });
    } catch (error) {
      const message = error instanceof Error ? error.message : "启动更新失败。";
      return reply.code(400).send({ error: message });
    }
  });
}
