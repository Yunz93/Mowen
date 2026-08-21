import { useEffect, useState } from "react";
import { persistTheme, readTheme, THEME_EVENT, type Theme } from "../lib/theme";

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const onChange = () => setTheme(readTheme());
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);

  return [theme, persistTheme];
}
