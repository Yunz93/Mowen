import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export function applyDesktopEnv(): void {
  process.env.HOST = process.env.HOST ?? "127.0.0.1";
  process.env.PORT = process.env.PORT ?? "4310";
  if (app.isPackaged) {
    process.env.NODE_ENV = "production";
  } else if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
  }

  process.env.OHMYPI_WEB_DIST = webDistDir();
  process.env.OHMYPI_APPROVAL_EXTENSION = approvalExtensionPath();

  const piEntry = resolvePiEntry();
  if (piEntry) {
    process.env.OHMYPI_PI_ENTRY = piEntry;
    process.env.OHMYPI_NODE_BIN = process.execPath;
    process.env.OHMYPI_PI_BUNDLED = "1";
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

export function preloadPath(mainDir: string): string {
  return path.join(mainDir, "../preload/index.js");
}
