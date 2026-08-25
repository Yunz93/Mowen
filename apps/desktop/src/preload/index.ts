import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mowen", {
  isDesktop: true,
  platform: process.platform,
  pickFolder: (defaultPath?: string) => ipcRenderer.invoke("mowen:pick-folder", defaultPath) as Promise<string | null>,
  openPath: (filePath: string) => ipcRenderer.invoke("mowen:open-path", filePath) as Promise<string>,
  onOpenSetup: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("mowen:open-setup", handler);
    return () => {
      ipcRenderer.removeListener("mowen:open-setup", handler);
    };
  },
});
