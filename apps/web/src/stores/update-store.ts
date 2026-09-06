import { create } from "zustand";
import { getDesktop } from "../desktop-bridge";

export type MowenUpdateSnapshot = {
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
};

type UpdateState = MowenUpdateSnapshot & {
  busy: boolean;
  installing: boolean;
  notice: string;
  lastCheckedAt: number;
  check: (force?: boolean) => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
};

const empty: MowenUpdateSnapshot = {
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
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  ...empty,
  busy: false,
  installing: false,
  notice: "",
  lastCheckedAt: 0,

  check: async (force = false) => {
    const current = get();
    if (current.busy || current.installing) return;
    if (!force && current.lastCheckedAt && Date.now() - current.lastCheckedAt < 60_000) return;
    set({ busy: true, error: null, notice: "" });
    try {
      const response = await fetch("/api/update/latest", { credentials: "same-origin" });
      const json = (await response.json()) as MowenUpdateSnapshot;
      set({
        ...(response.ok ? json : { ...empty, ...json, error: json.error ?? "检查更新失败。" }),
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
    set({ installing: true, notice: "", error: null });
    try {
      const response = await fetch("/api/update/install", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: latest }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        set({ installing: false, error: json.error ?? "更新失败。" });
        return;
      }
      const desktop = getDesktop();
      if (desktop?.restart) {
        set({ notice: "即将重启…" });
        window.setTimeout(() => void desktop.restart?.(), 400);
      } else {
        set({ installing: false, notice: "请重新打开墨问。" });
      }
    } catch {
      set({ installing: false, error: "更新失败。" });
    }
  },

  dismiss: () => set({ updateAvailable: false }),
}));
