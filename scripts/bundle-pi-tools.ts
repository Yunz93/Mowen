import { mkdir } from "node:fs/promises";
import path from "node:path";
import { downloadPinnedSearchTool } from "../apps/server/src/setup/pi-search-tools.ts";

const dest = path.resolve("apps/desktop/vendor/tools");
await mkdir(dest, { recursive: true });

console.log("Downloading pinned fd and ripgrep into", dest);
for (const tool of ["fd", "rg"] as const) {
  const installed = await downloadPinnedSearchTool(tool, dest);
  console.log("bundled", tool, "->", installed);
}
