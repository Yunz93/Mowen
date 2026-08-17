import { useEffect, useRef, type KeyboardEvent } from "react";
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
  const running = status === "running" || status === "waiting_approval" || status === "aborting";
  const followUp = status === "idle" && hasTurns;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (running) onSteer();
      else if (followUp) onFollowUp();
      else onSend();
    }
  };

  const actionLabel = running ? "Steer" : followUp ? "Follow-up" : "Send";
  const action = running ? onSteer : followUp ? onFollowUp : onSend;

  return (
    <div className="border-t border-line bg-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[720px] rounded-lg bg-elevated px-3 py-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={running ? "Steer the current run" : "Send the next action"}
          aria-label="Prompt"
          disabled={disabled}
          className="max-h-[220px] min-h-[44px] w-full resize-none bg-transparent text-[15px] leading-6 text-ink placeholder:text-mute"
        />
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <label className="sr-only" htmlFor="model-select">
            Model
          </label>
          <select
            id="model-select"
            className="h-10 max-w-[220px] rounded-md bg-surface px-2 font-mono text-xs text-ink"
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
            Thinking level
          </label>
          <select
            id="thinking-select"
            className="h-10 rounded-md bg-surface px-2 font-mono text-xs text-ink"
            value={thinkingLevel}
            onChange={(event) => onThinking(event.target.value as ThinkingLevel)}
          >
            {thinkingLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <label className="pressable flex h-10 w-10 cursor-pointer items-center justify-center text-mute">
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
            <span className="sr-only">Attach images</span>
          </label>
          {imageCount > 0 ? <span className="font-mono text-[11px] text-mute tabular">{imageCount} img</span> : null}
          <div className="flex-1" />
          {running ? (
            <button
              type="button"
              className="pressable flex h-10 items-center gap-2 rounded-md px-3 text-sm text-danger"
              onClick={onAbort}
            >
              <Square size={12} fill="currentColor" />
              Stop
            </button>
          ) : null}
          <button
            type="button"
            className="pressable h-10 rounded-md bg-accent px-4 text-sm font-medium text-canvas disabled:opacity-40"
            onClick={action}
            disabled={disabled || !value.trim()}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
