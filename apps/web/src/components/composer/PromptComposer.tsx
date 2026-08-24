import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { ApprovalPolicy, InteractionMode, TaskStatus, ThinkingLevel } from "@mowen/protocol";
import { approvalPolicies, interactionModes } from "@mowen/protocol";
import { ImagePlus, Square } from "lucide-react";

type FileEntry = { path: string; name: string; kind: "file" | "dir" };
type CommandItem = { name: string; description?: string; source?: string };

type Props = {
  status: TaskStatus;
  disabled: boolean;
  models: Array<{ provider: string; id: string; name?: string }>;
  thinkingLevels: ThinkingLevel[];
  modelId: string | null;
  thinkingLevel: ThinkingLevel;
  mode: InteractionMode;
  approvalPolicy: ApprovalPolicy;
  files: FileEntry[];
  commands: CommandItem[];
  hasTurns: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSteer: () => void;
  onFollowUp: () => void;
  onAbort: () => void;
  onModel: (provider: string, modelId: string) => void;
  onThinking: (level: ThinkingLevel) => void;
  onPolicy: (mode: InteractionMode, approvalPolicy: ApprovalPolicy) => void;
  onImages: (files: FileList) => void;
  onNeedFiles: () => void;
  imageCount: number;
};

const THINKING_LABEL: Record<ThinkingLevel, string> = {
  off: "关闭",
  minimal: "很少",
  low: "较低",
  medium: "中等",
  high: "较高",
  xhigh: "很高",
  max: "最大",
};

function mentionQuery(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const match = before.match(/@([^\s@]*)$/);
  if (!match || match.index === undefined) return null;
  return { start: match.index, query: match[1] ?? "" };
}

function slashQuery(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const match = before.match(/(^|\s)\/([^\s]*)$/);
  if (!match || match.index === undefined) return null;
  return { start: match.index + (match[1] ?? "").length, query: match[2] ?? "" };
}

export function PromptComposer({
  status,
  disabled,
  models,
  thinkingLevels,
  modelId,
  thinkingLevel,
  mode,
  approvalPolicy,
  files,
  commands,
  hasTurns,
  value,
  onChange,
  onSend,
  onSteer,
  onFollowUp,
  onAbort,
  onModel,
  onThinking,
  onPolicy,
  onImages,
  onNeedFiles,
  imageCount,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [caret, setCaret] = useState(0);
  const running = status === "running" || status === "waiting_approval" || status === "aborting";
  const followUp = status === "idle" && hasTurns;
  const mention = mentionQuery(value, caret);
  const slash = !mention ? slashQuery(value, caret) : null;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
  }, [value]);

  useEffect(() => {
    if (mention) onNeedFiles();
  }, [mention, onNeedFiles]);

  const fileHits = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return files
      .filter((entry) => entry.kind === "file" && (!q || entry.path.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [files, mention]);

  const commandHits = useMemo(() => {
    if (!slash) return [];
    const q = slash.query.toLowerCase();
    return commands
      .filter((item) => item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [commands, slash]);

  const submit = () => {
    if (running) onSteer();
    else if (followUp) onFollowUp();
    else onSend();
  };

  const insert = (start: number, from: string, text: string) => {
    const next = `${value.slice(0, start)}${text}${value.slice(start + from.length)}`;
    onChange(next);
    requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) return;
      const pos = start + text.length;
      node.focus();
      node.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !mention && !slash) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="relative mx-auto max-w-[720px] rounded-md border border-line bg-elevated px-3 py-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setCaret(event.target.selectionStart);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          placeholder={running ? "正在处理。可以直接发送补充，或点停止。" : "有什么想做的，直接说。用 @ 点文件，用 / 找技能"}
          aria-label="输入消息"
          disabled={disabled}
          className="max-h-[220px] min-h-[44px] w-full resize-none bg-transparent text-[15px] leading-6 text-ink placeholder:text-mute"
        />
        {fileHits.length > 0 ? (
          <ul className="absolute bottom-full left-3 z-20 mb-1 max-h-48 w-[min(420px,calc(100%-24px))] overflow-auto rounded-md border border-line bg-elevated shadow-dialog">
            {fileHits.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  className="pressable hover-fill block h-10 w-full truncate px-3 text-left font-mono text-xs text-ink"
                  onClick={() => mention && insert(mention.start, `@${mention.query}`, `@${entry.path} `)}
                >
                  {entry.path}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {commandHits.length > 0 ? (
          <ul className="absolute bottom-full left-3 z-20 mb-1 max-h-48 w-[min(420px,calc(100%-24px))] overflow-auto rounded-md border border-line bg-elevated shadow-dialog">
            {commandHits.map((item) => (
              <li key={item.name}>
                <button
                  type="button"
                  className="pressable hover-fill block h-10 w-full truncate px-3 text-left text-xs text-ink"
                  onClick={() => slash && insert(slash.start, `/${slash.query}`, `/${item.name} `)}
                >
                  /{item.name}
                  {item.description ? <span className="ml-2 text-mute">{item.description}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {optionsOpen ? (
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <label className="sr-only" htmlFor="mode-select">
              模式
            </label>
            <select
              id="mode-select"
              className="field h-10 rounded-sm bg-canvas px-3 text-xs text-ink"
              value={mode}
              onChange={(event) => onPolicy(event.target.value as InteractionMode, approvalPolicy)}
            >
              {interactionModes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="policy-select">
              审批
            </label>
            <select
              id="policy-select"
              className="field h-10 rounded-sm bg-canvas px-3 text-xs text-ink"
              value={approvalPolicy}
              disabled={mode !== "agent"}
              onChange={(event) => onPolicy(mode, event.target.value as ApprovalPolicy)}
            >
              {approvalPolicies.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="model-select">
              模型
            </label>
            <select
              id="model-select"
              className="field h-10 max-w-[220px] rounded-sm bg-canvas px-3 text-xs text-ink"
              value={modelId ?? ""}
              onChange={(event) => {
                const [provider, ...rest] = event.target.value.split("/");
                onModel(provider ?? "", rest.join("/"));
              }}
            >
              {models.map((model) => (
                <option key={`${model.provider}/${model.id}`} value={`${model.provider}/${model.id}`}>
                  {model.name ?? model.id}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="thinking-select">
              思考深度
            </label>
            <select
              id="thinking-select"
              className="field h-10 rounded-sm bg-canvas px-3 text-xs text-ink"
              value={thinkingLevel}
              onChange={(event) => onThinking(event.target.value as ThinkingLevel)}
            >
              {thinkingLevels.map((level) => (
                <option key={level} value={level}>
                  思考：{THINKING_LABEL[level] ?? level}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className="pressable btn btn-ghost min-w-0 px-3"
            onClick={() => setOptionsOpen((open) => !open)}
          >
            选项
          </button>
          <span className="text-[12px] text-mute">
            {interactionModes.find((item) => item.value === mode)?.label}
            {mode === "agent"
              ? ` · ${approvalPolicies.find((item) => item.value === approvalPolicy)?.label}`
              : " · 只读"}
          </span>
          <label className="pressable icon-btn cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              multiple
              onChange={(event) => {
                if (event.target.files) onImages(event.target.files);
              }}
            />
            <ImagePlus size={16} />
            <span className="sr-only">添加图片</span>
          </label>
          {imageCount > 0 ? <span className="text-[12px] text-mute">{imageCount} 张图</span> : null}
          <div className="flex-1" />
          {running ? (
            <button type="button" className="pressable btn btn-danger gap-2" onClick={onAbort}>
              <Square size={12} fill="currentColor" />
              停止
            </button>
          ) : null}
          <button
            type="button"
            className="pressable btn btn-primary"
            onClick={submit}
            disabled={disabled || !value.trim()}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
