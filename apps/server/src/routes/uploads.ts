import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { TaskService } from "../tasks/task-service.js";
import { isAllowedOrigin } from "../config.js";
import { SESSION_COOKIE, hasSession } from "../security/session-cookie.js";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

export function registerUploads(
  app: FastifyInstance,
  service: TaskService,
  allowedOrigins: string[],
  bindHost: string,
): void {
  app.post("/uploads", async (request, reply) => {
    if (!isAllowedOrigin(request.headers.origin, allowedOrigins, bindHost)) {
      return reply.code(403).send({ error: "origin denied" });
    }
    if (!hasSession(request.cookies[SESSION_COOKIE])) {
      return reply.code(401).send({ error: "session required" });
    }
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: "No file uploaded" });
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return reply.code(400).send({ error: "Only PNG, JPEG, and WebP are accepted" });
    }
    const buffer = await file.toBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return reply.code(400).send({ error: "File exceeds 10MB" });
    }
    const id = randomUUID();
    if (!service.storeUpload(id, file.mimetype, buffer)) {
      return reply.code(429).send({ error: "Upload memory limit reached; send or retry later" });
    }
    return { id, mimeType: file.mimetype, size: buffer.byteLength };
  });
}
