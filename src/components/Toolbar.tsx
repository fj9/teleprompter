import { ReactNode } from "react";
import { useSettings } from "../settingsContext";
import { ThemeToggle } from "./ThemeToggle";

interface ToolbarProps {
  slideLabel: string;
  onRestart: () => void;
  onExit: () => void;
  /** The mirror toggle only makes sense for screens that scroll a reader. */
  showMirror?: boolean;
  children?: ReactNode;
}

export function Toolbar({
  slideLabel,
  onRestart,
  onExit,
  showMirror = true,
  children,
}: ToolbarProps) {
  const { mirrored, increaseFontSize, decreaseFontSize, toggleMirrored } = useSettings();

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="btn" onClick={onExit} title="Esc">
          Exit
        </button>
        <button className="btn" onClick={onRestart} title="R">
          Restart
        </button>
        <span className="toolbar-slide-label">{slideLabel}</span>
      </div>
      <div className="toolbar-right">
        {children}
        <div className="toolbar-group" title="Up / Down arrow keys">
          <button className="btn" onClick={decreaseFontSize} aria-label="Decrease font size">
            A−
          </button>
          <button className="btn" onClick={increaseFontSize} aria-label="Increase font size">
            A+
          </button>
        </div>
        {showMirror && (
          <button className="btn" onClick={toggleMirrored} aria-pressed={mirrored}>
            {mirrored ? "Unmirror" : "Mirror"}
          </button>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
