import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const dest = path.resolve("apps/desktop/vendor/pi");
mkdirSync(dest, { recursive: true });
if (!existsSync(path.join(dest, "package.json"))) {
  writeFileSync(
    path.join(dest, "package.json"),
    `${JSON.stringify({ name: "mowen-pi-vendor", private: true }, null, 2)}\n`,
  );
}

console.log("Installing bundled Pi into apps/desktop/vendor/pi …");
const result = spawnSync(
  "npm",
  ["install", "@earendil-works/pi-coding-agent", "--omit=dev", "--ignore-scripts"],
  {
    cwd: dest,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const cli = path.join(dest, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js");
if (!existsSync(cli)) {
  console.error("Pi CLI was not installed at", cli);
  process.exit(1);
}
console.log("Bundled Pi CLI:", cli);
