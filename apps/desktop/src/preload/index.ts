import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mowen", {
  isDesktop: true,
  platform: process.platform,
  pickFolder: (defaultPath?: string) => ipcRenderer.invoke("mowen:pick-folder", defaultPath) as Promise<string | null>,
});
