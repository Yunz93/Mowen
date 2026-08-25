import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../apps/server/src/index.ts";

const FAKE_INSTALL_SH = `#!/bin/sh
mkdir -p "$HOME/.pi/agent/bin"
cat > "$HOME/.pi/agent/bin/pi" <<'EOF'
#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "0.0.0-test"
  exit 0
fi
exit 1
EOF
chmod +x "$HOME/.pi/agent/bin/pi"
echo "No terminal detected; continuing without confirmation."
echo "Pi was installed successfully."
`;

async function listen(
  env: NodeJS.ProcessEnv,
): Promise<{ app: Awaited<ReturnType<typeof createApp>>["app"]; base: string; close: () => Promise<void> }> {
  const { app, config } = await createApp(env);
  await app.listen({ host: config.host, port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return {
    app,
    base: `http://${config.host}:${address.port}`,
    close: async () => {
      await app.close();
    },
  };
}

async function sessionCookie(base: string): Promise<string> {
  const health = await fetch(`${base}/health`);
  const cookie = health.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("missing session cookie");
  return cookie;
}

describe("POST /api/setup/install-pi", () => {
  const root = { current: "" };
  let scriptServer: http.Server | null = null;
  let scriptUrl = "";

  beforeAll(async () => {
    root.current = await mkdtemp(path.join(os.tmpdir(), "mowen-install-pi-"));
    scriptServer = http.createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end(FAKE_INSTALL_SH);
    });
    await new Promise<void>((resolve) => {
      scriptServer?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = scriptServer.address() as AddressInfo;
    scriptUrl = `http://127.0.0.1:${address.port}/install.sh`;
  });

  afterAll(async () => {
    scriptServer?.close();
    await rm(root.current, { recursive: true, force: true });
  });

  it("runs the official install script and then finds Pi", async () => {
    const home = path.join(root.current, "home-ok");
    await mkdir(home);
    const ctx = await listen({
      HOST: "127.0.0.1",
      PORT: "0",
      NODE_ENV: "test",
      PI_BIN: path.join(home, "missing-pi"),
      MOWEN_DATA_DIR: path.join(home, "data"),
      MOWEN_HOME_DIR: home,
      MOWEN_ALLOWED_ROOTS: home,
      MOWEN_PI_INSTALL_SCRIPT_URL: scriptUrl,
    });
    try {
      const cookie = await sessionCookie(ctx.base);
      const before = await fetch(`${ctx.base}/api/setup`, { headers: { cookie } });
      const beforeJson = (await before.json()) as { piAvailable: boolean; canInstallPi: boolean };
      expect(beforeJson.piAvailable).toBe(false);
      expect(beforeJson.canInstallPi).toBe(true);

      const installed = await fetch(`${ctx.base}/api/setup/install-pi`, {
        method: "POST",
        headers: { cookie },
      });
      const json = (await installed.json()) as {
        piAvailable: boolean;
        piVersion: string | null;
        log?: string;
        error?: string;
      };
      expect(installed.ok, json.error ?? json.log).toBe(true);
      expect(json.piAvailable).toBe(true);
      expect(json.piVersion).toBe("0.0.0-test");
      expect(json.log).toContain("Pi was installed successfully");

      const health = await fetch(`${ctx.base}/health`, { headers: { cookie } });
      const healthJson = (await health.json()) as { piVersion: string | null };
      expect(healthJson.piVersion).toBe("0.0.0-test");
    } finally {
      await ctx.close();
    }
  });

  it("refuses to replace a bundled desktop Pi", async () => {
    const home = path.join(root.current, "home-bundled");
    await mkdir(home);
    const ctx = await listen({
      HOST: "127.0.0.1",
      PORT: "0",
      NODE_ENV: "test",
      PI_BIN: path.join(home, "missing-pi"),
      MOWEN_PI_ENTRY: path.join(home, "missing-entry.js"),
      MOWEN_DATA_DIR: path.join(home, "data"),
      MOWEN_HOME_DIR: home,
      MOWEN_ALLOWED_ROOTS: home,
      MOWEN_PI_INSTALL_SCRIPT_URL: scriptUrl,
    });
    try {
      const cookie = await sessionCookie(ctx.base);
      const installed = await fetch(`${ctx.base}/api/setup/install-pi`, {
        method: "POST",
        headers: { cookie },
      });
      expect(installed.status).toBe(400);
      const json = (await installed.json()) as { error: string };
      expect(json.error).toMatch(/内置 Pi/);
    } finally {
      await ctx.close();
    }
  });

  it("does not rerun the installer when Pi is already available", async () => {
    const fakePi = fileURLToPath(new URL("../fixtures/fake-pi.mjs", import.meta.url));
    const home = path.join(root.current, "home-ready");
    await mkdir(home);
    let hits = 0;
    const counting = http.createServer((_request, response) => {
      hits += 1;
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end(FAKE_INSTALL_SH);
    });
    await new Promise<void>((resolve) => counting.listen(0, "127.0.0.1", () => resolve()));
    const countingUrl = `http://127.0.0.1:${(counting.address() as AddressInfo).port}/install.sh`;
    const ctx = await listen({
      HOST: "127.0.0.1",
      PORT: "0",
      NODE_ENV: "test",
      PI_BIN: fakePi,
      MOWEN_DATA_DIR: path.join(home, "data"),
      MOWEN_HOME_DIR: home,
      MOWEN_ALLOWED_ROOTS: home,
      MOWEN_PI_INSTALL_SCRIPT_URL: countingUrl,
    });
    try {
      const cookie = await sessionCookie(ctx.base);
      const installed = await fetch(`${ctx.base}/api/setup/install-pi`, {
        method: "POST",
        headers: { cookie },
      });
      const json = (await installed.json()) as { piAvailable: boolean; log?: string };
      expect(installed.ok).toBe(true);
      expect(json.piAvailable).toBe(true);
      expect(hits).toBe(0);
    } finally {
      await ctx.close();
      counting.close();
    }
  });
});
