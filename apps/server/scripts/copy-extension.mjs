import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const destDir = path.join(root, "dist", "extensions");
await mkdir(destDir, { recursive: true });
await copyFile(path.join(root, "extensions", "approval.ts"), path.join(destDir, "approval.ts"));
