export interface TextSegment {
  text: string;
  stage: boolean;
}

/** Stage directions are anything in [square brackets]; they're cues, not spoken words. */
export function splitStageDirections(text: string): TextSegment[] {
  return text
    .split(/(\[[^\]]*\])/)
    .map((part, i) => ({ text: part, stage: i % 2 === 1 }))
    .filter((seg) => seg.text !== "");
}

export function stripStageDirections(text: string): string {
  return text.replace(/\[[^\]]*\]/g, " ");
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30,
};

const HOLD_PATTERN =
  /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(seconds?|secs?|s|minutes?|mins?)\b/i;

/** Seconds a stage direction asks you to hold for, e.g. "[pause 5 seconds]" or "[hold 3-5s]"; null if none. */
export function parseHoldSeconds(direction: string): number | null {
  const text = direction.replace(
    new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b`, "gi"),
    (w) => String(NUMBER_WORDS[w.toLowerCase()])
  );
  const m = text.match(HOLD_PATTERN);
  if (!m) return null;
  const low = parseFloat(m[1]);
  const high = m[2] !== undefined ? parseFloat(m[2]) : low;
  const perUnit = m[3].toLowerCase().startsWith("m") ? 60 : 1;
  return ((low + high) / 2) * perUnit;
}

export function totalHoldSeconds(text: string): number {
  return splitStageDirections(text)
    .filter((seg) => seg.stage)
    .reduce((sum, seg) => sum + (parseHoldSeconds(seg.text) ?? 0), 0);
}
