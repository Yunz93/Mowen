export type MypiDesktopApi = {
  isDesktop: true;
  platform: "darwin" | "win32" | "linux" | string;
  pickFolder: (defaultPath?: string) => Promise<string | null>;
};

declare global {
  interface Window {
    mypi?: MypiDesktopApi;
  }
}

export function getDesktop(): MypiDesktopApi | null {
  return typeof window !== "undefined" && window.mypi?.isDesktop ? window.mypi : null;
}

export function isDesktopApp(): boolean {
  return getDesktop() !== null;
}
