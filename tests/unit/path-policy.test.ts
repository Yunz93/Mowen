import { mkdtemp, symlink, writeFile, mkdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertAllowedCwd,
  exportAllowedRoots,
  isProtectedWriteTarget,
  PathPolicyError,
  resolveAllowedPath,
  resolveReadableExportPath,
} from "../../apps/server/src/security/path-policy.ts";

describe("path policy", () => {
  it("rejects cwd outside allowed roots", async () => {
    const allowed = await mkdtemp(path.join(os.tmpdir(), "mowen-allowed-"));
    await expect(assertAllowedCwd("/tmp", [allowed])).rejects.toBeInstanceOf(PathPolicyError);
  });

  it("blocks .env writes", () => {
    expect(isProtectedWriteTarget("/var/allowed-only/app/.env")).toBe(true);
  });

  it("blocks symlink escape", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-root-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "mowen-out-"));
    const secret = path.join(outside, "secret.txt");
    await writeFile(secret, "nope");
    const link = path.join(root, "escape");
    await symlink(outside, link);
    await expect(resolveAllowedPath("escape/secret.txt", root, [root])).rejects.toBeInstanceOf(PathPolicyError);
  });

  it("allows writes inside cwd", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mowen-ok-"));
    await mkdir(path.join(root, "src"));
    const resolved = await resolveAllowedPath("src/app.ts", root, [root]);
    expect(resolved.endsWith(`${path.sep}src${path.sep}app.ts`)).toBe(true);
  });

  it("serves html exports only from allowed roots", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "mowen-home-"));
    const data = path.join(home, "data");
    await mkdir(data);
    const html = path.join(data, "chat.html");
    await writeFile(html, "<html><body>ok</body></html>");
    const roots = exportAllowedRoots({
      homeDir: home,
      dataDir: data,
      allowedRoots: [home],
      tmpDir: path.join(home, "tmp"),
    });
    await expect(resolveReadableExportPath(html, roots)).resolves.toBe(await realpath(html));

    const txt = path.join(data, "chat.txt");
    await writeFile(txt, "nope");
    await expect(resolveReadableExportPath(txt, roots)).rejects.toMatchObject({ status: 400 });

    const missing = path.join(data, "gone.html");
    await expect(resolveReadableExportPath(missing, roots)).rejects.toMatchObject({ status: 404 });

    const outsideDir = await mkdtemp(path.join(os.tmpdir(), "mowen-export-deny-"));
    const outside = path.join(outsideDir, "secret.html");
    await writeFile(outside, "<html>no</html>");
    await expect(resolveReadableExportPath(outside, roots)).rejects.toMatchObject({ status: 403 });
    await rm(outsideDir, { recursive: true, force: true });
  });
});
