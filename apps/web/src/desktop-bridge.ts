export type MowenDesktopApi = {
  isDesktop: true;
  platform: "darwin" | "win32" | "linux" | string;
  pickFolder: (defaultPath?: string) => Promise<string | null>;
  openPath?: (filePath: string) => Promise<string>;
  notify?: (payload: { title: string; body: string }) => Promise<void>;
  restart?: () => Promise<void>;
  onOpenSetup?: (callback: () => void) => () => void;
  onCheckUpdate?: (callback: () => void) => () => void;
};

declare global {
  interface Window {
    mowen?: MowenDesktopApi;
  }
}

export function getDesktop(): MowenDesktopApi | null {
  return typeof window !== "undefined" && window.mowen?.isDesktop ? window.mowen : null;
}

export function isDesktopApp(): boolean {
  return getDesktop() !== null;
}
