export const TASK_STATUS: Record<string, string> = {
  queued: "排队中",
  booting: "正在启动",
  idle: "就绪",
  running: "正在回复",
  waiting_approval: "等待你确认",
  aborting: "正在停止",
  error: "出错了",
  stopped: "已结束",
};

export const TOOL_STATUS: Record<string, string> = {
  pending: "准备中",
  waiting_approval: "等待确认",
  running: "进行中",
  succeeded: "完成",
  failed: "失败",
  blocked: "已拒绝",
  aborted: "已停止",
};

export const TOOL_NAME: Record<string, string> = {
  write: "写入文件",
  edit: "修改文件",
  bash: "运行命令",
  read: "读取文件",
  grep: "搜索代码",
  find: "查找文件",
  ls: "列出文件",
};

export function taskStatusLabel(status: string): string {
  return TASK_STATUS[status] ?? status;
}

export function toolStatusLabel(status: string): string {
  return TOOL_STATUS[status] ?? status.replaceAll("_", " ");
}

export function toolNameLabel(name: string): string {
  return TOOL_NAME[name] ?? name;
}

export function folderName(cwd: string): string {
  const parts = cwd.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

export function nextHint(status: string, hasTask: boolean): string {
  if (!hasTask) return "从左侧选择会话，或点 + 开始聊天";
  if (status === "waiting_approval") return "请确认是否允许这次操作";
  if (status === "running") return "正在处理，可以直接停止";
  if (status === "error") return "出了点问题，发一条新消息再试试";
  if (status === "queued") return "正在等待空闲";
  if (status === "booting") return "正在启动";
  if (status === "aborting") return "正在停止";
  return "输入消息，回车发送。可用 @ 点文件";
}
