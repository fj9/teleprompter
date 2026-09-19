import { Fragment, MutableRefObject, UIEvent, memo } from "react";
import type { Deck } from "../types";
import { BAND_FRACTION, BAND_HEIGHT_FRACTION } from "../hooks/useSlideBounds";
import { parseHoldSeconds, splitStageDirections } from "../utils/stageDirections";

// Memoized so the per-frame re-renders of the timed screen don't rebuild every word span.
const SlideBody = memo(function SlideBody({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, pi) => (
        <p key={pi}>
          {splitStageDirections(para).map((seg, si) => (
            <Fragment key={si}>
              {seg.stage
                ? <span className="stage-direction" data-hold={parseHoldSeconds(seg.text) ?? undefined}>{seg.text}</span>
                : seg.text.split(/(\s+)/).map((tok, ti) =>
                    tok === "" ? null : /^\s+$/.test(tok) ? (
                      tok
                    ) : (
                      <span key={ti} data-word>
                        {tok}
                      </span>
                    )
                  )}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
});

interface ReaderProps {
  deck: Deck;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  slideRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  interactive: boolean;
  fontSize: number;
  mirrored: boolean;
  activeIndex: number;
}

export function Reader({
  deck,
  containerRef,
  slideRefs,
  onScroll,
  interactive,
  fontSize,
  mirrored,
  activeIndex,
}: ReaderProps) {
  return (
    <div className="reader-viewport">
      <div
        className="reader-scroll"
        ref={containerRef}
        onScroll={interactive ? onScroll : undefined}
        style={{
          overflowY: interactive ? "auto" : "hidden",
          transform: mirrored ? "scaleX(-1)" : undefined,
        }}
      >
        <div className="reader-spacer" style={{ height: `${BAND_FRACTION * 100}%` }} aria-hidden />
        {deck.slides.map((slide, i) => (
          <div
            key={slide.index}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className={"reader-slide" + (i === activeIndex ? " reader-slide-active" : "")}
            style={{ fontSize: `${fontSize}px` }}
            data-slide-index={i}
          >
            {slide.title && <div className="reader-slide-title">{slide.title}</div>}
            <SlideBody text={slide.bodyText} />
          </div>
        ))}
        <div
          className="reader-spacer"
          style={{ height: `${(1 - BAND_FRACTION) * 100}%` }}
          aria-hidden
        />
      </div>
      <div
        className="reader-band"
        style={{
          top: `${BAND_FRACTION * 100}%`,
          height: `${BAND_HEIGHT_FRACTION * 100}%`,
        }}
        aria-hidden
      />
    </div>
  );
}
