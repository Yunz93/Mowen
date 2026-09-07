export type QingzhouDesktopApi = {
  isDesktop: true;
  platform: "darwin" | "win32" | "linux" | string;
  pickFolder: (defaultPath?: string) => Promise<string | null>;
  openPath?: (filePath: string) => Promise<string>;
  notify?: (payload: { title: string; body: string }) => Promise<void>;
  restart?: (options?: { relaunch?: boolean }) => Promise<void>;
  onOpenSetup?: (callback: () => void) => () => void;
  onCheckUpdate?: (callback: () => void) => () => void;
};

declare global {
  interface Window {
    qingzhou?: QingzhouDesktopApi;
  }
}

export function getDesktop(): QingzhouDesktopApi | null {
  return typeof window !== "undefined" && window.qingzhou?.isDesktop ? window.qingzhou : null;
}

export function isDesktopApp(): boolean {
  return getDesktop() !== null;
}
