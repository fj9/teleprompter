import type { Slide } from "../types";
import { formatClock } from "../utils/format";

interface SlideGutterProps {
  slides: Slide[];
  totalTargetSeconds: number;
  activeIndex: number;
  sessionElapsedSeconds: number;
}

export function SlideGutter({
  slides,
  totalTargetSeconds,
  activeIndex,
  sessionElapsedSeconds,
}: SlideGutterProps) {
  const total = Math.max(1, totalTargetSeconds);
  const nowPct = Math.min(100, Math.max(0, (sessionElapsedSeconds / total) * 100));
  let cumulative = 0;

  return (
    <div className="gutter">
      <div className="gutter-track">
        {slides.map((s, i) => {
          const startPct = (cumulative / total) * 100;
          const heightPct = (s.targetSeconds / total) * 100;
          cumulative += s.targetSeconds;
          return (
            <div
              key={s.index}
              className={"gutter-segment" + (i === activeIndex ? " gutter-segment-active" : "")}
              style={{ top: `${startPct}%`, height: `${heightPct}%` }}
              title={`Slide ${i + 1}${s.title ? ": " + s.title : ""} — target ${formatClock(
                s.targetSeconds
              )}`}
            >
              <span className="gutter-label">{i + 1}</span>
              <span className="gutter-time">{formatClock(s.targetSeconds)}</span>
            </div>
          );
        })}
        <div
          className="gutter-now"
          style={{ top: `${nowPct}%` }}
          title={`Now: ${formatClock(sessionElapsedSeconds)}`}
        />
      </div>
    </div>
  );
}
