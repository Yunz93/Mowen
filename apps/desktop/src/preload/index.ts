import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mypi", {
  isDesktop: true,
  platform: process.platform,
  pickFolder: (defaultPath?: string) => ipcRenderer.invoke("mypi:pick-folder", defaultPath) as Promise<string | null>,
});
