import type { Theme } from "./theme";

export type TermPalette = {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};

const DARK_TERM: TermPalette = {
  background: "#2c2c31",
  foreground: "#ececf1",
  cursor: "#8bb4ff",
  cursorAccent: "#2c2c31",
  selectionBackground: "#4c6cb3",
  black: "#1c1c1e",
  red: "#ff6b6b",
  green: "#63d48e",
  yellow: "#e6c36a",
  blue: "#7eb6ff",
  magenta: "#c792ea",
  cyan: "#7ad4d4",
  white: "#ececf1",
  brightBlack: "#8e8e93",
  brightRed: "#ff8a80",
  brightGreen: "#80e0a7",
  brightYellow: "#f0d48a",
  brightBlue: "#9ec6ff",
  brightMagenta: "#d7a8f0",
  brightCyan: "#95e0e0",
  brightWhite: "#ffffff",
};

const LIGHT_TERM: TermPalette = {
  background: "#f3f3f6",
  foreground: "#2a2a33",
  cursor: "#3b6fd9",
  cursorAccent: "#f3f3f6",
  selectionBackground: "#c5d4f5",
  black: "#2a2a33",
  red: "#c23b3b",
  green: "#1a7f4c",
  yellow: "#9a6b12",
  blue: "#2f62c4",
  magenta: "#7a4bb8",
  cyan: "#1f7a7a",
  white: "#f3f3f6",
  brightBlack: "#6e6e78",
  brightRed: "#d45353",
  brightGreen: "#2a9a5f",
  brightYellow: "#b07c1a",
  brightBlue: "#4b7ad6",
  brightMagenta: "#9260cc",
  brightCyan: "#2d9090",
  brightWhite: "#1c1c1e",
};

export function termTheme(theme: Theme): TermPalette {
  return theme === "dark" ? DARK_TERM : LIGHT_TERM;
}
