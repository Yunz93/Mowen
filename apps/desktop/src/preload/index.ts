import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("qingzhou", {
  isDesktop: true,
  platform: process.platform,
  pickFolder: (defaultPath?: string) => ipcRenderer.invoke("qingzhou:pick-folder", defaultPath) as Promise<string | null>,
  openPath: (filePath: string) => ipcRenderer.invoke("qingzhou:open-path", filePath) as Promise<string>,
  notify: (payload: { title: string; body: string }) => ipcRenderer.invoke("qingzhou:notify", payload) as Promise<void>,
  restart: () => ipcRenderer.invoke("qingzhou:restart") as Promise<void>,
  onOpenSetup: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("qingzhou:open-setup", handler);
    return () => {
      ipcRenderer.removeListener("qingzhou:open-setup", handler);
    };
  },
  onCheckUpdate: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("qingzhou:check-update", handler);
    return () => {
      ipcRenderer.removeListener("qingzhou:check-update", handler);
    };
  },
});
