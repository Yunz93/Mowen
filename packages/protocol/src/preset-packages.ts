export type PresetPiMcpServer = {
  name: string;
  command: string;
  args?: string[];
};

export type PresetPiPackage = {
  id: string;
  source: string;
  name: string;
  summary: string;
  aliases?: string[];
  mcp?: PresetPiMcpServer;
};

/** Community Pi packages Qingzhou offers as one-click presets. */
export const PRESET_PI_PACKAGES: readonly PresetPiPackage[] = [
  {
    id: "pi-web-access",
    source: "npm:pi-web-access",
    name: "pi-web-access",
    summary: "网页搜索、抓取链接、克隆 GitHub、提取 PDF，以及理解 YouTube / 本地视频。",
  },
  {
    id: "pi-memory",
    source: "npm:pi-memory",
    name: "pi-memory",
    summary: "长期记忆 MEMORY.md、每日日志和草稿本；装上 qmd 后可语义搜索。",
  },
  {
    id: "rpiv-todo",
    source: "npm:@juicesharp/rpiv-todo",
    name: "@juicesharp/rpiv-todo",
    aliases: ["rpiv-todo"],
    summary: "给模型一份待办清单，覆盖显示，会话重载和压缩后仍在。",
  },
  {
    id: "pi-subagents",
    source: "npm:pi-subagents",
    name: "pi-subagents",
    aliases: ["subagents"],
    summary: "按并行或串行拉起子代理，可隔离 worktree，带工作流和预算。",
  },
  {
    id: "pi-mcp-adapter",
    source: "npm:pi-mcp-adapter",
    name: "pi-mcp-adapter",
    aliases: ["mcp-adapter"],
    summary: "把 Pi 接到 MCP 服务器。按需发现工具，避免塞满上下文。",
  },
  {
    id: "context-mode",
    source: "npm:context-mode",
    name: "context-mode",
    summary: "压缩工具结果和文件读写内容，腾出上下文。经 MCP 接入。",
    mcp: {
      name: "context-mode",
      command: "npx",
      args: ["-y", "context-mode"],
    },
  },
];

export function normalizePackageSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("npm:") ||
    trimmed.startsWith("git:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("file:") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return `npm:${trimmed}`;
}

export function packageSourcesEqual(a: string, b: string): boolean {
  return normalizePackageSource(a).toLowerCase() === normalizePackageSource(b).toLowerCase();
}

export function presetExtensionNames(preset: PresetPiPackage): string[] {
  const names = new Set<string>([preset.id, preset.name, ...(preset.aliases ?? [])]);
  const source = normalizePackageSource(preset.source);
  if (source.startsWith("npm:")) names.add(source.slice(4));
  return [...names];
}

export function presetPackageInstalled(
  preset: PresetPiPackage,
  packages: Array<{ source: string }>,
  extensions: Array<{ name: string }> = [],
): boolean {
  if (packages.some((item) => packageSourcesEqual(item.source, preset.source))) return true;
  const names = new Set(presetExtensionNames(preset).map((name) => name.toLowerCase()));
  return extensions.some((item) => names.has(item.name.toLowerCase()));
}

export function resolvePresetPackages(ids?: string[] | null): PresetPiPackage[] {
  if (!ids?.length) return [...PRESET_PI_PACKAGES];
  const wanted = new Set(ids);
  const found = PRESET_PI_PACKAGES.filter((item) => wanted.has(item.id));
  if (found.length !== wanted.size) {
    const known = new Set(found.map((item) => item.id));
    const unknown = ids.filter((id) => !known.has(id));
    throw new Error(`未知的预置插件：${unknown.join("、")}`);
  }
  return found;
}
