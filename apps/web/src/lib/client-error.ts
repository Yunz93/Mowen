import { useAgentStore } from "../stores/agent-store";

export function clientErrorMessage(error: unknown, fallback = "发送失败"): string {
  const raw = error instanceof Error ? error.message.trim() : String(error ?? "").trim();
  if (!raw || raw === "undefined" || raw === "[object Object]") return fallback;
  if (/socket is not connected/i.test(raw)) return "还没连上服务，请稍后再发。";
  if (/socket closed/i.test(raw) || raw === "连接已断开。") return "连接已断开，请稍后再发。";
  return raw;
}

export function reportRequestError(error: unknown, fallback = "发送失败"): void {
  useAgentStore.setState({ requestError: clientErrorMessage(error, fallback) });
}
