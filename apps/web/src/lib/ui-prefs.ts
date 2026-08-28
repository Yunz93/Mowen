export const LEFT_PINNED_KEY = "mowen.ui.leftPinned";
export const RIGHT_PINNED_KEY = "mowen.ui.rightPinned";
export const INSPECTOR_OPEN_KEY = "mowen.ui.inspectorOpen";

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
