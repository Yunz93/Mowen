import { create } from "zustand";
import { getDesktop } from "../desktop-bridge";
import {
  applyUpdateDownloadEvent,
  INITIAL_UPDATE_DOWNLOAD_PROGRESS,
  startUpdateDownload,
  type UpdateDownloadProgress,
} from "../lib/update-progress";

export const RELEASES_PAGE_URL = "https://github.com/Yunz93/Qingzhou/releases";

export type QingzhouUpdateSnapshot = {
  current: string | null;
  latest: string | null;
  tagName: string | null;
  name: string | null;
  url: string | null;
  body: string;
  publishedAt: string | null;
  updateAvailable: boolean;
  canUpdate: boolean;
  error: string | null;
  autoCheckForUpdates: boolean;
  skippedUpdateVersion: string;
  lastUpdateCheckAt: string | null;
};

type UpdateState = QingzhouUpdateSnapshot & {
  busy: boolean;
  installing: boolean;
  notice: string;
  lastCheckedAt: number;
  progress: UpdateDownloadProgress;
  hydrate: () => Promise<void>;
  check: (force?: boolean) => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
  setPreferences: (patch: { autoCheckForUpdates?: boolean; skippedUpdateVersion?: string }) => Promise<void>;
  skipCurrent: () => Promise<void>;
  resumeSkipped: () => Promise<void>;
};

const empty: QingzhouUpdateSnapshot = {
  current: null,
  latest: null,
  tagName: null,
  name: null,
  url: null,
  body: "",
  publishedAt: null,
  updateAvailable: false,
  canUpdate: false,
  error: null,
  autoCheckForUpdates: true,
  skippedUpdateVersion: "",
  lastUpdateCheckAt: null,
};

function applyPreferences(json: Partial<QingzhouUpdateSnapshot>): Pick<
  QingzhouUpdateSnapshot,
  "autoCheckForUpdates" | "skippedUpdateVersion" | "lastUpdateCheckAt" | "current"
> {
  return {
    current: typeof json.current === "string" ? json.current : empty.current,
    autoCheckForUpdates: json.autoCheckForUpdates !== false,
    skippedUpdateVersion: typeof json.skippedUpdateVersion === "string" ? json.skippedUpdateVersion : "",
    lastUpdateCheckAt: typeof json.lastUpdateCheckAt === "string" ? json.lastUpdateCheckAt : null,
  };
}

async function readSseEvents(
  response: Response,
  onEvent: (event: { event: string; data?: Record<string, unknown> }) => void,
): Promise<void> {
  if (!response.body) throw new Error("更新失败。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      const payload = line.replace(/^data:\s?/, "");
      if (!payload) continue;
      onEvent(JSON.parse(payload) as { event: string; data?: Record<string, unknown> });
    }
  }
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  ...empty,
  busy: false,
  installing: false,
  notice: "",
  lastCheckedAt: 0,
  progress: INITIAL_UPDATE_DOWNLOAD_PROGRESS,

  hydrate: async () => {
    try {
      const response = await fetch("/api/update/preferences", { credentials: "same-origin" });
      if (!response.ok) return;
      const json = (await response.json()) as Partial<QingzhouUpdateSnapshot>;
      set(applyPreferences(json));
    } catch {
      // 偏好读失败时沿用默认值，不挡启动。
    }
  },

  check: async (force = false) => {
    const current = get();
    if (current.busy || current.installing) return;
    if (!force && !current.autoCheckForUpdates) return;
    if (!force && current.lastCheckedAt && Date.now() - current.lastCheckedAt < 60_000) return;
    set({ busy: true, error: null, notice: "", progress: INITIAL_UPDATE_DOWNLOAD_PROGRESS });
    try {
      const response = await fetch("/api/update/latest", { credentials: "same-origin" });
      const json = (await response.json()) as QingzhouUpdateSnapshot;
      set({
        ...(response.ok ? json : { ...empty, ...json, error: json.error ?? "检查更新失败。" }),
        ...applyPreferences(json),
        busy: false,
        lastCheckedAt: Date.now(),
      });
    } catch {
      set({
        busy: false,
        lastCheckedAt: Date.now(),
        error: "检查更新失败。",
      });
    }
  },

  install: async () => {
    const latest = get().latest;
    if (!latest) return;
    set({
      installing: true,
      notice: "",
      error: null,
      progress: startUpdateDownload(),
    });
    try {
      const response = await fetch("/api/update/install", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ version: latest }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok && !contentType.includes("text/event-stream")) {
        const json = (await response.json()) as { error?: string };
        set({
          installing: false,
          error: json.error ?? "更新失败。",
          progress: INITIAL_UPDATE_DOWNLOAD_PROGRESS,
        });
        return;
      }

      let failed: string | null = null;
      let relaunch = false;
      if (contentType.includes("text/event-stream")) {
        await readSseEvents(response, (event) => {
          if (event.event === "Started" || event.event === "Progress" || event.event === "Finished") {
            set({
              progress: applyUpdateDownloadEvent(get().progress, {
                event: event.event,
                data: event.data as { contentLength?: number | null; chunkLength?: number },
              }),
            });
            return;
          }
          if (event.event === "Error") {
            failed = typeof event.data?.error === "string" ? event.data.error : "更新失败。";
            return;
          }
          if (event.event === "Done") {
            relaunch = event.data?.relaunch === true;
          }
        });
      } else {
        const json = (await response.json()) as { error?: string; relaunch?: boolean };
        if (!response.ok) {
          failed = json.error ?? "更新失败。";
        } else {
          relaunch = json.relaunch === true;
        }
      }

      if (failed) {
        set({
          installing: false,
          error: failed,
          progress: INITIAL_UPDATE_DOWNLOAD_PROGRESS,
        });
        return;
      }

      const desktop = getDesktop();
      if (desktop?.restart) {
        set({ notice: "即将重启…", progress: { ...get().progress, phase: "installing" } });
        window.setTimeout(() => void desktop.restart?.({ relaunch }), 400);
      } else {
        set({
          installing: false,
          notice: "请重新打开轻舟。",
          progress: INITIAL_UPDATE_DOWNLOAD_PROGRESS,
        });
      }
    } catch {
      set({
        installing: false,
        error: "更新失败。",
        progress: INITIAL_UPDATE_DOWNLOAD_PROGRESS,
      });
    }
  },

  dismiss: () => set({ updateAvailable: false }),

  setPreferences: async (patch) => {
    const response = await fetch("/api/update/preferences", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) return;
    const json = (await response.json()) as Partial<QingzhouUpdateSnapshot>;
    set(applyPreferences(json));
  },

  skipCurrent: async () => {
    const latest = get().latest;
    if (!latest) return;
    await get().setPreferences({ skippedUpdateVersion: latest });
  },

  resumeSkipped: async () => {
    await get().setPreferences({ skippedUpdateVersion: "" });
  },
}));
