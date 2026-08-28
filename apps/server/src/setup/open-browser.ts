import { spawn } from "node:child_process";

/** Best-effort open of a URL in the system browser (no shell). */
export function openBrowser(target: string): void {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  const [cmd, args] =
    process.platform === "darwin"
      ? (["open", [url.toString()]] as const)
      : process.platform === "win32"
        ? (["rundll32", ["url.dll,FileProtocolHandler", url.toString()]] as const)
        : (["xdg-open", [url.toString()]] as const);

  spawn(cmd, args, { stdio: "ignore", detached: true })
    .on("error", () => {})
    .unref();
}
