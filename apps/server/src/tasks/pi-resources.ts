import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PiResources } from "@mowen/protocol";

const CONTEXT_NAMES = [
  { name: "AGENTS.override.md", kind: "override" as const },
  { name: "AGENTS.md", kind: "agents" as const },
  { name: "CLAUDE.md", kind: "claude" as const },
  { name: "SYSTEM.md", kind: "system" as const },
  { name: "APPEND_SYSTEM.md", kind: "append" as const },
];

async function exists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkParents(cwd: string): Promise<string[]> {
  const dirs: string[] = [];
  let current = path.resolve(cwd);
  const root = path.parse(current).root;
  while (true) {
    dirs.push(current);
    if (current === root) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}

async function listSkillDirs(dir: string, scope: "user" | "project"): Promise<PiResources["skills"]> {
  try {
    const names = await readdir(dir);
    const skills: PiResources["skills"] = [];
    for (const name of names) {
      const skillMd = path.join(dir, name, "SKILL.md");
      if (await exists(skillMd)) skills.push({ name, path: skillMd, scope });
    }
    return skills;
  } catch {
    return [];
  }
}

async function listTemplates(dir: string, scope: "user" | "project"): Promise<PiResources["templates"]> {
  try {
    const names = await readdir(dir);
    return names
      .filter((name) => name.endsWith(".md"))
      .map((name) => ({
        name: name.replace(/\.md$/i, ""),
        path: path.join(dir, name),
        scope,
      }));
  } catch {
    return [];
  }
}

export async function scanPiResources(
  cwd: string,
  homeDir: string,
  trustProject: boolean,
): Promise<PiResources> {
  const agentsFiles: PiResources["agentsFiles"] = [];
  const globalDir = path.join(homeDir, ".pi", "agent");
  for (const item of CONTEXT_NAMES) {
    const full = path.join(globalDir, item.name);
    if (await exists(full)) agentsFiles.push({ path: full, kind: item.kind });
  }

  const dirs = await walkParents(cwd);
  for (const dir of dirs) {
    let usedOverride = false;
    for (const item of CONTEXT_NAMES) {
      if (item.kind === "system" || item.kind === "append") continue;
      const full = path.join(dir, item.name);
      if (!(await exists(full))) continue;
      if (item.kind === "override") usedOverride = true;
      if (usedOverride && (item.kind === "agents" || item.kind === "claude")) continue;
      agentsFiles.push({ path: full, kind: item.kind });
    }
    const projectSystem = path.join(dir, ".pi", "SYSTEM.md");
    const projectAppend = path.join(dir, ".pi", "APPEND_SYSTEM.md");
    if (await exists(projectSystem)) agentsFiles.push({ path: projectSystem, kind: "system" });
    if (await exists(projectAppend)) agentsFiles.push({ path: projectAppend, kind: "append" });
  }

  const skills = [
    ...(await listSkillDirs(path.join(homeDir, ".pi", "agent", "skills"), "user")),
    ...(await listSkillDirs(path.join(homeDir, ".agents", "skills"), "user")),
  ];
  const templates = await listTemplates(path.join(homeDir, ".pi", "agent", "prompts"), "user");
  if (trustProject) {
    skills.push(
      ...(await listSkillDirs(path.join(cwd, ".pi", "skills"), "project")),
      ...(await listSkillDirs(path.join(cwd, ".agents", "skills"), "project")),
    );
    templates.push(...(await listTemplates(path.join(cwd, ".pi", "prompts"), "project")));
  }

  return { agentsFiles, skills, templates, trustProject };
}
