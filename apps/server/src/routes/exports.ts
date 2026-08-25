import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import {
  exportAllowedRoots,
  PathPolicyError,
  resolveReadableExportPath,
} from "../security/path-policy.js";

const querySchema = z.object({
  path: z.string().min(1),
});

export function registerExportRoutes(app: FastifyInstance, getConfig: () => AppConfig): void {
  app.get("/api/exports", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "path required" });
    }
    try {
      const config = getConfig();
      const resolved = await resolveReadableExportPath(parsed.data.path, exportAllowedRoots(config));
      const info = await stat(resolved);
      const filename = path.basename(resolved).replace(/["\r\n]/g, "");
      reply.header("Content-Type", "text/html; charset=utf-8");
      reply.header("Content-Disposition", `inline; filename="${filename}"`);
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("Cache-Control", "no-store");
      reply.header("Content-Length", String(info.size));
      return reply.send(createReadStream(resolved));
    } catch (error) {
      if (error instanceof PathPolicyError) {
        return reply.code(error.status).send({ error: error.message });
      }
      throw error;
    }
  });
}
