import { mkdtemp, symlink, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertAllowedCwd,
  isProtectedWriteTarget,
  PathPolicyError,
  resolveAllowedPath,
} from "../../apps/server/src/security/path-policy.ts";

describe("path policy", () => {
  it("rejects cwd outside allowed roots", async () => {
    await expect(assertAllowedCwd("/tmp", ["/Users/yunz/Code/VibeCoding"])).rejects.toBeInstanceOf(PathPolicyError);
  });

  it("blocks .env writes", () => {
    expect(isProtectedWriteTarget("/Users/yunz/Code/VibeCoding/app/.env")).toBe(true);
  });

  it("blocks symlink escape", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mypi-root-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "mypi-out-"));
    const secret = path.join(outside, "secret.txt");
    await writeFile(secret, "nope");
    const link = path.join(root, "escape");
    await symlink(outside, link);
    await expect(resolveAllowedPath("escape/secret.txt", root, [root])).rejects.toBeInstanceOf(PathPolicyError);
  });

  it("allows writes inside cwd", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mypi-ok-"));
    await mkdir(path.join(root, "src"));
    const resolved = await resolveAllowedPath("src/app.ts", root, [root]);
    expect(resolved.endsWith(`${path.sep}src${path.sep}app.ts`)).toBe(true);
  });
});
