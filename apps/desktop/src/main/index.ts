import { app, BrowserWindow, Menu, Notification, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "@mowen/server";
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
          label: "再次打开设置",
          click: () => mainWindow?.webContents.send("mowen:open-setup"),
        },
        {
          label: "检查更新…",
          click: () => mainWindow?.webContents.send("mowen:check-update"),
        },
        {
          label: "在 GitHub 查看墨问",
          click: () => void shell.openExternal("https://github.com/Yunz93/Mowen"),
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
    console.log(`[mowen-desktop] bundled Pi: ${piEntry}`);
  } else {
    console.warn("[mowen-desktop] bundled Pi not found; falling back to PATH");
  }

  const { app: server, config, service } = await createApp(process.env);
  try {
    await server.listen({ host: "127.0.0.1", port: config.port });
    stopServer = async () => {
      service.dispose();
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
      service.dispose();
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
    title: "墨问",
    backgroundColor: "#f5f5f7",
    show: false,
    autoHideMenuBar: process.platform === "win32",
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hiddenInset" as const,
          trafficLightPosition: { x: 16, y: 18 },
        }
      : {}),
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
  let rendererReady = false;
  mainWindow.webContents.on("did-finish-load", () => {
    rendererReady = true;
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!rendererReady) return;
    const current = mainWindow?.webContents.getURL() ?? "";
    if (url === current) return;
    event.preventDefault();
    try {
      const next = new URL(url);
      if (
        (next.protocol === "http:" || next.protocol === "https:") &&
        next.hostname !== "127.0.0.1" &&
        next.hostname !== "localhost"
      ) {
        void shell.openExternal(url);
      }
    } catch {
      // Ignore malformed navigation targets; stay on the current page.
    }
  });

  const packaged = app.isPackaged;
  const url = packaged || process.env.MOWEN_DESKTOP_USE_SERVER === "1" || process.env.OHMYPI_DESKTOP_USE_SERVER === "1"
    ? `http://127.0.0.1:${port}`
    : process.env.MOWEN_RENDERER_URL ?? process.env.OHMYPI_RENDERER_URL ?? "http://127.0.0.1:5173";
  await loadWithRetry(mainWindow, url);
}

function registerIpc(): void {
  ipcMain.handle("mowen:pick-folder", async (_event, defaultPath?: string) => {
    const options: Electron.OpenDialogOptions = {
      title: "选择文件夹",
      defaultPath: typeof defaultPath === "string" ? defaultPath : undefined,
      properties: ["openDirectory", "createDirectory"],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });
  ipcMain.handle("mowen:open-path", async (_event, filePath: unknown) => {
    if (typeof filePath !== "string" || !filePath.trim() || filePath.includes("\0")) {
      return "invalid path";
    }
    return shell.openPath(filePath);
  });
  ipcMain.handle("mowen:notify", async (_event, payload: unknown) => {
    const record = payload && typeof payload === "object" ? (payload as { title?: unknown; body?: unknown }) : {};
    const title = typeof record.title === "string" && record.title.trim() ? record.title.trim() : "墨问";
    const body = typeof record.body === "string" ? record.body : "";
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });
  ipcMain.handle("mowen:restart", async () => {
    app.relaunch();
    app.exit(0);
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
      dialog.showErrorBox("墨问启动失败", error instanceof Error ? error.message : String(error));
      app.quit();
    });
  }
});

app.whenReady().then(() => {
  void boot().catch((error) => {
    dialog.showErrorBox("墨问启动失败", error instanceof Error ? error.message : String(error));
    app.quit();
  });
});
