import { HTMLAttributes, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Deck, SlideActual } from "../types";
import { Reader } from "../components/Reader";
import { SlideGutter } from "../components/SlideGutter";
import { Toolbar } from "../components/Toolbar";
import { scrollYAtTime, timeAtScrollY, useSlideBounds } from "../hooks/useSlideBounds";
import { useTimedEngine } from "../hooks/useTimedEngine";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useWakeLock } from "../hooks/useWakeLock";
import { useSettings } from "../settingsContext";
import { formatClock } from "../utils/format";

const SCROLL_EASE_SECONDS = 0.3;
const SEEK_SECONDS = 5;
/** Keeps a seek from landing exactly on the end of the last slide, which would finish the run. */
const END_MARGIN_SECONDS = 0.05;

interface TimedPracticeProps {
  deck: Deck;
  onComplete: (actuals: SlideActual[]) => void;
  onExit: () => void;
  onRestart: () => void;
}

export function TimedPractice({ deck, onComplete, onExit, onRestart }: TimedPracticeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const targetScroll = useRef<number | null>(null);
  const { fontSize, mirrored } = useSettings();
  const [multiplier, setMultiplier] = useState(1);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [finished, setFinished] = useState(false);
  const draggingRef = useRef(false);
  const dragPointer = useRef<{ id: number; lastY: number } | null>(null);

  const bounds = useSlideBounds(containerRef, slideRefs, deck.slides.length, [fontSize, mirrored]);
  const durations = useMemo(() => deck.slides.map((s) => s.targetSeconds), [deck]);

  const engine = useTimedEngine(durations, multiplier, paused || dragging, () => setFinished(true));
  const { seekTo } = engine;

  // Latest position, updated synchronously by seeks so rapid drag/wheel events chain correctly.
  const position = useRef({ index: 0, seconds: 0 });
  position.current = { index: engine.currentIndex, seconds: engine.elapsedInSlide };

  const applySeek = useCallback(
    (index: number, seconds: number) => {
      const clamped = Math.min(Math.max(seconds, 0), Math.max(0, durations[index] - END_MARGIN_SECONDS));
      position.current = { index, seconds: clamped };
      seekTo(index, clamped);
    },
    [durations, seekTo]
  );

  const seekBySeconds = useCallback(
    (delta: number) => {
      let { index, seconds } = position.current;
      seconds += delta;
      while (seconds < 0 && index > 0) {
        index--;
        seconds += durations[index];
      }
      while (index < durations.length - 1 && seconds >= durations[index]) {
        seconds -= durations[index];
        index++;
      }
      applySeek(index, seconds);
    },
    [durations, applySeek]
  );

  const seekByPixels = useCallback(
    (dy: number) => {
      if (!bounds) return;
      const { index: current, seconds } = position.current;
      const y = scrollYAtTime(bounds.scrollAnchors[current], seconds, durations[current]) + dy;
      let index = current;
      const endOf = (i: number) => bounds.scrollAnchors[i][bounds.scrollAnchors[i].length - 1].y;
      while (index > 0 && y < bounds.scrollAnchors[index][0].y) index--;
      while (index < durations.length - 1 && y > endOf(index)) index++;
      applySeek(index, timeAtScrollY(bounds.scrollAnchors[index], y, durations[index]));
    },
    [bounds, durations, applySeek]
  );

  const endDrag = useCallback(() => {
    dragPointer.current = null;
    draggingRef.current = false;
    setDragging(false);
  }, []);

  const seekHandlers: HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      dragPointer.current = { id: e.pointerId, lastY: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      setDragging(true);
    },
    onPointerMove: (e) => {
      const drag = dragPointer.current;
      if (!drag || drag.id !== e.pointerId) return;
      const dy = drag.lastY - e.clientY;
      drag.lastY = e.clientY;
      if (dy !== 0) seekByPixels(dy);
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onWheel: (e) => seekByPixels(e.deltaY),
  };

  useKeyboardShortcuts({
    onTogglePause: () => setPaused((p) => !p),
    onSeekBack: () => seekBySeconds(-SEEK_SECONDS),
    onSeekForward: () => seekBySeconds(SEEK_SECONDS),
    onRestart,
    onExit,
  });
  useWakeLock();

  useLayoutEffect(() => {
    if (!bounds) return;
    const y = scrollYAtTime(
      bounds.scrollAnchors[engine.currentIndex],
      engine.elapsedInSlide,
      durations[engine.currentIndex]
    );
    targetScroll.current = Math.max(0, y - bounds.bandOffsetPx);
  }, [bounds, engine.currentIndex, engine.elapsedInSlide, durations]);

  // Ease toward the target on every frame so speed changes (entering or leaving a hold, seeking)
  // don't feel abrupt, and so a seek made while paused still finishes scrolling. While a finger is
  // dragging the text it follows exactly, with no lag.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let pos: number | null = null;
    let applied: number | null = null;

    function tick(now: number) {
      const container = containerRef.current;
      const target = targetScroll.current;
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      if (container && target !== null) {
        if (pos === null || draggingRef.current || Math.abs(target - pos) > container.clientHeight) {
          pos = target;
        } else {
          pos += (target - pos) * (1 - Math.exp(-dt / SCROLL_EASE_SECONDS));
          if (Math.abs(target - pos) < 0.25) pos = target;
        }
        if (pos !== applied) {
          container.scrollTop = pos;
          applied = pos;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
          seekHandlers={seekHandlers}
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
          <div className="stat-row">
            <span className="stat-label">Overall</span>
            <span className="stat-value">
              {formatClock(sessionElapsedSeconds)} / {formatClock(runningTarget)}
            </span>
          </div>
          <div className="transport">
            <button
              className="btn btn-large"
              onClick={() => seekBySeconds(-SEEK_SECONDS)}
              aria-label={`Back ${SEEK_SECONDS} seconds`}
              title="Left arrow"
            >
              ◀ {SEEK_SECONDS}s
            </button>
            <button className="btn btn-large" onClick={() => setPaused((p) => !p)} title="Space">
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              className="btn btn-large"
              onClick={() => seekBySeconds(SEEK_SECONDS)}
              aria-label={`Forward ${SEEK_SECONDS} seconds`}
              title="Right arrow"
            >
              {SEEK_SECONDS}s ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
