import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { clientCommandSchema } from "@mypi/protocol";
import type { AppConfig } from "../config.js";
import { isAllowedOrigin } from "../config.js";
import { hasSession, readSessionToken } from "../security/session-cookie.js";
import type { TaskService } from "../tasks/task-service.js";

export function registerWebsocket(app: FastifyInstance, config: AppConfig, service: TaskService): void {
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.split("?")[0] !== "/ws") return;
    if (!isAllowedOrigin(request.headers.origin, config.allowedOrigins, config.host)) {
      return reply.code(403).send({ error: "origin denied" });
    }
    const token = readSessionToken(request.headers.cookie);
    if (!hasSession(token)) {
      return reply.code(401).send({ error: "session required" });
    }
  });
  app.get("/ws", { websocket: true }, (socket: WebSocket, request) => {
    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin, config.allowedOrigins, config.host)) {
      socket.close(1008, "origin denied");
      return;
    }
    const token = readSessionToken(request.headers.cookie);
    if (!hasSession(token)) {
      socket.close(1008, "session required");
      return;
    }

    const wrapper = {
      closed: false,
      send: (data: string) => {
        if (socket.readyState === socket.OPEN) socket.send(data);
      },
    };
    service.addSocket(wrapper);
    const snapshot = service.buildSnapshot(null);
    service.emit("", "snapshot", snapshot);
    service.emit("", "connection.status", { status: "connected" });

    let chain = Promise.resolve();
    socket.on("message", (raw) => {
      chain = chain
        .then(async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(raw));
        } catch {
          service.emit("", "request.failed", { requestId: "", error: "Invalid JSON" });
          return;
        }
        const result = clientCommandSchema.safeParse(parsed);
        if (!result.success) {
          const requestId =
            parsed && typeof parsed === "object" && "id" in parsed
              ? String((parsed as { id: unknown }).id)
              : "";
          service.emit("", "request.failed", {
            requestId,
            error: "Invalid WebSocket payload",
          });
          return;
        }
        const command = result.data;
        const taskId = command.taskId ?? "";
        try {
          const data = await service.handleCommand(command);
          service.emit(taskId, "request.succeeded", { requestId: command.id, data });
          if (command.type === "snapshot.request" || command.type === "task.activate" || command.type === "task.create") {
            service.emit(taskId || ((data as { task?: { id: string } }).task?.id ?? ""), "snapshot", service.buildSnapshot(
              command.type === "task.create" ? (data as { task: { id: string } }).task.id : command.taskId ?? null,
            ));
          }
        } catch (error) {
          service.emit(taskId, "request.failed", {
            requestId: command.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        })
        .catch((error) => {
          service.emit("", "server.error", {
            code: "ws",
            message: error instanceof Error ? error.message : String(error),
          });
        });
    });

    socket.on("close", () => {
      wrapper.closed = true;
      service.removeSocket(wrapper);
    });
  });
}
