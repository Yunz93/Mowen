import { useEffect, useRef, useState } from "react";
import type { ApprovalPolicy, InteractionMode, ThinkingLevel } from "@qingzhou/protocol";
import { approvalPolicies, interactionModes } from "@qingzhou/protocol";
import { ChevronDown } from "lucide-react";

const THINKING_LABEL: Record<ThinkingLevel, string> = {
  off: "关闭",
  minimal: "很少",
  low: "较低",
  medium: "中等",
  high: "较高",
  xhigh: "很高",
  max: "最大",
};

type Model = { provider: string; id: string; name?: string };

type Props = {
  slot: "mode" | "model";
  mode: InteractionMode;
  approvalPolicy: ApprovalPolicy;
  models: Model[];
  modelId: string | null;
  thinkingLevel: ThinkingLevel;
  thinkingLevels: ThinkingLevel[];
  onPolicy: (mode: InteractionMode, approvalPolicy: ApprovalPolicy) => void;
  onModel: (provider: string, modelId: string) => void;
  onThinking: (level: ThinkingLevel) => void;
  fastModeEnabled?: boolean;
  fastModeActive?: boolean;
  onFastMode?: (enabled: boolean) => void;
};

export function ComposerCapsules({
  slot,
  mode,
  approvalPolicy,
  models,
  modelId,
  thinkingLevel,
  thinkingLevels,
  onPolicy,
  onModel,
  onThinking,
  fastModeEnabled,
  fastModeActive,
  onFastMode,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const modeLabel = interactionModes.find((item) => item.value === mode)?.label ?? mode;
  const policyLabel = approvalPolicies.find((item) => item.value === approvalPolicy)?.label ?? approvalPolicy;
  const currentModel = models.find((model) => `${model.provider}/${model.id}` === modelId);
  const modelLabel = currentModel?.name ?? currentModel?.id ?? (models.length === 0 ? "暂无模型" : "选择模型");
  const thinkingLabel = THINKING_LABEL[thinkingLevel] ?? thinkingLevel;
  const showFast = typeof fastModeEnabled === "boolean" && onFastMode;
  const fastOn = fastModeActive === true || (fastModeActive !== false && fastModeEnabled === true);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (slot === "mode") {
    return (
      <div ref={rootRef} className="relative min-w-0">
        <button
          type="button"
          className="pressable composer-capsule"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="模式"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="min-w-0 truncate">
            {mode === "agent" ? `${modeLabel} · ${policyLabel}` : `${modeLabel} · 只读`}
          </span>
          <ChevronDown size={12} strokeWidth={2} className="shrink-0 opacity-70" />
        </button>
        {open ? (
          <div className="composer-popover" role="menu" aria-label="模式">
            {interactionModes.map((item) => (
              <button
                key={item.value}
                type="button"
                role="menuitem"
                className={`pressable composer-popover-item ${mode === item.value ? "composer-popover-active" : ""}`}
                onClick={() => {
                  onPolicy(item.value, item.value === "agent" ? approvalPolicy : "read_only");
                  if (item.value !== "agent") setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
            {mode === "agent" ? (
              <>
                <div className="composer-popover-sep" />
                {approvalPolicies.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="menuitem"
                    className={`pressable composer-popover-item ${approvalPolicy === item.value ? "composer-popover-active" : ""}`}
                    onClick={() => {
                      onPolicy(mode, item.value);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        className="pressable composer-capsule"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="模型和思考"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate">
          {modelLabel}
          {thinkingLevel !== "off" ? ` · ${thinkingLabel}` : ""}
          {showFast && fastOn ? " · Fast" : ""}
        </span>
        <ChevronDown size={12} strokeWidth={2} className="shrink-0 opacity-70" />
      </button>
      {open ? (
        <div className="composer-popover composer-popover-end" role="menu" aria-label="模型和思考">
          {models.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-mute">暂无模型</p>
          ) : (
            models.map((model) => {
              const id = `${model.provider}/${model.id}`;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  className={`pressable composer-popover-item ${id === modelId ? "composer-popover-active" : ""}`}
                  onClick={() => onModel(model.provider, model.id)}
                >
                  {model.name ?? model.id}
                </button>
              );
            })
          )}
          <div className="composer-popover-sep" />
          {thinkingLevels.map((level) => (
            <button
              key={level}
              type="button"
              role="menuitem"
              className={`pressable composer-popover-item ${thinkingLevel === level ? "composer-popover-active" : ""}`}
              onClick={() => {
                onThinking(level);
                setOpen(false);
              }}
            >
              思考：{THINKING_LABEL[level] ?? level}
            </button>
          ))}
          {showFast ? (
            <>
              <div className="composer-popover-sep" />
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={fastOn}
                className={`pressable composer-popover-item ${fastOn ? "composer-popover-active" : ""}`}
                onClick={() => {
                  onFastMode?.(!fastModeEnabled);
                  setOpen(false);
                }}
              >
                Fast 模式{fastOn ? " · 开" : " · 关"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
