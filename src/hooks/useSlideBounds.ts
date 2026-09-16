import { useLayoutEffect, useState, MutableRefObject } from "react";

/** Fraction of the viewport height at which the fixed reading band sits. */
export const BAND_FRACTION = 0.42;
/** Height of the reading band itself, as a fraction of viewport height. */
export const BAND_HEIGHT_FRACTION = 0.16;

export interface SlideBounds {
  /** scrollTop at which slide i's top reaches the band; boundaryScrollTop[N] is the end of the last slide. */
  boundaryScrollTop: number[];
  slideHeights: number[];
  bandOffsetPx: number;
  bandHeightPx: number;
  maxScroll: number;
}

/**
 * Measures cumulative slide offsets inside a scroll container so slide boundaries can be
 * expressed directly in scrollTop units. Slides are rendered as a continuous stacked flow with a
 * top spacer equal to the band offset, so boundaryScrollTop[i] = 0 lines slide 0 up with the band.
 */
export function useSlideBounds(
  containerRef: MutableRefObject<HTMLDivElement | null>,
  slideRefs: MutableRefObject<(HTMLDivElement | null)[]>,
  slideCount: number,
  watchDeps: unknown[]
): SlideBounds | null {
  const [bounds, setBounds] = useState<SlideBounds | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || slideCount === 0) return;

    function measure() {
      if (!container) return;
      const bandOffsetPx = container.clientHeight * BAND_FRACTION;
      const bandHeightPx = container.clientHeight * BAND_HEIGHT_FRACTION;
      const offsets: number[] = [];
      const heights: number[] = [];
      for (const el of slideRefs.current) {
        if (!el) continue;
        offsets.push(el.offsetTop);
        heights.push(el.offsetHeight);
      }
      if (offsets.length === 0) return;
      const boundaryScrollTop = offsets.map((o) => Math.max(0, o - bandOffsetPx));
      const lastIdx = offsets.length - 1;
      const endBoundary = offsets[lastIdx] + heights[lastIdx] - bandOffsetPx;
      boundaryScrollTop.push(Math.max(0, endBoundary));
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      setBounds({ boundaryScrollTop, slideHeights: heights, bandOffsetPx, bandHeightPx, maxScroll });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    for (const el of slideRefs.current) {
      if (el) ro.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, slideRefs, slideCount, ...watchDeps]);

  return bounds;
}
