import type { Deck, SlideActual } from "../types";
import { formatClock, formatDelta, formatWpm } from "../utils/format";

interface SummaryProps {
  deck: Deck;
  actuals: SlideActual[];
  onRestart: () => void;
  onNewFile: () => void;
  onChooseMode: () => void;
}

export function Summary({ deck, actuals, onRestart, onNewFile, onChooseMode }: SummaryProps) {
  const fullTarget = deck.slides.reduce((sum, s) => sum + s.targetSeconds, 0);
  const completedCount = actuals.filter((a) => a.completed).length;
  const allCompleted = completedCount === deck.slides.length;
  // When the session ended early, scope the total row to the slides actually run —
  // comparing a partial actual against the full deck target would misleadingly read as a huge pace lead.
  const totalTarget = allCompleted
    ? fullTarget
    : deck.slides.reduce((sum, s, i) => sum + (actuals[i]?.completed ? s.targetSeconds : 0), 0);
  const totalActual = actuals.reduce((sum, a) => sum + (a.completed ? a.actualSeconds : 0), 0);
  const anyCompleted = completedCount > 0;

  return (
    <div className="screen summary-screen">
      <h1>Session summary</h1>
      <p className="subtitle">
        {deck.title}
        {!allCompleted && ` · ended early after ${completedCount} of ${deck.slides.length} slides (full deck target ${formatClock(fullTarget)})`}
      </p>

      <table className="slide-table summary-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Target</th>
            <th>Actual</th>
            <th>Delta</th>
            <th>WPM</th>
          </tr>
        </thead>
        <tbody>
          {deck.slides.map((s) => {
            const a = actuals[s.index];
            const completed = a?.completed ?? false;
            const delta = completed ? s.targetSeconds - a.actualSeconds : null;
            return (
              <tr key={s.index} className={completed ? "" : "row-incomplete"}>
                <td>{s.index + 1}</td>
                <td>{s.title ?? <em>untitled</em>}</td>
                <td>{formatClock(s.targetSeconds)}</td>
                <td>{completed ? formatClock(a.actualSeconds) : "—"}</td>
                <td className={delta !== null ? (delta > 0 ? "delta-ahead" : delta < 0 ? "delta-behind" : "") : ""}>
                  {delta !== null ? formatDelta(delta) : "—"}
                </td>
                <td>{completed ? formatWpm(s.wordCount, Math.max(1, a.actualSeconds - s.holdSeconds)) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total</td>
            <td>{formatClock(totalTarget)}</td>
            <td>{anyCompleted ? formatClock(totalActual) : "—"}</td>
            <td className={totalTarget - totalActual > 0 ? "delta-ahead" : "delta-behind"}>
              {anyCompleted ? formatDelta(totalTarget - totalActual) : "—"}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div className="summary-actions">
        <button className="btn btn-primary" onClick={onRestart} title="R">
          Practice again
        </button>
        <button className="btn" onClick={onChooseMode}>
          Change mode
        </button>
        <button className="btn" onClick={onNewFile}>
          Load a different speech
        </button>
      </div>
    </div>
  );
}
