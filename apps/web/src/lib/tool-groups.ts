import type { ToolExecution } from "@mowen/protocol";

const READ_ONLY_TOOLS = new Set(["read", "grep", "glob", "ls", "find"]);

export type ToolTimelineEntry =
  | { kind: "single"; tool: ToolExecution }
  | { kind: "group"; tools: ToolExecution[] };

export function isReadOnlyTool(name: string): boolean {
  return READ_ONLY_TOOLS.has(name);
}

export function groupToolExecutions(tools: ToolExecution[]): ToolTimelineEntry[] {
  const entries: ToolTimelineEntry[] = [];
  let pending: ToolExecution[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    if (pending.length === 1) {
      const tool = pending[0];
      if (tool) entries.push({ kind: "single", tool });
    } else {
      entries.push({ kind: "group", tools: pending });
    }
    pending = [];
  };

  for (const tool of tools) {
    if (isReadOnlyTool(tool.toolName)) {
      pending.push(tool);
      continue;
    }
    flush();
    entries.push({ kind: "single", tool });
  }
  flush();
  return entries;
}

export function toolGroupLabel(tools: ToolExecution[]): string {
  const files = tools.filter((tool) => tool.toolName === "read" || tool.toolName === "ls").length;
  if (files === tools.length) return `读取了 ${tools.length} 个文件`;
  const searches = tools.filter((tool) => tool.toolName === "grep" || tool.toolName === "find" || tool.toolName === "glob").length;
  if (searches === tools.length) return `搜索了 ${tools.length} 处`;
  return `${tools.length} 次只读操作`;
}
