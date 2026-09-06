import { useEffect, useState } from "react";

export type MentionItem = {
  id: string;
  primary: string;
  secondary?: string;
};

type Props = {
  items: MentionItem[];
  label: string;
  onPick: (item: MentionItem) => void;
  onNavigate?: (active: boolean) => void;
};

export function MentionMenu({ items, label, onPick, onNavigate }: Props) {
  const [index, setIndex] = useState(0);
  const safeIndex = items.length === 0 ? 0 : Math.min(index, items.length - 1);

  useEffect(() => {
    setIndex(0);
  }, [items]);

  useEffect(() => {
    onNavigate?.(items.length > 0);
    return () => onNavigate?.(false);
  }, [items.length, onNavigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (items.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((current) => (current + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((current) => (current - 1 + items.length) % items.length);
      } else if (event.key === "Enter" && !event.shiftKey) {
        const item = items[safeIndex];
        if (!item) return;
        event.preventDefault();
        onPick(item);
      } else if (event.key === "Escape") {
        event.preventDefault();
        onNavigate?.(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [items, onNavigate, onPick, safeIndex]);

  if (items.length === 0) return null;

  return (
    <ul
      className="mention-menu"
      role="listbox"
      aria-label={label}
    >
      {items.map((item, itemIndex) => {
        const fileName = item.primary.replaceAll("\\", "/").split("/").pop() ?? item.primary;
        const dir = item.primary === fileName ? "" : item.primary.slice(0, Math.max(0, item.primary.length - fileName.length));
        return (
          <li key={item.id} role="option" aria-selected={itemIndex === safeIndex}>
            <button
              type="button"
              className={`pressable mention-item ${itemIndex === safeIndex ? "mention-item-active" : ""}`}
              onMouseEnter={() => setIndex(itemIndex)}
              onClick={() => onPick(item)}
            >
              {dir ? (
                <span className="mention-item-path">
                  <span className="text-mute">{dir}</span>
                  <span>{fileName}</span>
                </span>
              ) : (
                <span className="mention-item-path">{item.primary}</span>
              )}
              {item.secondary ? <span className="mention-item-desc">{item.secondary}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
