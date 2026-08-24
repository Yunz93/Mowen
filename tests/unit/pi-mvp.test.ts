import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listAuthEntries } from "../../apps/server/src/setup/auth-status.ts";
import { scanPiResources } from "../../apps/server/src/tasks/pi-resources.ts";
import { listPiSessions } from "../../apps/server/src/tasks/pi-sessions.ts";
import { flattenSessionTree } from "../../apps/server/src/tasks/session-tree.ts";

describe("pi mvp helpers", () => {
  it("lists oauth and api key entries without exposing secrets", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "mowen-auth-entries-"));
    await mkdir(path.join(home, ".pi", "agent"), { recursive: true });
    await writeFile(
      path.join(home, ".pi", "agent", "auth.json"),
      JSON.stringify({
        anthropic: { type: "api_key", key: "sk-secret-should-not-leak" },
        github: { type: "oauth" },
      }),
    );
    const entries = await listAuthEntries(home);
    expect(entries).toEqual(
      expect.arrayContaining([
        { id: "anthropic", label: "Anthropic (Claude)", kind: "api_key" },
        { id: "github", label: "GitHub Copilot", kind: "oauth" },
      ]),
    );
    expect(JSON.stringify(entries)).not.toContain("sk-secret");
  });

  it("scans AGENTS.md and only project skills when trusted", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "mowen-resources-"));
    const cwd = path.join(home, "project");
    await mkdir(path.join(cwd, ".agents", "skills", "review"), { recursive: true });
    await mkdir(path.join(home, ".pi", "agent", "skills", "user-skill"), { recursive: true });
    await writeFile(path.join(cwd, "AGENTS.md"), "# agents");
    await writeFile(path.join(cwd, ".agents", "skills", "review", "SKILL.md"), "# review");
    await writeFile(path.join(home, ".pi", "agent", "skills", "user-skill", "SKILL.md"), "# user");

    const untrusted = await scanPiResources(cwd, home, false);
    expect(untrusted.agentsFiles.some((item) => item.kind === "agents")).toBe(true);
    expect(untrusted.skills.map((item) => item.name)).toEqual(["user-skill"]);

    const trusted = await scanPiResources(cwd, home, true);
    expect(trusted.skills.map((item) => item.name).sort()).toEqual(["review", "user-skill"]);
  });

  it("lists Pi session files and can filter by cwd", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "mowen-sessions-"));
    const cwd = path.join(home, "repo");
    const dir = path.join(home, ".pi", "agent", "sessions", "--repo--");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "2026-01-01_abc.jsonl"),
      [
        JSON.stringify({ type: "session", id: "abc", cwd }),
        JSON.stringify({
          type: "message",
          message: { role: "user", content: [{ type: "text", text: "hello from pi session" }] },
        }),
      ].join("\n"),
    );
    await writeFile(
      path.join(dir, "other.jsonl"),
      JSON.stringify({ type: "session", id: "other", cwd: path.join(home, "elsewhere") }),
    );
    const all = await listPiSessions(home);
    expect(all.some((item) => item.preview === "hello from pi session")).toBe(true);
    const filtered = await listPiSessions(home, cwd);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("abc");
  });

  it("flattens a Pi session tree", () => {
    const nodes = flattenSessionTree(
      [
        {
          entry: {
            type: "message",
            id: "user-0",
            parentId: null,
            message: { role: "user", content: [{ type: "text", text: "hi" }] },
          },
          children: [
            {
              entry: {
                type: "message",
                id: "asst-1",
                parentId: "user-0",
                message: { role: "assistant", content: [{ type: "text", text: "hello" }] },
              },
              children: [],
            },
          ],
        },
      ],
      "asst-1",
    );
    expect(nodes).toEqual([
      { id: "user-0", parentId: null, role: "user", text: "hi", leaf: false },
      { id: "asst-1", parentId: "user-0", role: "assistant", text: "hello", leaf: true },
    ]);
  });
});
