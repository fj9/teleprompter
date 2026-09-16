import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Deck, SlideActual } from "../types";
import { Reader } from "../components/Reader";
import { SlideGutter } from "../components/SlideGutter";
import { Toolbar } from "../components/Toolbar";
import { useSlideBounds } from "../hooks/useSlideBounds";
import { useTimedEngine } from "../hooks/useTimedEngine";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useSettings } from "../settingsContext";
import { formatClock } from "../utils/format";

interface TimedPracticeProps {
  deck: Deck;
  onComplete: (actuals: SlideActual[]) => void;
  onExit: () => void;
  onRestart: () => void;
}

export function TimedPractice({ deck, onComplete, onExit, onRestart }: TimedPracticeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { fontSize, mirrored } = useSettings();
  const [multiplier, setMultiplier] = useState(1);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);

  const bounds = useSlideBounds(containerRef, slideRefs, deck.slides.length, [fontSize, mirrored]);
  const durations = useMemo(() => deck.slides.map((s) => s.targetSeconds), [deck]);

  const engine = useTimedEngine(durations, multiplier, paused, () => setFinished(true));

  useKeyboardShortcuts({
    onTogglePause: () => setPaused((p) => !p),
    onRestart,
    onExit,
  });

  useLayoutEffect(() => {
    if (!bounds || !containerRef.current) return;
    const { currentIndex, elapsedInSlide } = engine;
    const duration = durations[currentIndex] || 1;
    const slideFraction = Math.min(1, elapsedInSlide / duration);
    const target =
      bounds.boundaryScrollTop[currentIndex] + slideFraction * bounds.slideHeights[currentIndex];
    containerRef.current.scrollTop = target;
  }, [bounds, engine, durations]);

  function buildActuals(): SlideActual[] {
    return deck.slides.map((_, i) => {
      const completed = i < engine.currentIndex || engine.done;
      return {
        slideIndex: i,
        actualSeconds: completed ? engine.realElapsedPerSlide[i] : 0,
        completed,
      };
    });
  }

  useLayoutEffect(() => {
    if (finished) onComplete(buildActuals());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function handleEndEarly() {
    onComplete(buildActuals());
  }

  const activeSlide = deck.slides[engine.currentIndex];
  const sessionElapsedSeconds = engine.realElapsedPerSlide.reduce((a, b) => a + b, 0);
  const runningTarget = durations.slice(0, engine.currentIndex + 1).reduce((a, b) => a + b, 0);

  return (
    <div className="practice-screen">
      <Toolbar
        slideLabel={`Slide ${engine.currentIndex + 1} of ${deck.slides.length}`}
        onRestart={onRestart}
        onExit={onExit}
      >
        <div className="toolbar-group">
          <label className="speed-label">
            Speed
            <input
              type="range"
              min={80}
              max={150}
              step={5}
              value={Math.round(multiplier * 100)}
              onChange={(e) => setMultiplier(Number(e.target.value) / 100)}
            />
            <span>{Math.round(multiplier * 100)}%</span>
          </label>
        </div>
        <button className="btn" onClick={() => setPaused((p) => !p)} title="Space">
          {paused ? "Resume" : "Pause"}
        </button>
        <button className="btn" onClick={handleEndEarly}>
          End &amp; review
        </button>
      </Toolbar>

      <div className="practice-body">
        <SlideGutter
          slides={deck.slides}
          totalTargetSeconds={deck.totalTargetSeconds}
          activeIndex={engine.currentIndex}
          sessionElapsedSeconds={sessionElapsedSeconds}
        />

        <Reader
          deck={deck}
          containerRef={containerRef}
          slideRefs={slideRefs}
          interactive={false}
          fontSize={fontSize}
          mirrored={mirrored}
          activeIndex={engine.currentIndex}
        />

        <div className="stats-panel">
          {paused && <div className="paused-banner">Paused</div>}
          <div className="stat-row">
            <span className="stat-label">This slide</span>
            <span className="stat-value">
              {formatClock(engine.realElapsedPerSlide[engine.currentIndex] ?? 0)} /{" "}
              {formatClock(activeSlide.targetSeconds)}
            </span>
          </div>
          <div className="stat-row stat-row-divider">
            <span className="stat-label">Overall</span>
            <span className="stat-value">
              {formatClock(sessionElapsedSeconds)} / {formatClock(runningTarget)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
