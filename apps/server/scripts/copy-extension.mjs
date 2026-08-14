import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const destDir = path.join(root, "dist", "extensions");
await mkdir(destDir, { recursive: true });
await copyFile(path.join(root, "extensions", "approval.ts"), path.join(destDir, "approval.ts"));
