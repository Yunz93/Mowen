import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "out/main/index.js",
  external: ["electron"],
  sourcemap: true,
  banner: {
    js: "import { createRequire as __ohmypiCreateRequire } from 'node:module'; const require = __ohmypiCreateRequire(import.meta.url);",
  },
});

await esbuild.build({
  entryPoints: ["src/preload/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "out/preload/index.js",
  external: ["electron"],
  sourcemap: true,
});

console.log("bundled Electron main and preload");
