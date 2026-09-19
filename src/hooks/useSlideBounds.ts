import { useLayoutEffect, useState, MutableRefObject } from "react";

/** Fraction of the viewport height at which the fixed reading band sits. */
export const BAND_FRACTION = 0.42;
/** Height of the reading band itself, as a fraction of viewport height. */
export const BAND_HEIGHT_FRACTION = 0.16;

/**
 * A point on a slide's scroll path: content y offset `y` is reached after `w` word units
 * (spoken words, plus fixed spans for untimed stage-only lines) and `s` seconds of timed holds.
 */
export interface ScrollAnchor {
  w: number;
  s: number;
  y: number;
}

export interface SlideBounds {
  /** scrollTop at which slide i's top reaches the band; boundaryScrollTop[N] is the end of the last slide. */
  boundaryScrollTop: number[];
  /** Per slide, piecewise-linear anchors from slide top to slide bottom. */
  scrollAnchors: ScrollAnchor[][];
  bandOffsetPx: number;
  bandHeightPx: number;
  maxScroll: number;
}

/** Scroll time given to each line of an untimed stage-only paragraph, in spoken-word units (~1.5s). */
const STAGE_LINE_HOLD_WORDS = 3;
/** Spoken words always keep at least this share of a slide's time, even if holds add up to more. */
const MIN_WORD_TIME_SHARE = 0.2;

/**
 * Paragraphs scroll at an even speed and get one word unit per spoken word, so bracketed stage
 * directions inside them cost no time. A paragraph of only stage directions lingers in the band:
 * for as many seconds as it asks for ("[pause 5 seconds]"), or a small fixed span per line if it
 * gives none. A timed direction in the middle of a spoken paragraph stops the scroll for its
 * seconds at that spot. The slide's title and padding above the first paragraph, and the padding
 * below the last, get virtual word units at the slide's average density so speed stays even
 * across slide boundaries.
 */
function buildScrollAnchors(
  slideEl: HTMLElement,
  toY: (viewportTop: number) => number
): ScrollAnchor[] {
  const slideRect = slideEl.getBoundingClientRect();
  const top = toY(slideRect.top);
  const bottom = toY(slideRect.bottom);
  const paras = Array.from(slideEl.querySelectorAll("p"));
  if (paras.length === 0) return [{ w: 0, s: 0, y: top }, { w: 1, s: 0, y: bottom }];

  const cs = getComputedStyle(slideEl);
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.6;
  const firstWord = slideEl.querySelector("[data-word]");
  const wordHeight = firstWord ? firstWord.getBoundingClientRect().height : lineHeight * 0.7;

  let w = 0;
  let s = 0;
  const chain: ScrollAnchor[] = [];
  let endY = bottom;

  for (const para of paras) {
    const r = para.getBoundingClientRect();
    const yTop = toY(r.top);
    const marginBottom = parseFloat(getComputedStyle(para).marginBottom) || 0;
    endY = toY(r.bottom) + marginBottom;
    chain.push({ w, s, y: yTop });

    const marks = Array.from(para.querySelectorAll<HTMLElement>("[data-word], [data-hold]"));
    const hasWords = marks.some((m) => m.hasAttribute("data-word"));

    if (!hasWords) {
      const seconds = marks.reduce((sum, m) => sum + (parseFloat(m.dataset.hold ?? "") || 0), 0);
      if (seconds > 0) s += seconds;
      else w += Math.max(1, Math.round(r.height / lineHeight)) * STAGE_LINE_HOLD_WORDS;
      continue;
    }

    let prevY = yTop;
    for (const m of marks) {
      if (m.hasAttribute("data-word")) {
        w++;
        continue;
      }
      const rect = m.getClientRects()[0] ?? m.getBoundingClientRect();
      const y = Math.min(endY, Math.max(prevY, toY(rect.top + rect.height / 2) - wordHeight / 2));
      chain.push({ w, s, y });
      s += parseFloat(m.dataset.hold ?? "") || 0;
      chain.push({ w, s, y });
      prevY = y;
    }
  }

  endY = Math.min(bottom, endY);
  const firstY = chain[0].y;
  const pxPerWord = (endY - firstY) / w;
  const lead = pxPerWord > 0 ? Math.max(0, (firstY - top) / pxPerWord) : 0;
  const trail = pxPerWord > 0 ? Math.max(0, (bottom - endY) / pxPerWord) : 0;

  return [
    { w: 0, s: 0, y: top },
    ...chain.map((a) => ({ ...a, w: a.w + lead })),
    { w: lead + w, s, y: endY },
    { w: lead + w + trail, s, y: bottom },
  ];
}

/**
 * Converts anchors to seconds for a slide of `durationSeconds`. Timed holds keep their stated
 * seconds and spoken words share the rest, so pauses don't speed up or slow down the speech.
 */
function anchorTimes(anchors: ScrollAnchor[], durationSeconds: number) {
  const last = anchors[anchors.length - 1];
  const wordSeconds = Math.max(durationSeconds - last.s, durationSeconds * MIN_WORD_TIME_SHARE);
  const holdScale = last.s > 0 ? Math.min(1, (durationSeconds - wordSeconds) / last.s) : 1;
  const secondsPerWord = last.w > 0 ? wordSeconds / last.w : 0;
  return (a: ScrollAnchor) => a.s * holdScale + a.w * secondsPerWord;
}

/** Content y offset for a slide `elapsedSeconds` into its `durationSeconds`. */
export function scrollYAtTime(
  anchors: ScrollAnchor[],
  elapsedSeconds: number,
  durationSeconds: number
): number {
  if (durationSeconds <= 0) return anchors[0].y;
  const timeAt = anchorTimes(anchors, durationSeconds);
  const last = anchors[anchors.length - 1];
  const t = Math.min(Math.max(elapsedSeconds, 0), timeAt(last));
  for (let j = 1; j < anchors.length; j++) {
    const a = anchors[j - 1];
    const b = anchors[j];
    const tb = timeAt(b);
    if (t <= tb) {
      const ta = timeAt(a);
      return tb === ta ? b.y : a.y + ((b.y - a.y) * (t - ta)) / (tb - ta);
    }
  }
  return last.y;
}

/** Inverse of scrollYAtTime: seconds into the slide at which content offset `y` is reached. */
export function timeAtScrollY(anchors: ScrollAnchor[], y: number, durationSeconds: number): number {
  if (durationSeconds <= 0 || y <= anchors[0].y) return 0;
  const timeAt = anchorTimes(anchors, durationSeconds);
  for (let j = 1; j < anchors.length; j++) {
    const a = anchors[j - 1];
    const b = anchors[j];
    if (y <= b.y) {
      const ta = timeAt(a);
      return b.y === a.y ? ta : ta + ((timeAt(b) - ta) * (y - a.y)) / (b.y - a.y);
    }
  }
  return timeAt(anchors[anchors.length - 1]);
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
      const containerTop = container.getBoundingClientRect().top;
      const scrollTop = container.scrollTop;
      const toY = (viewportTop: number) => viewportTop - containerTop + scrollTop;
      const offsets: number[] = [];
      const heights: number[] = [];
      const scrollAnchors: ScrollAnchor[][] = [];
      for (const el of slideRefs.current) {
        if (!el) continue;
        offsets.push(el.offsetTop);
        heights.push(el.offsetHeight);
        scrollAnchors.push(buildScrollAnchors(el, toY));
      }
      if (offsets.length === 0) return;
      const boundaryScrollTop = offsets.map((o) => Math.max(0, o - bandOffsetPx));
      const lastIdx = offsets.length - 1;
      const endBoundary = offsets[lastIdx] + heights[lastIdx] - bandOffsetPx;
      boundaryScrollTop.push(Math.max(0, endBoundary));
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      setBounds({ boundaryScrollTop, scrollAnchors, bandOffsetPx, bandHeightPx, maxScroll });
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
