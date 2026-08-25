import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import type { RefObject } from "react";

type Props = {
  query: string;
  current: number;
  total: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

export function ConversationSearchBar({
  query,
  current,
  total,
  inputRef,
  onQueryChange,
  onPrev,
  onNext,
  onClose,
}: Props) {
  return (
    <div
      className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6"
      role="search"
    >
      <label className="search-field min-w-0 flex-1">
        <Search size={12} className="text-mute" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              if (event.shiftKey) onPrev();
              else onNext();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
          placeholder="在对话中查找"
          aria-label="在对话中查找"
          data-testid="conversation-search-input"
          className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-mute"
        />
      </label>
      <p className="shrink-0 font-mono text-[11px] tabular text-mute" aria-live="polite">
        {total > 0 ? `${current} / ${total}` : "无匹配"}
      </p>
      <button type="button" className="pressable icon-btn" aria-label="上一个匹配" onClick={onPrev}>
        <ChevronUp size={14} />
      </button>
      <button type="button" className="pressable icon-btn" aria-label="下一个匹配" onClick={onNext}>
        <ChevronDown size={14} />
      </button>
      <button type="button" className="pressable icon-btn" aria-label="关闭查找" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
