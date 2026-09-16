import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { savePersisted } from "./storage";

export const MIN_FONT_SIZE = 18;
export const MAX_FONT_SIZE = 72;
const FONT_STEP = 4;

interface SettingsValue {
  fontSize: number;
  mirrored: boolean;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  toggleMirrored: () => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({
  initialFontSize,
  initialMirrored,
  children,
}: {
  initialFontSize: number;
  initialMirrored: boolean;
  children: ReactNode;
}) {
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [mirrored, setMirrored] = useState(initialMirrored);

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

  return (
    <SettingsContext.Provider
      value={{ fontSize, mirrored, increaseFontSize, decreaseFontSize, toggleMirrored }}
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
