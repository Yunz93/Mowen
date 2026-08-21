import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { TaskStatus, ThinkingLevel } from "@ohmypi/protocol";
import { ImagePlus, Square } from "lucide-react";

type Props = {
  status: TaskStatus;
  disabled: boolean;
  models: Array<{ provider: string; id: string; name?: string }>;
  thinkingLevels: ThinkingLevel[];
  modelId: string | null;
  thinkingLevel: ThinkingLevel;
  hasTurns: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSteer: () => void;
  onFollowUp: () => void;
  onAbort: () => void;
  onModel: (provider: string, modelId: string) => void;
  onThinking: (level: ThinkingLevel) => void;
  onImages: (files: FileList) => void;
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

export function PromptComposer({
  status,
  disabled,
  models,
  thinkingLevels,
  modelId,
  thinkingLevel,
  hasTurns,
  value,
  onChange,
  onSend,
  onSteer,
  onFollowUp,
  onAbort,
  onModel,
  onThinking,
  onImages,
  imageCount,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const running = status === "running" || status === "waiting_approval" || status === "aborting";
  const followUp = status === "idle" && hasTurns;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    if (running) onSteer();
    else if (followUp) onFollowUp();
    else onSend();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[720px] rounded-3xl border border-line bg-elevated px-3 py-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={running ? "正在处理。可以直接发送补充，或点停止。" : "有什么想做的，直接说"}
          aria-label="输入消息"
          disabled={disabled}
          className="max-h-[220px] min-h-[44px] w-full resize-none bg-transparent text-[15px] leading-6 text-ink placeholder:text-mute"
        />
        {optionsOpen ? (
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <label className="sr-only" htmlFor="model-select">
              模型
            </label>
            <select
              id="model-select"
              className="h-10 max-w-[220px] rounded-full bg-surface px-3 text-xs text-ink"
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
              className="h-10 rounded-full bg-surface px-3 text-xs text-ink"
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
            className="pressable h-10 rounded-full px-3 text-sm text-mute hover:text-ink"
            onClick={() => setOptionsOpen((open) => !open)}
          >
            选项
          </button>
          <label className="pressable flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-mute hover:text-ink">
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
            <button
              type="button"
              className="pressable flex h-10 items-center gap-2 rounded-full px-3 text-sm text-danger"
              onClick={onAbort}
            >
              <Square size={12} fill="currentColor" />
              停止
            </button>
          ) : null}
          <button
            type="button"
            className="pressable h-10 rounded-full bg-accent px-4 text-sm font-medium text-canvas disabled:opacity-40"
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
