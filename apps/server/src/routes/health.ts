import type { FastifyInstance } from "fastify";

export function registerHealth(
  app: FastifyInstance,
  info: {
    piVersion: string | null;
    piError: string | null;
    mutations: string;
  },
): void {
  app.get("/health", async () => ({
    ok: true,
    piVersion: info.piVersion,
    piError: info.piError,
    mutations: info.mutations,
  }));
}
