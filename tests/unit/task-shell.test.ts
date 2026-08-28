import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TaskShells } from "../../apps/server/src/tasks/task-shell.ts";

describe("TaskShells", () => {
  it("runs a command in the given cwd and streams output", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-term-"));
    const shells = new TaskShells();
    const chunks: string[] = [];
    const done = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      shells.run("task-1", {
        cwd: root,
        command: "echo hello-term",
        onChunk: (text) => chunks.push(text),
        onExit: (code, signal) => resolve({ code, signal }),
      });
    });
    const result = await done;
    expect(result.code).toBe(0);
    expect(chunks.join("")).toContain("hello-term");
  });

  it("rejects a second command while one is running", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-term-busy-"));
    const shells = new TaskShells();
    const done = new Promise<void>((resolve) => {
      shells.run("task-1", {
        cwd: root,
        command: process.platform === "win32" ? "ping -n 3 127.0.0.1" : "sleep 0.4",
        onChunk: () => {},
        onExit: () => resolve(),
      });
    });
    expect(() =>
      shells.run("task-1", {
        cwd: root,
        command: "echo no",
        onChunk: () => {},
        onExit: () => {},
      }),
    ).toThrow(/还在跑/);
    shells.interrupt("task-1");
    await done;
  });
});
