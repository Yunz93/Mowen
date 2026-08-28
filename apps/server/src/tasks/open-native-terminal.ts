import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export type NativeTerminalDeps = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  spawn?: (cmd: string, args: string[], options: { cwd?: string; stdio: "ignore"; detached: boolean }) => ChildProcess;
};

export type NativeTerminalSpec = {
  cmd: string;
  args: string[];
  cwd?: string;
};

export function loginZsh(env: NodeJS.ProcessEnv = process.env): string {
  const shell = env.SHELL?.trim();
  if (shell && /(^|[/\\])zsh$/.test(shell)) return shell;
  return "zsh";
}

export function nativeTerminalSpec(
  cwd: string,
  deps: NativeTerminalDeps = {},
): NativeTerminalSpec {
  if (typeof cwd !== "string" || !cwd.trim() || cwd.includes("\0")) {
    throw new Error("无法打开系统终端：工作文件夹无效。");
  }
  const folder = path.resolve(cwd);
  const platform = deps.platform ?? process.platform;
  const env = deps.env ?? process.env;
  const zsh = loginZsh(env);

  if (platform === "darwin") {
    return { cmd: "open", args: ["-a", "Terminal", folder] };
  }
  if (platform === "win32") {
    return { cmd: "cmd.exe", args: ["/c", "start", "wt.exe", "-d", folder] };
  }
  const terminal = env.TERMINAL?.trim();
  return {
    cmd: terminal && !terminal.includes(" ") ? terminal : "x-terminal-emulator",
    args: ["-e", zsh, "-l"],
    cwd: folder,
  };
}

/** Best-effort open of a native terminal (zsh on macOS/Linux) at cwd. */
export function openNativeTerminal(cwd: string, deps: NativeTerminalDeps = {}): Promise<void> {
  const spec = nativeTerminalSpec(cwd, deps);
  const spawnFn = deps.spawn ?? spawn;
  return new Promise((resolve, reject) => {
    const child = spawnFn(spec.cmd, spec.args, {
      cwd: spec.cwd,
      stdio: "ignore",
      detached: true,
    });
    child.once("error", (error) => {
      reject(new Error(`无法打开系统终端：${error.message}`));
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
