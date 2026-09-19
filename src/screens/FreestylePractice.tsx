import { useEffect, useRef, useState } from "react";
import type { Deck, SlideActual } from "../types";
import { Reader } from "../components/Reader";
import { SlideGutter } from "../components/SlideGutter";
import { PaceIndicator } from "../components/PaceIndicator";
import { Toolbar } from "../components/Toolbar";
import { useSlideBounds } from "../hooks/useSlideBounds";
import { useFreestyleTimer } from "../hooks/useFreestyleTimer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useWakeLock } from "../hooks/useWakeLock";
import { useSettings } from "../settingsContext";
import { formatClock, formatDelta } from "../utils/format";

interface FreestylePracticeProps {
  deck: Deck;
  onComplete: (actuals: SlideActual[]) => void;
  onExit: () => void;
  onRestart: () => void;
}

export function FreestylePractice({ deck, onComplete, onExit, onRestart }: FreestylePracticeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { fontSize, mirrored } = useSettings();
  const [scrollTop, setScrollTop] = useState(0);

  const bounds = useSlideBounds(containerRef, slideRefs, deck.slides.length, [fontSize, mirrored]);
  const { state, onScrollTop, tickNow } = useFreestyleTimer(deck.slides.length);

  useWakeLock();
  useKeyboardShortcuts({ onRestart, onExit });

  useEffect(() => {
    const id = window.setInterval(tickNow, 200);
    return () => window.clearInterval(id);
  }, [tickNow]);

  useEffect(() => {
    if (state.isComplete) {
      const actuals: SlideActual[] = deck.slides.map((_, i) => ({
        slideIndex: i,
        actualSeconds: state.actualSeconds[i] ?? 0,
        completed: state.actualSeconds[i] !== null,
      }));
      onComplete(actuals);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isComplete]);

  function handleScroll() {
    const top = containerRef.current?.scrollTop ?? 0;
    setScrollTop(top);
    if (bounds) onScrollTop(top, bounds);
  }

  function handleEndEarly() {
    const actuals: SlideActual[] = deck.slides.map((_, i) => ({
      slideIndex: i,
      actualSeconds: state.actualSeconds[i] ?? (i === state.activeSlideIndex ? state.liveElapsedActive : 0),
      completed: state.actualSeconds[i] !== null,
    }));
    onComplete(actuals);
  }

  const activeSlide = deck.slides[state.activeSlideIndex];
  const activeIdx = state.activeSlideIndex;

  let fraction = 0;
  if (bounds) {
    const start = bounds.boundaryScrollTop[activeIdx];
    const end = bounds.boundaryScrollTop[activeIdx + 1];
    fraction = end > start ? Math.min(1, Math.max(0, (scrollTop - start) / (end - start))) : 0;
  }
  const expectedElapsed = fraction * activeSlide.targetSeconds;
  const delta = expectedElapsed - state.liveElapsedActive;

  let runningElapsed = 0;
  let runningTarget = 0;
  for (let i = 0; i <= activeIdx; i++) {
    runningTarget += deck.slides[i].targetSeconds;
    runningElapsed += i < activeIdx ? state.actualSeconds[i] ?? 0 : state.liveElapsedActive;
  }

  const sessionElapsedSeconds =
    state.actualSeconds.reduce((sum: number, v) => sum + (v ?? 0), 0) +
    (state.isComplete ? 0 : state.liveElapsedActive);

  return (
    <div className="practice-screen">
      <Toolbar
        slideLabel={`Slide ${activeIdx + 1} of ${deck.slides.length}`}
        onRestart={onRestart}
        onExit={onExit}
      >
        <button className="btn" onClick={handleEndEarly}>
          End &amp; review
        </button>
      </Toolbar>

      <div className="practice-body">
        <SlideGutter
          slides={deck.slides}
          totalTargetSeconds={deck.totalTargetSeconds}
          activeIndex={state.positionSlideIndex}
          sessionElapsedSeconds={sessionElapsedSeconds}
        />

        <Reader
          deck={deck}
          containerRef={containerRef}
          slideRefs={slideRefs}
          onScroll={handleScroll}
          interactive
          fontSize={fontSize}
          mirrored={mirrored}
          activeIndex={state.positionSlideIndex}
        />

        <div className="stats-panel">
          <PaceIndicator deltaSeconds={delta} />
          <div className="stat-row">
            <span className="stat-label">This slide</span>
            <span className="stat-value">
              {formatClock(state.liveElapsedActive)} / {formatClock(activeSlide.targetSeconds)}
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Delta</span>
            <span className="stat-value">{formatDelta(delta)}</span>
          </div>
          <div className="stat-row stat-row-divider">
            <span className="stat-label">Overall</span>
            <span className="stat-value">
              {formatClock(runningElapsed)} / {formatClock(runningTarget)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
