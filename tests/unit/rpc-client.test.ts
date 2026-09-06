import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RpcClient } from "../../apps/server/src/pi/rpc-client.ts";

const fakePi = fileURLToPath(new URL("../fixtures/fake-pi.mjs", import.meta.url));

describe("rpc client correlation", () => {
  it("resolves responses by request id", async () => {
    const client = new RpcClient({
      bin: fakePi,
      args: ["--mode", "rpc", "--no-session"],
      cwd: process.cwd(),
    });
    await client.start();
    const first = client.send({ type: "get_state", id: "one" });
    const second = client.send({ type: "get_available_models", id: "two" });
    const [a, b] = await Promise.all([first, second]);
    expect(a.id).toBe("one");
    expect(a.success).toBe(true);
    expect(b.id).toBe("two");
    expect(b.command).toBe("get_available_models");
    await client.stop();
  });

  it("runs Electron as Node so macOS does not show a second Dock icon", () => {
    const src = readFileSync(path.resolve("apps/server/src/pi/rpc-client.ts"), "utf8");
    expect(src).toContain("asNodeEnv(command)");
    expect(src).toContain("windowsHide: true");
  });
});
