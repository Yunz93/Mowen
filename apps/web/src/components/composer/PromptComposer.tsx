import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import type { ApprovalPolicy, InteractionMode, TaskStatus, ThinkingLevel } from "@mowen/protocol";
import { extractAtMentions } from "@mowen/protocol";
import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import { composerCanSubmit, filesFromClipboard, shouldSubmitOnEnter } from "../../lib/composer-input";
import { composerPlaceholder } from "../../copy";
import { ComposerCapsules } from "./ComposerCapsules";
import { MentionMenu, type MentionItem } from "./MentionMenu";

type FileEntry = { path: string; name: string; kind: "file" | "dir" };
type CommandItem = { name: string; description?: string; source?: string };
export type ComposerImage = { id: string; previewUrl: string; name: string };

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
  onImages: (files: FileList | File[]) => void;
  onRemoveImage: (id: string) => void;
  onNeedFiles: () => void;
  images: ComposerImage[];
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
  onRemoveImage,
  onNeedFiles,
  images,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const [caret, setCaret] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const running = status === "running" || status === "waiting_approval" || status === "aborting";
  const followUp = status === "idle" && hasTurns;
  const mention = mentionQuery(value, caret);
  const slash = !mention ? slashQuery(value, caret) : null;
  const attachedCount = extractAtMentions(value).length;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 180)}px`;
  }, [value]);

  useEffect(() => {
    if (mention) onNeedFiles();
  }, [mention, onNeedFiles]);

  const fileHits = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return files
      .filter((entry) => entry.kind === "file" && (!q || entry.path.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((entry) => ({ id: entry.path, primary: entry.path }));
  }, [files, mention]);

  const commandHits = useMemo(() => {
    if (!slash) return [];
    const q = slash.query.toLowerCase();
    return commands
      .filter((item) => item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q))
      .slice(0, 8)
      .map((item) => ({ id: item.name, primary: `/${item.name}`, secondary: item.description }));
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

  const pickMention = (item: MentionItem) => {
    if (mention) insert(mention.start, `@${mention.query}`, `@${item.primary} `);
    else if (slash) insert(slash.start, `/${slash.query}`, `${item.primary} `);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) return;
    if (event.key === "Enter" && event.shiftKey && running && !composingRef.current) {
      event.preventDefault();
      onFollowUp();
      return;
    }
    if (!shouldSubmitOnEnter(event, composingRef.current)) return;
    event.preventDefault();
    submit();
  };

  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    const pasted = filesFromClipboard(event.clipboardData);
    if (pasted.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onImages(pasted);
  };

  return (
    <div className="px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-1">
      <div
        className="composer-well relative mx-auto max-w-[720px] px-3 py-2"
        onPaste={onPaste}
        onMouseDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (disabled) return;
          event.preventDefault();
          ref.current?.focus();
        }}
      >
        {images.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 pt-0.5 pb-1" aria-label={`已添加 ${images.length} 张图`}>
            {images.map((image) => (
              <li key={image.id} className="relative">
                <img
                  src={image.previewUrl}
                  alt={image.name}
                  className="h-14 w-14 rounded-md bg-fill object-cover"
                />
                <button
                  type="button"
                  className="pressable absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-elevated text-mute shadow-dialog"
                  aria-label={`移除 ${image.name}`}
                  onClick={() => onRemoveImage(image.id)}
                >
                  <X size={10} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setCaret(event.target.selectionStart);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            window.setTimeout(() => {
              composingRef.current = false;
            }, 0);
          }}
          placeholder={composerPlaceholder(running)}
          aria-label="输入消息"
          disabled={disabled}
          className="max-h-[180px] min-h-[40px] w-full resize-none bg-transparent py-1.5 pr-10 text-[15px] leading-6 text-ink placeholder:text-mute"
        />
        {fileHits.length > 0 ? (
          <MentionMenu items={fileHits} label="文件" onPick={pickMention} onNavigate={setMenuOpen} />
        ) : null}
        {commandHits.length > 0 ? (
          <MentionMenu items={commandHits} label="命令" onPick={pickMention} onNavigate={setMenuOpen} />
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5 pb-0.5 pt-0.5">
          <ComposerCapsules
            mode={mode}
            approvalPolicy={approvalPolicy}
            models={models}
            modelId={modelId}
            thinkingLevel={thinkingLevel}
            thinkingLevels={thinkingLevels}
            onPolicy={onPolicy}
            onModel={onModel}
            onThinking={onThinking}
          />
          <label className="pressable icon-btn cursor-pointer" aria-label="添加图片">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              multiple
              onChange={(event) => {
                if (event.target.files) onImages(event.target.files);
                event.target.value = "";
              }}
            />
            <ImagePlus size={15} />
          </label>
          {attachedCount > 0 ? (
            <span className="text-[11px] text-mute">{attachedCount} 个文件</span>
          ) : null}
          <div className="flex-1" />
          {running ? (
            <button
              type="button"
              className="pressable btn btn-ghost"
              onClick={onFollowUp}
              disabled={disabled || !composerCanSubmit(value, images.length)}
              title="排队下一条（Shift+Enter）"
            >
              排队
            </button>
          ) : null}
          {running ? (
            <button type="button" className="pressable send-btn send-btn-stop" onClick={onAbort} aria-label="停止">
              <Square size={10} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className="pressable send-btn"
              onClick={submit}
              disabled={disabled || !composerCanSubmit(value, images.length)}
              aria-label="发送"
              title="发送"
            >
              <ArrowUp size={15} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
