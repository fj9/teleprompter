import { useEffect } from "react";
import { useSettings } from "../settingsContext";

export interface ShortcutHandlers {
  onTogglePause?: () => void;
  onSeekBack?: () => void;
  onSeekForward?: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function useKeyboardShortcuts({
  onTogglePause,
  onSeekBack,
  onSeekForward,
  onRestart,
  onExit,
}: ShortcutHandlers) {
  const { increaseFontSize, decreaseFontSize } = useSettings();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          if (onTogglePause) {
            e.preventDefault();
            onTogglePause();
          }
          break;
        case "ArrowLeft":
          if (onSeekBack) {
            e.preventDefault();
            onSeekBack();
          }
          break;
        case "ArrowRight":
          if (onSeekForward) {
            e.preventDefault();
            onSeekForward();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          increaseFontSize();
          break;
        case "ArrowDown":
          e.preventDefault();
          decreaseFontSize();
          break;
        case "r":
        case "R":
          onRestart();
          break;
        case "Escape":
          onExit();
          break;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onTogglePause, onSeekBack, onSeekForward, onRestart, onExit, increaseFontSize, decreaseFontSize]);
}
