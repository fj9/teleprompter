import { formatDelta } from "../utils/format";

/** deltaSeconds = expected-so-far minus actual-so-far. Positive means moving faster than planned. */
export function PaceIndicator({ deltaSeconds }: { deltaSeconds: number }) {
  const ahead = deltaSeconds > 1.5;
  const behind = deltaSeconds < -1.5;
  const label = ahead ? "Ahead of pace" : behind ? "Behind pace" : "On pace";
  const icon = ahead ? "▲" : behind ? "▼" : "●";
  const cls = ahead ? "pace-ahead" : behind ? "pace-behind" : "pace-onpace";

  return (
    <div className={`pace-indicator ${cls}`} role="status">
      <span className="pace-icon" aria-hidden>
        {icon}
      </span>
      <span className="pace-label">{label}</span>
      <span className="pace-delta">{formatDelta(deltaSeconds)}</span>
    </div>
  );
}
