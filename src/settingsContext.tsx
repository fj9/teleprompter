import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { savePersisted } from "./storage";

export const MIN_FONT_SIZE = 18;
export const MAX_FONT_SIZE = 72;
const FONT_STEP = 4;

export type Theme = "light" | "dark";

export function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

interface SettingsValue {
  fontSize: number;
  mirrored: boolean;
  theme: Theme;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleMirrored: () => void;
  toggleTheme: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({
  initialFontSize,
  initialMirrored,
  initialTheme,
  children,
}: {
  initialFontSize: number;
  initialMirrored: boolean;
  initialTheme: Theme | null;
  children: ReactNode;
}) {
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [mirrored, setMirrored] = useState(initialMirrored);
  const [theme, setTheme] = useState<Theme>(() => initialTheme ?? systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [theme]);

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.min(MAX_FONT_SIZE, prev + FONT_STEP);
      savePersisted({ fontSize: next });
      return next;
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.max(MIN_FONT_SIZE, prev - FONT_STEP);
      savePersisted({ fontSize: next });
      return next;
    });
  }, []);

  const toggleMirrored = useCallback(() => {
    setMirrored((prev) => {
      const next = !prev;
      savePersisted({ mirrored: next });
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      savePersisted({ theme: next });
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        fontSize,
        mirrored,
        theme,
        increaseFontSize,
        decreaseFontSize,
        toggleMirrored,
        toggleTheme,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
