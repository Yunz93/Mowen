import path from "node:path";
import { describe, expect, it } from "vitest";
import { isDevSelfWorkspace, serverPackageRoot } from "../../apps/server/src/setup/dev-self-workspace.ts";

describe("isDevSelfWorkspace", () => {
  const serverRoot = serverPackageRoot();
  const repoRoot = path.resolve(serverRoot, "../..");

  it("is false when watch is disabled", () => {
    expect(
      isDevSelfWorkspace(repoRoot, { serverRoot, watchEnabled: false }),
    ).toBe(false);
  });

  it("detects the monorepo root as a self-workspace under watch", () => {
    expect(
      isDevSelfWorkspace(repoRoot, { serverRoot, watchEnabled: true }),
    ).toBe(true);
  });

  it("detects apps/server itself as a self-workspace under watch", () => {
    expect(
      isDevSelfWorkspace(serverRoot, { serverRoot, watchEnabled: true }),
    ).toBe(true);
  });

  it("is false for an unrelated folder even under watch", () => {
    expect(
      isDevSelfWorkspace("/tmp/other-project", { serverRoot, watchEnabled: true }),
    ).toBe(false);
  });
});
