import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PiResources } from "@mowen/protocol";
import { defaultPiAgentDir } from "../setup/pi-agent-dir.js";
import { isInsideRoot } from "../security/path-policy.js";

const CONTEXT_NAMES = [
  { name: "AGENTS.override.md", kind: "override" as const },
  { name: "AGENTS.md", kind: "agents" as const },
  { name: "CLAUDE.md", kind: "claude" as const },
  { name: "SYSTEM.md", kind: "system" as const },
  { name: "APPEND_SYSTEM.md", kind: "append" as const },
];

export const RESOURCE_CONTENT_MAX = 200_000;

export const PROJECT_AGENTS_TEMPLATE = `# AGENTS.md

给在这个项目里工作的编程助手看的说明。

## 约定

-
`;

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
      if (await exists(skillMd)) skills.push({ name, path: skillMd, scope, enabled: true });
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
        enabled: true,
      }));
  } catch {
    return [];
  }
}

export async function scanPiResources(
  cwd: string,
  homeDir: string,
  trustProject: boolean,
  agentDir = defaultPiAgentDir(homeDir),
): Promise<PiResources> {
  const agentsFiles: PiResources["agentsFiles"] = [];
  const globalDir = agentDir;
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
    ...(await listSkillDirs(path.join(agentDir, "skills"), "user")),
    ...(await listSkillDirs(path.join(homeDir, ".agents", "skills"), "user")),
  ];
  const templates = await listTemplates(path.join(agentDir, "prompts"), "user");
  if (trustProject) {
    skills.push(
      ...(await listSkillDirs(path.join(cwd, ".pi", "skills"), "project")),
      ...(await listSkillDirs(path.join(cwd, ".agents", "skills"), "project")),
    );
    templates.push(...(await listTemplates(path.join(cwd, ".pi", "prompts"), "project")));
  }

  const excluded = new Set([
    ...(await skillExclusions(path.join(agentDir, "settings.json"), agentDir, homeDir)),
    ...(await skillExclusions(path.join(cwd, ".pi", "settings.json"), path.join(cwd, ".pi"), homeDir)),
  ]);
  for (const skill of skills) {
    skill.enabled = !excluded.has(path.resolve(path.dirname(skill.path)));
  }

  return { agentsFiles, skills, templates, trustProject };
}

/** Create project-root AGENTS.md once; returns the relative path. */
export async function createProjectAgentsFile(cwd: string): Promise<string> {
  const relative = "AGENTS.md";
  const target = path.join(path.resolve(cwd), relative);
  try {
    await writeFile(target, PROJECT_AGENTS_TEMPLATE, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("AGENTS.md 已存在");
    }
    throw error;
  }
  return relative;
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${path.basename(filePath)} 不是对象`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function expandHome(value: string, homeDir: string): string {
  if (value === "~") return homeDir;
  if (value.startsWith("~/")) return path.join(homeDir, value.slice(2));
  return value;
}

async function skillExclusions(settingsPath: string, baseDir: string, homeDir: string): Promise<string[]> {
  let settings: Record<string, unknown>;
  try {
    settings = await readJsonObject(settingsPath);
  } catch {
    return [];
  }
  const skills = settings.skills;
  if (!Array.isArray(skills)) return [];
  const out: string[] = [];
  for (const item of skills) {
    if (typeof item !== "string" || !item.startsWith("-")) continue;
    const rest = item.slice(1).trim();
    if (!rest) continue;
    out.push(path.resolve(baseDir, expandHome(rest, homeDir)));
  }
  return out;
}

function skillMarker(skillDir: string, baseDir: string): string {
  const relative = path.relative(baseDir, skillDir);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return `-${relative}`;
  }
  return `-${skillDir}`;
}

function isSameSkillMarker(item: string, skillDir: string, baseDir: string, homeDir: string): boolean {
  if (!item.startsWith("-")) return false;
  const rest = item.slice(1).trim();
  if (!rest) return false;
  return path.resolve(baseDir, expandHome(rest, homeDir)) === path.resolve(skillDir);
}

export async function setSkillEnabled(input: {
  skillMdPath: string;
  enabled: boolean;
  cwd: string;
  homeDir: string;
  agentDir: string;
  scope: "user" | "project";
}): Promise<void> {
  const skillDir = path.dirname(path.resolve(input.skillMdPath));
  const settingsPath =
    input.scope === "user"
      ? path.join(input.agentDir, "settings.json")
      : path.join(input.cwd, ".pi", "settings.json");
  const baseDir = path.dirname(settingsPath);
  const settingsRoot = input.scope === "user" ? input.homeDir : path.resolve(input.cwd);
  if (!isInsideRoot(path.resolve(settingsPath), path.resolve(settingsRoot))) {
    throw new Error("技能设置文件路径不合法");
  }
  await mkdir(baseDir, { recursive: true });
  const settings = await readJsonObject(settingsPath);
  const current = Array.isArray(settings.skills) ? settings.skills.filter((item) => typeof item === "string") : [];
  const next = current.filter((item) => !isSameSkillMarker(item, skillDir, baseDir, input.homeDir));
  if (!input.enabled) next.push(skillMarker(skillDir, baseDir));
  settings.skills = next;
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export async function readContextFile(filePath: string): Promise<{ content: string; truncated: boolean }> {
  const buffer = await readFile(filePath);
  return {
    content: buffer.subarray(0, RESOURCE_CONTENT_MAX).toString("utf8"),
    truncated: buffer.byteLength > RESOURCE_CONTENT_MAX,
  };
}

export async function writeContextFile(filePath: string, content: string): Promise<void> {
  if (content.length > RESOURCE_CONTENT_MAX) {
    throw new Error("文件太大，没法在这里保存。");
  }
  await writeFile(filePath, content, "utf8");
}
