import { serverEventSchema, type ClientCommand } from "@ohmypi/protocol";
import { useAgentStore } from "../stores/agent-store";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class SocketClient {
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private requestId = 0;
  private retries = 0;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async connect(): Promise<void> {
    this.closedByUser = false;
    await fetch("/api/session", { credentials: "same-origin" });
    this.open();
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  send<T = unknown>(
    type: ClientCommand["type"],
    payload?: unknown,
    taskId?: string,
  ): Promise<T> {
    const id = `c${++this.requestId}`;
    const body = { id, type, taskId, payload };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.pending.delete(id);
        reject(new Error("Socket is not connected"));
        return;
      }
      this.socket.send(JSON.stringify(body));
    });
  }

  private open(): void {
    useAgentStore.getState().setConnection("connecting");
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${location.host}/ws`);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.retries = 0;
      useAgentStore.getState().setConnection("open");
    });

    socket.addEventListener("message", (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const result = serverEventSchema.safeParse(parsed);
      if (!result.success) {
        console.warn("[ohmypi] dropped event", result.error.issues[0]?.message);
        return;
      }
      const serverEvent = result.data;
      useAgentStore.getState().applyEvent(serverEvent);
      if (serverEvent.type === "request.succeeded") {
        const pending = this.pending.get(serverEvent.payload.requestId);
        pending?.resolve(serverEvent.payload.data);
        this.pending.delete(serverEvent.payload.requestId);
      }
      if (serverEvent.type === "request.failed") {
        const pending = this.pending.get(serverEvent.payload.requestId);
        pending?.reject(new Error(serverEvent.payload.error));
        this.pending.delete(serverEvent.payload.requestId);
      }
    });

    socket.addEventListener("close", () => {
      useAgentStore.getState().setConnection("closed");
      if (this.closedByUser) return;
      const delay = Math.min(1000 * 2 ** this.retries, 8000);
      this.retries += 1;
      this.reconnectTimer = setTimeout(() => {
        void this.connect().then(() => this.send("snapshot.request"));
      }, delay);
    });
  }
}

export const socketClient = new SocketClient();
