import { useCallback, useMemo, useRef, useState } from "react";
import type { SlideBounds } from "./useSlideBounds";

export interface FreestyleTimerState {
  /** Furthest slide reached so far (0-indexed); meaningful even while rereading earlier slides. */
  activeSlideIndex: number;
  /** Slide index implied by the current scroll position alone (can go backward on reread). */
  positionSlideIndex: number;
  isComplete: boolean;
  /** Locked-in actual seconds per slide, only present once both its boundaries are recorded. */
  actualSeconds: (number | null)[];
  liveElapsedActive: number;
  now: number;
}

/**
 * Tracks per-slide stopwatch state in freestyle mode by watching a stream of scrollTop values.
 * Only the first forward crossing of each slide boundary is ever recorded, so scrolling back to
 * reread never re-times or un-locks a slide that's already finished.
 */
export function useFreestyleTimer(slideCount: number) {
  const [timestamps, setTimestamps] = useState<(number | null)[]>(() => {
    const arr = new Array(slideCount + 1).fill(null);
    arr[0] = performance.now();
    return arr;
  });
  const [positionSlideIndex, setPositionSlideIndex] = useState(0);
  const [nowTick, setNowTick] = useState(() => performance.now());
  const timestampsRef = useRef(timestamps);
  timestampsRef.current = timestamps;

  const onScrollTop = useCallback(
    (scrollTop: number, bounds: SlideBounds) => {
      const crossedCount = bounds.boundaryScrollTop.filter((b) => scrollTop >= b - 1).length;
      const posIdx = Math.max(0, Math.min(slideCount - 1, crossedCount - 1));
      setPositionSlideIndex(posIdx);

      const current = timestampsRef.current;
      const recordedCount = current.filter((t) => t !== null).length;
      if (crossedCount > recordedCount) {
        const now = performance.now();
        const next = [...current];
        for (let j = recordedCount; j < crossedCount; j++) {
          next[j] = now;
        }
        setTimestamps(next);
      }
      setNowTick(performance.now());
    },
    [slideCount]
  );

  const tickNow = useCallback(() => setNowTick(performance.now()), []);

  const state: FreestyleTimerState = useMemo(() => {
    const recordedCount = timestamps.filter((t) => t !== null).length;
    const isComplete = recordedCount === slideCount + 1;
    const activeSlideIndex = Math.max(0, Math.min(slideCount - 1, recordedCount - 1));

    const actualSeconds: (number | null)[] = [];
    for (let i = 0; i < slideCount; i++) {
      const start = timestamps[i];
      const end = timestamps[i + 1];
      if (start !== null && end !== null) {
        actualSeconds.push((end - start) / 1000);
      } else {
        actualSeconds.push(null);
      }
    }

    const activeStart = timestamps[activeSlideIndex];
    const liveElapsedActive =
      !isComplete && activeStart !== null ? (nowTick - activeStart) / 1000 : 0;

    return {
      activeSlideIndex,
      positionSlideIndex,
      isComplete,
      actualSeconds,
      liveElapsedActive,
      now: nowTick,
    };
  }, [timestamps, positionSlideIndex, nowTick, slideCount]);

  return { state, onScrollTop, tickNow };
}
