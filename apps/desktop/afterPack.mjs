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
}
