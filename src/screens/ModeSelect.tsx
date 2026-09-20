import type { Deck, Mode } from "../types";
import { formatDuration } from "../parser";

interface ModeSelectProps {
  deck: Deck;
  onChoose: (mode: Mode) => void;
  onBack: () => void;
}

export function ModeSelect({ deck, onChoose, onBack }: ModeSelectProps) {
  return (
    <div className="screen mode-select-screen">
      <button className="btn-link back-link" onClick={onBack}>
        ← {deck.title}
      </button>
      <h1>How do you want to rehearse?</h1>
      <p className="subtitle">
        {deck.slides.length} slides · {formatDuration(deck.totalTargetSeconds)} target
      </p>

      <div className="mode-cards">
        <button className="mode-card" onClick={() => onChoose("freestyle")}>
          <h2>Freestyle</h2>
          <p>Scroll and read at your own pace. The app times each slide against its budget and
            tells you, live, whether you're ahead or behind.</p>
        </button>
        <button className="mode-card" onClick={() => onChoose("timed")}>
          <h2>Timed</h2>
          <p>The app auto-scrolls each slide at the speed needed to hit its target. Keeping up
            with the line is the pacing exercise.</p>
        </button>
        <button className="mode-card" onClick={() => onChoose("memorize")}>
          <h2>Memorize</h2>
          <p>Learn it by heart. Words fade into gaps, then only the opening words of each
            sentence, then blank. Tap a gap to check yourself.</p>
        </button>
      </div>
    </div>
  );
}
