export const LEFT_PINNED_KEY = "mowen.ui.leftPinned";
export const RIGHT_PINNED_KEY = "mowen.ui.rightPinned";
export const INSPECTOR_OPEN_KEY = "mowen.ui.inspectorOpen";
export const INSPECTOR_WIDTH_KEY = "mowen.ui.inspectorWidth";
export const BOARD_SHOW_ARCHIVED_KEY = "mowen.ui.boardShowArchived";

export const INSPECTOR_WIDTH_MIN = 320;
export const INSPECTOR_WIDTH_DEFAULT = 360;

export function readUiFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // localStorage can throw in private mode
  }
  return fallback;
}

export function writeUiFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

export function readUiNumber(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored == null) return fallback;
    const value = Number(stored);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeUiNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore quota / private mode
  }
}

export function clampInspectorWidth(width: number, viewport = typeof window === "undefined" ? 1280 : window.innerWidth): number {
  const max = Math.max(INSPECTOR_WIDTH_MIN, Math.floor(viewport * 0.6));
  return Math.min(max, Math.max(INSPECTOR_WIDTH_MIN, Math.round(width)));
}
