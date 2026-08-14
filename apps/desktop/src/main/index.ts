import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "@mypi/server";
import { applyDesktopEnv, preloadPath, resolvePiEntry } from "./paths.js";

const here = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let stopServer: (() => Promise<void>) | null = null;

async function loadWithRetry(win: BrowserWindow, url: string, attempts = 40): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await win.loadURL(url);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not load ${url}`);
}

function installMenu(): void {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }
  const isMac = true;
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      role: "appMenu",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Open setup again",
          click: () => mainWindow?.webContents.send("mypi:open-setup"),
        },
        {
          label: "MyPi on GitHub",
          click: () => void shell.openExternal("https://github.com/Yunz93/ohMyPi"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  void isMac;
}

async function startBackend(): Promise<number> {
  applyDesktopEnv();
  const piEntry = resolvePiEntry();
  if (piEntry) {
    console.log(`[mypi-desktop] bundled Pi: ${piEntry}`);
  } else {
    console.warn("[mypi-desktop] bundled Pi not found; falling back to PATH");
  }

  const { app: server, config } = await createApp(process.env);
  try {
    await server.listen({ host: "127.0.0.1", port: config.port });
    stopServer = async () => {
      await server.close();
    };
    return config.port;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/EADDRINUSE/i.test(message)) throw error;
    await server.listen({ host: "127.0.0.1", port: 0 });
    const address = server.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    stopServer = async () => {
      await server.close();
    };
    return port;
  }
}

async function createMainWindow(port: number): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    title: "MyPi",
    backgroundColor: "#1c1a16",
    show: false,
    autoHideMenuBar: process.platform === "win32",
    webPreferences: {
      preload: preloadPath(here),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const packaged = app.isPackaged;
  const url = packaged || process.env.MYPI_DESKTOP_USE_SERVER === "1"
    ? `http://127.0.0.1:${port}`
    : process.env.MYPI_RENDERER_URL ?? "http://127.0.0.1:5173";
  await loadWithRetry(mainWindow, url);
}

function registerIpc(): void {
  ipcMain.handle("mypi:pick-folder", async (_event, defaultPath?: string) => {
    const options: Electron.OpenDialogOptions = {
      title: "Choose a folder",
      defaultPath: typeof defaultPath === "string" ? defaultPath : undefined,
      properties: ["openDirectory", "createDirectory"],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });
}

async function boot(): Promise<void> {
  registerIpc();
  installMenu();
  const port = await startBackend();
  await createMainWindow(port);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void stopServer?.();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void boot().catch((error) => {
      dialog.showErrorBox("MyPi failed to start", error instanceof Error ? error.message : String(error));
      app.quit();
    });
  }
});

app.whenReady().then(() => {
  void boot().catch((error) => {
    dialog.showErrorBox("MyPi failed to start", error instanceof Error ? error.message : String(error));
    app.quit();
  });
});
