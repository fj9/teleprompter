import type { Deck, ParseResult, ParseWarning, Slide } from "./types";

const FALLBACK_WPM = 130;

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

function parseTimeValue(raw: string): number | null {
  const trimmed = raw.trim();
  const mmss = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (mmss) {
    return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  }
  const secs = trimmed.match(/^(\d+(?:\.\d+)?)\s*s$/i);
  if (secs) {
    return Math.round(parseFloat(secs[1]));
  }
  return null;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^./]+$/, "");
}

interface RawSlide {
  title: string | null;
  body: string;
  hasTimeLine: boolean;
  targetSeconds: number | null;
  invalidTimeRaw?: string;
}

function splitIntoSegments(raw: string): string[] {
  const lines = raw.split(/\r\n|\r|\n/);
  const segments: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === "---") {
      segments.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }
  segments.push(current.join("\n"));
  return segments;
}

function extractDocMetadata(segments: string[]): { title: string | null; rest: string[] } {
  // Ignore leading empty/whitespace-only segments (e.g. the file starting with "---").
  while (segments.length > 0 && segments[0].trim() === "") {
    segments.shift();
  }

  if (segments.length > 1) {
    const firstLines = segments[0]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    const isFrontmatter =
      firstLines.length > 0 && firstLines.every((l) => /^[A-Za-z][\w -]*:\s*.+$/.test(l));
    if (isFrontmatter) {
      const titleLine = firstLines.find((l) => /^title:/i.test(l));
      const title = titleLine ? titleLine.replace(/^title:\s*/i, "").trim() : null;
      return { title, rest: segments.slice(1) };
    }
  }

  return { title: null, rest: segments };
}

function parseSegment(segment: string): RawSlide | null {
  const lines = segment.split("\n");
  let sawTimeLine = false;
  let hasTimeLine = false;
  let targetSeconds: number | null = null;
  let invalidTimeRaw: string | undefined;
  const remaining: string[] = [];

  for (const line of lines) {
    if (!sawTimeLine) {
      const m = line.match(/^Time:\s*(.+)$/i);
      if (m) {
        sawTimeLine = true;
        hasTimeLine = true;
        const raw = m[1].trim();
        const parsed = parseTimeValue(raw);
        if (parsed === null) {
          invalidTimeRaw = raw;
        } else {
          targetSeconds = parsed;
        }
        continue;
      }
    }
    remaining.push(line);
  }

  // First non-blank remaining line, if a heading, becomes the title.
  let bi = 0;
  while (bi < remaining.length && remaining[bi].trim() === "") bi++;
  let title: string | null = null;
  if (bi < remaining.length && /^#{1,6}\s*/.test(remaining[bi].trim())) {
    title = remaining[bi].trim().replace(/^#{1,6}\s*/, "").trim();
    remaining.splice(bi, 1);
  }

  const body = remaining.join("\n").trim();
  if (body === "") {
    return null;
  }

  return { title, body, hasTimeLine, targetSeconds, invalidTimeRaw };
}

export function parseDeck(raw: string, filename: string): ParseResult {
  const segments = splitIntoSegments(raw);
  const { title: docTitle, rest } = extractDocMetadata(segments);

  const warnings: ParseWarning[] = [];
  const rawSlides: RawSlide[] = [];

  rest.forEach((segment, segIdx) => {
    const parsed = parseSegment(segment);
    if (parsed === null) {
      warnings.push({
        type: "blank-slide-dropped",
        slideIndex: -1,
        message: `Segment ${segIdx + 1}: no body text after removing metadata/heading — dropped.`,
      });
      return;
    }
    rawSlides.push(parsed);
  });

  const slides: Slide[] = rawSlides.map((rs, idx) => {
    const wordCount = countWords(rs.body);
    let targetSeconds: number;
    let targetIsInferred = false;

    if (rs.targetSeconds !== null) {
      targetSeconds = rs.targetSeconds;
    } else {
      targetIsInferred = true;
      targetSeconds = Math.round((wordCount / FALLBACK_WPM) * 60);
      if (rs.invalidTimeRaw !== undefined) {
        warnings.push({
          type: "invalid-time",
          slideIndex: idx,
          message: `Slide ${idx + 1}: couldn't parse time "${rs.invalidTimeRaw}" — estimated ${formatDuration(
            targetSeconds
          )}.`,
        });
      } else {
        warnings.push({
          type: "inferred-time",
          slideIndex: idx,
          message: `Slide ${idx + 1}: no time given — estimated ${formatDuration(targetSeconds)}.`,
        });
      }
    }

    const slide: Slide = {
      index: idx,
      title: rs.title,
      bodyText: rs.body,
      wordCount,
      targetSeconds,
      targetIsInferred,
    };
    if (rs.invalidTimeRaw !== undefined) {
      slide.invalidTimeRaw = rs.invalidTimeRaw;
    }
    return slide;
  });

  const totalTargetSeconds = slides.reduce((sum, s) => sum + s.targetSeconds, 0);

  const deck: Deck = {
    title: docTitle ?? stripExtension(filename),
    slides,
    totalTargetSeconds,
  };

  return { deck, warnings };
}
