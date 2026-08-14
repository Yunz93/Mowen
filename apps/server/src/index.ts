import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import websocket from "@fastify/websocket";
import { loadDotEnv } from "./env.js";
import { loadConfig, readPiVersion } from "./config.js";
import { registerHealth } from "./routes/health.js";
import { registerSetupRoutes, buildSetupStatus } from "./routes/setup.js";
import { registerUploads } from "./routes/uploads.js";
import { ensureSessionCookie } from "./security/session-cookie.js";
import { SettingsStore } from "./setup/settings-store.js";
import { TaskStore } from "./tasks/task-store.js";
import { TaskService } from "./tasks/task-service.js";
import { registerWebsocket } from "./websocket/socket-handler.js";

loadDotEnv();

export async function createApp(env: NodeJS.ProcessEnv = process.env) {
  const provisional = loadConfig(env);
  await mkdir(provisional.dataDir, { recursive: true });
  const settings = new SettingsStore(provisional.dataDir);
  await settings.load();

  let config = loadConfig(env, {
    workspaceRoot: settings.get().workspaceRoot,
    homeDir: provisional.homeDir,
  });
  await mkdir(config.dataDir, { recursive: true });

  const { version, error } = await readPiVersion(config);
  console.log(`[mypi] Pi version: ${version ?? "unavailable"}`);
  if (error) {
    console.warn(`[mypi] ${error}`);
  }

  const store = new TaskStore(config.dataDir);
  await store.load();
  const service = new TaskService(config, store, version, error);

  const refreshSetupHints = async () => {
    const setup = await buildSetupStatus(config, settings, { version, error });
    service.setSetupHints({
      authConfigured: setup.authConfigured,
      configuredProviders: setup.configuredProviders,
      needsSetup: setup.needsSetup,
      homeDir: setup.homeDir,
      workspaceRoot: setup.workspaceRoot,
    });
    return setup;
  };
  await refreshSetupHints();

  const app = Fastify({
    logger: {
      level: "info",
      redact: ["req.headers.cookie", "req.headers.authorization", "req.body.apiKey"],
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

  registerSetupRoutes(app, {
    getConfig: () => config,
    setAllowedRoots: (roots) => {
      config = { ...config, allowedRoots: roots };
      service.updateConfig(config);
    },
    settings,
    getPi: () => ({ version, error }),
    onSetupChanged: () => {
      void refreshSetupHints();
    },
  });

  app.get("/api/session", async () => {
    const setup = await refreshSetupHints();
    return {
      ...service.buildSnapshot(null),
      setup,
    };
  });
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

  return { app, config, service, settings };
}

async function main(): Promise<void> {
  const { app, config } = await createApp();
  await app.listen({ host: config.host, port: config.port });
  console.log(`[mypi] listening on http://${config.host}:${config.port}`);
  console.log(`[mypi] open that address in your browser to finish setup if needed`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
