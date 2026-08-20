import { useEffect, useRef, type KeyboardEvent } from "react";
import type { TaskStatus, ThinkingLevel } from "@mypi/protocol";
import { ImagePlus, Square } from "lucide-react";
import {
  approvalPolicies,
  interactionModes,
  type ApprovalPolicy,
  type InteractionMode,
} from "../../lib/interaction-policy";

type Props = {
  status: TaskStatus;
  disabled: boolean;
  models: Array<{ provider: string; id: string; name?: string }>;
  thinkingLevels: ThinkingLevel[];
  modelId: string | null;
  thinkingLevel: ThinkingLevel;
  mode: InteractionMode;
  approvalPolicy: ApprovalPolicy;
  hasTurns: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSteer: () => void;
  onFollowUp: () => void;
  onAbort: () => void;
  onModel: (provider: string, modelId: string) => void;
  onThinking: (level: ThinkingLevel) => void;
  onMode: (mode: InteractionMode) => void;
  onApprovalPolicy: (policy: ApprovalPolicy) => void;
  onImages: (files: FileList) => void;
  imageCount: number;
  contextEntries: Array<{ path: string; kind: "file" | "dir" }>;
  onRequestContext: () => void;
};

export function PromptComposer({
  status,
  disabled,
  models,
  thinkingLevels,
  modelId,
  thinkingLevel,
  mode,
  approvalPolicy,
  hasTurns,
  value,
  onChange,
  onSend,
  onSteer,
  onFollowUp,
  onAbort,
  onModel,
  onThinking,
  onMode,
  onApprovalPolicy,
  onImages,
  imageCount,
  contextEntries,
  onRequestContext,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const running = status === "running" || status === "waiting_approval" || status === "aborting";
  const followUp = status === "idle" && hasTurns;
  const atIndex = value.lastIndexOf("@");
  const contextQuery = atIndex >= 0 && !/\s/.test(value.slice(atIndex + 1))
    ? value.slice(atIndex + 1).toLowerCase()
    : null;
  const contextSuggestions = contextQuery == null
    ? []
    : contextEntries
        .filter((entry) => entry.path.toLowerCase().includes(contextQuery))
        .slice(0, 6);

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
          onChange={(event) => {
            const next = event.target.value;
            onChange(next);
            if (/(^|\s)@[^\s@]*$/.test(next)) onRequestContext();
          }}
          onKeyDown={onKeyDown}
          placeholder={running ? "Steer the current run" : "Send the next action"}
          aria-label="Prompt"
          disabled={disabled}
          className="max-h-[220px] min-h-[44px] w-full resize-none bg-transparent text-[15px] leading-6 text-ink placeholder:text-mute"
        />
        {contextQuery != null ? (
          <div className="mb-1 border-t border-line pt-2" role="listbox" aria-label="Project context">
            <p className="mb-1 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
              Add project context
            </p>
            {contextSuggestions.length > 0 ? (
              <div className="grid max-h-36 gap-1 overflow-y-auto">
                {contextSuggestions.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="pressable flex min-h-9 items-center gap-2 rounded-md px-2 text-left font-mono text-xs text-ink hover:bg-surface"
                    onClick={() => {
                      onChange(`${value.slice(0, atIndex)}@${entry.path} `);
                      ref.current?.focus();
                    }}
                  >
                    <span className="text-mute">{entry.kind === "dir" ? "DIR" : "FILE"}</span>
                    <span className="min-w-0 truncate">{entry.path}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-2 py-2 text-xs text-mute">No matching files. Keep typing to reference a path.</p>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <label className="sr-only" htmlFor="interaction-mode-select">
            Interaction mode
          </label>
          <select
            id="interaction-mode-select"
            className="h-10 rounded-md bg-surface px-2 text-xs font-medium text-ink"
            value={mode}
            title={interactionModes.find((item) => item.value === mode)?.description}
            onChange={(event) => onMode(event.target.value as InteractionMode)}
          >
            {interactionModes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="approval-policy-select">
            Approval policy
          </label>
          <select
            id="approval-policy-select"
            className="h-10 max-w-[180px] rounded-md bg-surface px-2 font-mono text-xs text-ink disabled:opacity-60"
            value={mode === "agent" ? approvalPolicy : "read_only"}
            disabled={mode !== "agent"}
            title={
              mode === "agent"
                ? approvalPolicies.find((item) => item.value === approvalPolicy)?.description
                : "This mode is read only"
            }
            onChange={(event) => onApprovalPolicy(event.target.value as ApprovalPolicy)}
          >
            {approvalPolicies.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
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
