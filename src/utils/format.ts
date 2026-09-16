export function formatClock(totalSeconds: number): string {
  const neg = totalSeconds < 0;
  const s = Math.round(Math.abs(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${neg ? "-" : ""}${m}:${String(rem).padStart(2, "0")}`;
}

export function formatDelta(deltaSeconds: number): string {
  const s = Math.round(deltaSeconds);
  const sign = s > 0 ? "+" : s < 0 ? "−" : "±";
  return `${sign}${Math.abs(s)}s`;
}

export function formatWpm(wordCount: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.round((wordCount / seconds) * 60);
}
