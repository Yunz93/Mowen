import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export function applyDesktopEnv(): void {
  process.env.MOWEN_DESKTOP = "1";
  process.env.HOST = process.env.HOST ?? "127.0.0.1";
  process.env.PORT = process.env.PORT ?? "4310";
  process.env.MOWEN_VERSION = process.env.MOWEN_VERSION ?? app.getVersion();
  if (app.isPackaged) {
    process.env.NODE_ENV = "production";
  } else if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
  }

  process.env.MOWEN_WEB_DIST = webDistDir();
  process.env.MOWEN_APPROVAL_EXTENSION = approvalExtensionPath();

  const piEntry = resolvePiEntry();
  if (piEntry) {
    process.env.MOWEN_PI_ENTRY = piEntry;
    process.env.MOWEN_NODE_BIN = process.execPath;
    process.env.MOWEN_PI_BUNDLED = "1";
  }
  const toolsDir = resolvePiToolsDir();
  if (toolsDir) {
    process.env.MOWEN_PI_TOOLS = toolsDir;
  }
}

export function webDistDir(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, "web");
  return path.resolve(app.getAppPath(), "../web/dist");
}

export function approvalExtensionPath(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, "approval.ts");
  return path.resolve(app.getAppPath(), "../server/extensions/approval.ts");
}

export function resolvePiEntry(): string | null {
  const candidates = [
    app.isPackaged
      ? path.join(
          process.resourcesPath,
          "pi",
          "node_modules",
          "@earendil-works",
          "pi-coding-agent",
          "dist",
          "cli.js",
        )
      : path.resolve(app.getAppPath(), "vendor/pi/node_modules/@earendil-works/pi-coding-agent/dist/cli.js"),
    path.resolve(app.getAppPath(), "../../node_modules/@earendil-works/pi-coding-agent/dist/cli.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolvePiToolsDir(): string | null {
  const candidates = [
    app.isPackaged
      ? path.join(process.resourcesPath, "tools")
      : path.resolve(app.getAppPath(), "vendor/tools"),
    path.resolve(app.getAppPath(), "vendor/tools"),
  ];
  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "fd")) ||
      fs.existsSync(path.join(candidate, "fd.exe")) ||
      fs.existsSync(path.join(candidate, "rg")) ||
      fs.existsSync(path.join(candidate, "rg.exe"))
    ) {
      return candidate;
    }
  }
  return null;
}

export function preloadPath(mainDir: string): string {
  return path.join(mainDir, "../preload/index.js");
}
