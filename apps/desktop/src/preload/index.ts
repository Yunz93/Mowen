import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ohmypi", {
  isDesktop: true,
  platform: process.platform,
  pickFolder: (defaultPath?: string) => ipcRenderer.invoke("ohmypi:pick-folder", defaultPath) as Promise<string | null>,
});
