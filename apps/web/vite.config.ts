import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@mowen/protocol": path.resolve(__dirname, "../../packages/protocol/src/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    watch: process.env.MOWEN_STABLE === "1" ? null : undefined,
    proxy: {
      "/ws": { target: "ws://127.0.0.1:4310", ws: true },
      "/api": { target: "http://127.0.0.1:4310" },
      "/uploads": { target: "http://127.0.0.1:4310" },
      "/health": { target: "http://127.0.0.1:4310" },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
