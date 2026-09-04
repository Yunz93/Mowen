export function shortcutLabel(keys: string): string {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return keys
    .split("+")
    .map((part) => {
      if (part === "Mod") return mac ? "⌘" : "Ctrl";
      if (part === "Shift") return mac ? "⇧" : "Shift";
      if (part === "Alt") return mac ? "⌥" : "Alt";
      if (part === "Backslash") return "\\";
      if (part === "BracketLeft") return "[";
      if (part === "BracketRight") return "]";
      if (part === "Comma") return ",";
      if (part === "Period") return ".";
      return part;
    })
    .join(mac ? "" : "+");
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
