export type MowenDesktopApi = {
  isDesktop: true;
  platform: "darwin" | "win32" | "linux" | string;
  pickFolder: (defaultPath?: string) => Promise<string | null>;
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
