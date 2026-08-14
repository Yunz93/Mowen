import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import websocket from "@fastify/websocket";
import { loadConfig, readPiVersion } from "./config.js";
import { registerHealth } from "./routes/health.js";
import { registerUploads } from "./routes/uploads.js";
import { ensureSessionCookie } from "./security/session-cookie.js";
import { TaskStore } from "./tasks/task-store.js";
import { TaskService } from "./tasks/task-service.js";
import { registerWebsocket } from "./websocket/socket-handler.js";

export async function createApp(env: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(env);
  await mkdir(config.dataDir, { recursive: true });
  const { version, error } = await readPiVersion(config.piBin);
  console.log(`[mypi] Pi version: ${version ?? "unavailable"}`);
  if (error) {
    console.warn(`[mypi] ${error}`);
  }

  const store = new TaskStore(config.dataDir);
  await store.load();
  const service = new TaskService(config, store, version, error);

  const app = Fastify({
    logger: {
      level: "info",
      redact: ["req.headers.cookie", "req.headers.authorization"],
    },
  });

  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(websocket);

  app.addHook("onRequest", async (request, reply) => {
    ensureSessionCookie(request, reply);
  });

  registerHealth(app, {
    piVersion: version,
    piError: error,
    mutations: config.mutations,
  });
  app.get("/api/session", async () => service.buildSnapshot(null));
  registerUploads(app, service, config.allowedOrigins, config.host);
  registerWebsocket(app, config, service);

  if (config.nodeEnv === "production") {
    await app.register(staticFiles, {
      root: config.webDistDir,
      prefix: "/",
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.method === "GET" && !request.url.startsWith("/api") && !request.url.startsWith("/ws")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "Not found" });
    });
  }

  return { app, config, service };
}

async function main(): Promise<void> {
  const { app, config } = await createApp();
  await app.listen({ host: config.host, port: config.port });
  console.log(`[mypi] listening on http://${config.host}:${config.port}`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
