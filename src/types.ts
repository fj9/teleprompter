export interface Slide {
  index: number;
  title: string | null;
  bodyText: string;
  wordCount: number;
  /** Seconds of timed stage directions (e.g. "[pause 5 seconds]"); part of the slide's time but not speech. */
  holdSeconds: number;
  targetSeconds: number;
  targetIsInferred: boolean;
  /** Raw text of an unparsable Time: value, when that's why this slide is inferred. */
  invalidTimeRaw?: string;
}

export interface Deck {
  title: string;
  slides: Slide[];
  totalTargetSeconds: number;
}

export type ParseWarningType = "blank-slide-dropped" | "inferred-time" | "invalid-time";

export interface ParseWarning {
  type: ParseWarningType;
  /** Index into the final slides array, or -1 if the slide was dropped before indexing. */
  slideIndex: number;
  message: string;
}

export interface ParseResult {
  deck: Deck;
  warnings: ParseWarning[];
}

export type Mode = "freestyle" | "timed" | "memorize";

export interface SlideActual {
  slideIndex: number;
  actualSeconds: number;
  completed: boolean;
}
