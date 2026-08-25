import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * electron-builder skips node_modules inside extraResources.
 * Copy the vendored Pi tree after pack so the desktop app can spawn it.
 */
export default async function afterPack(context) {
  const src = path.join(context.packager.projectDir, "vendor", "pi");
  const platform = context.electronPlatformName;
  const dest =
    platform === "darwin"
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents",
          "Resources",
          "pi",
        )
      : path.join(context.appOutDir, "resources", "pi");

  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  console.log("copied bundled Pi to", dest);

  const toolsSrc = path.join(context.packager.projectDir, "vendor", "tools");
  const toolsDest =
    platform === "darwin"
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents",
          "Resources",
          "tools",
        )
      : path.join(context.appOutDir, "resources", "tools");
  try {
    await cp(toolsSrc, toolsDest, { recursive: true, force: true });
    console.log("copied bundled search tools to", toolsDest);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") throw error;
    console.warn("bundled search tools not found at", toolsSrc);
  }
}
