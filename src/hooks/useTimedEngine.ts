import { useEffect, useRef, useState } from "react";

export interface TimedEngineState {
  currentIndex: number;
  /** Simulated (multiplier-scaled) seconds elapsed within the current slide. */
  elapsedInSlide: number;
  /** Real, unpaused wall-clock seconds spent on each slide so far — used for the summary. */
  realElapsedPerSlide: number[];
  done: boolean;
}

export function useTimedEngine(
  slideDurations: number[],
  multiplier: number,
  paused: boolean,
  onComplete: () => void
): TimedEngineState {
  const [state, setState] = useState<TimedEngineState>(() => ({
    currentIndex: 0,
    elapsedInSlide: 0,
    realElapsedPerSlide: new Array(slideDurations.length).fill(0),
    done: false,
  }));

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const multiplierRef = useRef(multiplier);
  multiplierRef.current = multiplier;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let rafId: number;
    let lastTs: number | null = null;

    function frame(ts: number) {
      if (lastTs === null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.25);
      lastTs = ts;

      if (!pausedRef.current) {
        setState((prev) => {
          if (prev.done) return prev;
          let currentIndex = prev.currentIndex;
          let elapsedInSlide = prev.elapsedInSlide;
          let done: boolean = prev.done;
          const realElapsedPerSlide = [...prev.realElapsedPerSlide];
          realElapsedPerSlide[currentIndex] += dt;
          elapsedInSlide += dt * multiplierRef.current;

          while (!done && elapsedInSlide >= slideDurations[currentIndex]) {
            elapsedInSlide -= slideDurations[currentIndex];
            if (currentIndex < slideDurations.length - 1) {
              currentIndex++;
            } else {
              elapsedInSlide = 0;
              done = true;
              queueMicrotask(() => onCompleteRef.current());
            }
          }

          return { currentIndex, elapsedInSlide, realElapsedPerSlide, done };
        });
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideDurations]);

  return state;
}
