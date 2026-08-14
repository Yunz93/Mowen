import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../../apps/server/src/index.ts";

const fakePi = fileURLToPath(new URL("../fixtures/fake-pi.mjs", import.meta.url));

type EventMsg = {
  type: string;
  taskId?: string;
  payload?: {
    error?: string;
    requestId?: string;
    data?: { task?: { id: string } };
    approval?: { requestId: string };
    tool?: { status?: string; isError?: boolean };
    task?: { id: string };
    status?: string;
    messages?: Array<{ text: string }>;
  };
};

async function listen(env: NodeJS.ProcessEnv) {
  const { app, config, service } = await createApp(env);
  await app.listen({ host: config.host, port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return { app, service, config, base: `http://${config.host}:${address.port}` };
}

async function openSocket(base: string) {
  const health = await fetch(`${base}/health`);
  const cookie = health.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("missing session cookie");
  const ws = new WebSocket(base.replace("http", "ws") + "/ws", {
    headers: { Origin: base, Cookie: cookie },
  });
  const events: EventMsg[] = [];
  ws.on("message", (data) => {
    events.push(JSON.parse(String(data)));
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  let cursor = 0;
  const waitFor = async (type: string, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const match = events.slice(cursor).find((event) => event.type === type);
      if (match) {
        cursor = events.indexOf(match) + 1;
        return match;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`Timed out waiting for ${type}`);
  };
  const send = (body: object) => ws.send(JSON.stringify(body));
  const waitForRequest = async (id: string, timeout = 8000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const match = events.find(
        (event) =>
          (event.type === "request.succeeded" || event.type === "request.failed") &&
          event.payload?.requestId === id,
      );
      if (match) return match;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`Timed out waiting for request ${id}`);
  };
  return { ws, events, waitFor, waitForRequest, send, cookie };
}

describe("integration fake-pi", () => {
  const root = { current: "" };
  let ctx: Awaited<ReturnType<typeof listen>>;

  beforeAll(async () => {
    root.current = await mkdtemp(path.join(os.tmpdir(), "mypi-int-"));
    const project = path.join(root.current, "project");
    await mkdir(project);
    await writeFile(path.join(project, "README.md"), "hello");
    ctx = await listen({
      HOST: "127.0.0.1",
      PORT: "0",
      NODE_ENV: "test",
      PI_BIN: fakePi,
      MYPI_DATA_DIR: path.join(root.current, "data"),
      MYPI_ALLOWED_ROOTS: root.current,
      MYPI_MAX_PROCESSES: "3",
      MYPI_MUTATIONS: "approval",
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("streams prompt output, approvals, queue, crash, abort, and restore", async () => {
    const project = path.join(root.current, "project");
    const sock = await openSocket(ctx.base);
    await sock.waitFor("snapshot");

    sock.send({ id: "bad", type: "not-a-command", payload: {} });
    const failed = await sock.waitFor("request.failed");
    expect(failed.payload?.error).toMatch(/Invalid WebSocket payload/);

    sock.send({
      id: "c1",
      type: "task.create",
      payload: { cwd: project, title: "Stream" },
    });
    const created = await sock.waitFor("request.succeeded");
    const taskId = created?.payload?.data?.task?.id as string;

    sock.send({ id: "p1", type: "prompt.send", taskId, payload: { message: "hello world" } });
    await sock.waitFor("message.delta");
    sock.send({ id: "s1", type: "prompt.steer", taskId, payload: { message: "turn left" } });
    await sock.waitFor("request.succeeded");
    await new Promise((r) => setTimeout(r, 800));

    sock.send({ id: "w1", type: "prompt.send", taskId, payload: { message: "WRITE:secret.txt:nope" } });
    const approval = await sock.waitFor("approval.requested");
    sock.send({
      id: "deny1",
      type: "approval.respond",
      taskId,
      payload: { requestId: approval.payload?.approval?.requestId ?? "", allow: false },
    });
    await sock.waitFor("tool.completed");
    await new Promise((r) => setTimeout(r, 300));
    await expect(import("node:fs/promises").then((fs) => fs.access(path.join(project, "secret.txt")))).rejects.toThrow();

    sock.send({ id: "b1", type: "prompt.send", taskId, payload: { message: "BASH:echo hi" } });
    const bashApproval = await sock.waitFor("approval.requested");
    sock.send({
      id: "deny2",
      type: "approval.respond",
      taskId,
      payload: { requestId: bashApproval.payload?.approval?.requestId ?? "", allow: false },
    });
    const blocked = await sock.waitFor("tool.completed");
    expect(blocked.payload?.tool?.status === "blocked" || blocked.payload?.tool?.isError).toBeTruthy();
    await new Promise((r) => setTimeout(r, 400));

    sock.ws.close();
    const sock2 = await openSocket(ctx.base);
    await sock2.waitFor("snapshot");
    sock2.send({ id: "act-old", type: "task.activate", taskId, payload: {} });
    sock2.send({ id: "snap", type: "snapshot.request", payload: { taskId } });
    const snap = await sock2.waitFor("snapshot");
    expect(snap.payload?.messages?.some((message) => message.text.includes("hello"))).toBe(true);

    const extraIds: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      sock2.send({
        id: `t${i}`,
        type: "task.create",
        payload: { cwd: project, title: `Queued ${i}` },
      });
    }
    await new Promise((r) => setTimeout(r, 300));
    const createdTasks = sock2.events
      .filter((event) => event.type === "task.created")
      .map((event) => event.payload?.task?.id)
      .filter((id): id is string => Boolean(id));
    extraIds.push(...createdTasks.filter((id) => id !== taskId).slice(-3));
    for (const id of extraIds) {
      sock2.send({ id: `act-${id}`, type: "task.activate", taskId: id, payload: {} });
    }
    await new Promise((r) => setTimeout(r, 600));
    const queued = ctx.service.listTasks().filter((task) => task.status === "queued");
    expect(queued.length).toBeGreaterThanOrEqual(1);

    for (const id of extraIds) {
      sock2.send({ id: `arch-${id}`, type: "task.archive", taskId: id, payload: {} });
    }
    await new Promise((r) => setTimeout(r, 300));

    sock2.send({ id: "crash-task", type: "task.create", payload: { cwd: project, title: "Crash" } });
    const crashCreated = await sock2.waitForRequest("crash-task");
    const crashId = crashCreated.payload?.data?.task?.id as string;
    sock2.send({ id: "p-crash", type: "prompt.send", taskId: crashId, payload: { message: "CRASH" } });
    const crashed = await new Promise<EventMsg>((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const match = sock2.events.find(
          (event) => event.type === "agent.status" && event.taskId === crashId && event.payload?.status === "error",
        );
        if (match) return resolve(match);
        if (Date.now() - start > 4000) return reject(new Error("crash not observed"));
        setTimeout(tick, 40);
      };
      tick();
    });
    expect(crashed.payload?.status).toBe("error");
    sock2.ws.close();
  }, 20_000);

  it("starts a second turn after idle instead of queuing a dead follow_up", async () => {
    const project = path.join(root.current, "project");
    const sock = await openSocket(ctx.base);
    await sock.waitFor("snapshot");
    sock.send({
      id: "c-second",
      type: "task.create",
      payload: { cwd: project, title: "Second turn" },
    });
    const created = await sock.waitFor("request.succeeded");
    const taskId = created?.payload?.data?.task?.id as string;

    sock.send({ id: "p-first", type: "prompt.send", taskId, payload: { message: "first turn" } });
    await sock.waitFor("message.delta");
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const match = sock.events.find(
          (event) =>
            event.type === "agent.status" && event.taskId === taskId && event.payload?.status === "idle",
        );
        if (match) return resolve();
        if (Date.now() - start > 4000) return reject(new Error("first turn did not settle"));
        setTimeout(tick, 25);
      };
      tick();
    });

    const before = sock.events.length;
    sock.send({
      id: "p-second",
      type: "prompt.followUp",
      taskId,
      payload: { message: "second turn please" },
    });
    const result = await sock.waitForRequest("p-second");
    expect(result.type).toBe("request.succeeded");
    const delta = await new Promise<EventMsg>((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        const match = sock.events.slice(before).find(
          (event) => event.type === "message.delta" && event.taskId === taskId,
        );
        if (match) return resolve(match);
        if (Date.now() - start > 4000) return reject(new Error("second turn did not stream"));
        setTimeout(tick, 25);
      };
      tick();
    });
    expect(delta.type).toBe("message.delta");
    sock.ws.close();
  }, 15_000);

  it("rejects foreign origins", async () => {
    const health = await fetch(`${ctx.base}/health`);
    const cookie = health.headers.get("set-cookie")?.split(";")[0] ?? "";
    const ws = new WebSocket(ctx.base.replace("http", "ws") + "/ws", {
      headers: { Origin: "http://evil.example", Cookie: cookie },
    });
    const code = await new Promise<number>((resolve) => {
      ws.on("close", (value) => resolve(value));
      ws.on("error", () => resolve(1008));
    });
    expect(code === 1008 || code === 1006).toBe(true);
  });

  it("times out pending approvals and ignores events after abort", async () => {
    const timed = await listen({
      HOST: "127.0.0.1",
      PORT: "0",
      NODE_ENV: "test",
      PI_BIN: fakePi,
      MYPI_DATA_DIR: path.join(root.current, "data-timeout"),
      MYPI_ALLOWED_ROOTS: root.current,
      MYPI_MAX_PROCESSES: "3",
      MYPI_MUTATIONS: "approval",
      MYPI_APPROVAL_TIMEOUT_MS: "200",
    });
    try {
      const project = path.join(root.current, "project");
      const sock = await openSocket(timed.base);
      await sock.waitFor("snapshot");
      sock.send({ id: "c", type: "task.create", payload: { cwd: project, title: "Timeout" } });
      const created = await sock.waitFor("request.succeeded");
      const taskId = created?.payload?.data?.task?.id as string;
      sock.send({ id: "w", type: "prompt.send", taskId, payload: { message: "WRITE:late.txt:nope" } });
      await sock.waitFor("approval.requested");
      const resolved = await sock.waitFor("approval.resolved", 4000);
      expect(resolved.payload).toBeTruthy();
      await sock.waitFor("tool.completed", 4000);
      await new Promise((r) => setTimeout(r, 300));
      await expect(import("node:fs/promises").then((fs) => fs.access(path.join(project, "late.txt")))).rejects.toThrow();

      sock.send({ id: "p", type: "prompt.send", taskId, payload: { message: "hello from abort path please stream slowly" } });
      await sock.waitFor("message.delta");
      const beforeAbort = sock.events.length;
      sock.send({ id: "ab", type: "agent.abort", taskId, payload: {} });
      const idle = await new Promise<EventMsg>((resolve, reject) => {
        const start = Date.now();
        const tick = () => {
          const match = sock.events.slice(beforeAbort).find(
            (event) =>
              event.type === "agent.status" &&
              event.taskId === taskId &&
              (event.payload?.status === "idle" || event.payload?.status === "stopped"),
          );
          if (match) return resolve(match);
          if (Date.now() - start > 2000) return reject(new Error("abort did not settle"));
          setTimeout(tick, 20);
        };
        tick();
      });
      expect(idle.payload?.status).toBe("idle");
      sock.ws.close();
    } finally {
      await timed.app.close();
    }
  }, 15_000);
});
