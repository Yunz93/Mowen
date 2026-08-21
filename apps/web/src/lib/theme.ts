export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ohmypi.theme";
export const THEME_EVENT = "ohmypi-theme";

const DARK_THEME_COLOR = "#181818";
const LIGHT_THEME_COLOR = "#f3f3f3";

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage can throw in private mode
  }
  return "dark";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore quota / private mode
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function toggleTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
