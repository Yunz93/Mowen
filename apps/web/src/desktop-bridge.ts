export type OhMyPiDesktopApi = {
  isDesktop: true;
  platform: "darwin" | "win32" | "linux" | string;
  pickFolder: (defaultPath?: string) => Promise<string | null>;
};

declare global {
  interface Window {
    ohmypi?: OhMyPiDesktopApi;
  }
}

export function getDesktop(): OhMyPiDesktopApi | null {
  return typeof window !== "undefined" && window.ohmypi?.isDesktop ? window.ohmypi : null;
}

export function isDesktopApp(): boolean {
  return getDesktop() !== null;
}
