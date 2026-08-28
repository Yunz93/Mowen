import { spawn, type ChildProcess } from "node:child_process";

export const TERM_TIMEOUT_MS = 120_000;
export const TERM_MAX_OUTPUT = 200_000;

type RunInput = {
  cwd: string;
  command: string;
  onChunk: (text: string) => void;
  onExit: (code: number | null, signal: string | null) => void;
  timeoutMs?: number;
};

export class TaskShells {
  private readonly children = new Map<string, ChildProcess>();

  running(taskId: string): boolean {
    return this.children.has(taskId);
  }

  run(taskId: string, input: RunInput): void {
    if (this.children.has(taskId)) {
      throw new Error("上一条命令还在跑，先停再执行。");
    }
    const command = input.command.trim();
    if (!command) {
      throw new Error("请输入命令");
    }

    const child = spawn(command, {
      cwd: input.cwd,
      shell: true,
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
    });
    this.children.set(taskId, child);

    let size = 0;
    const write = (buf: Buffer): void => {
      let text = buf.toString("utf8");
      if (size >= TERM_MAX_OUTPUT) return;
      if (size + text.length > TERM_MAX_OUTPUT) {
        text = `${text.slice(0, TERM_MAX_OUTPUT - size)}\n…输出过长，已截断。\n`;
        this.stop(taskId, "SIGTERM");
      }
      size += text.length;
      input.onChunk(text);
    };

    child.stdout?.on("data", write);
    child.stderr?.on("data", write);
    child.on("error", (error) => {
      input.onChunk(`${error.message}\n`);
    });

    const timeoutMs = input.timeoutMs ?? TERM_TIMEOUT_MS;
    const timer = setTimeout(() => this.stop(taskId, "SIGTERM"), timeoutMs);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      this.children.delete(taskId);
      input.onExit(code, signal ?? null);
    });
  }

  interrupt(taskId: string): boolean {
    return this.stop(taskId, process.platform === "win32" ? undefined : "SIGINT");
  }

  dispose(taskId: string): void {
    this.stop(taskId, "SIGTERM");
  }

  private stop(taskId: string, signal?: NodeJS.Signals): boolean {
    const child = this.children.get(taskId);
    if (!child) return false;
    child.kill(signal);
    return true;
  }
}
