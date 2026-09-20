import { splitStageDirections } from "./stageDirections";

export interface MemWord {
  kind: "word";
  /** Position among all words in the slide. */
  index: number;
  sentence: number;
  /** Position within its sentence, counting from 0. */
  posInSentence: number;
  lead: string;
  core: string;
  trail: string;
}

export interface MemStage {
  kind: "stage";
  text: string;
}

export type MemToken = MemWord | MemStage;

export interface MemModel {
  paragraphs: MemToken[][];
  /** Per word index: 0..1 order in which words fade into gaps; lower fades first. */
  rank: number[];
}

export interface MemLevel {
  label: string;
  /** Fraction of words replaced by individual gaps. */
  gapFraction?: number;
  /** Show only this many opening words per sentence; the rest is one hidden block. */
  openingWords?: number;
}

export const MEM_LEVELS: MemLevel[] = [
  { label: "Full text" },
  { label: "A few gaps", gapFraction: 0.2 },
  { label: "Half gaps", gapFraction: 0.5 },
  { label: "Opening words", openingWords: 3 },
  { label: "Blank", openingWords: 0 },
];

const SENTENCE_END = /[.!?…]["'”’)\]]*$/;
const WORD_PARTS = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u;
/** Short words fade later than content words, so gaps land on words worth recalling. */
const SHORT_WORD_PENALTY = 0.35;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMemModel(bodyText: string, seed: number): MemModel {
  let index = 0;
  let sentence = 0;
  let pos = 0;
  const words: MemWord[] = [];

  const paragraphs = bodyText.split(/\n{2,}/).map((para) => {
    const tokens: MemToken[] = [];
    for (const seg of splitStageDirections(para)) {
      if (seg.stage) {
        tokens.push({ kind: "stage", text: seg.text });
        continue;
      }
      for (const raw of seg.text.split(/\s+/).filter(Boolean)) {
        const m = raw.match(WORD_PARTS)!;
        const word: MemWord = {
          kind: "word",
          index: index++,
          sentence,
          posInSentence: pos++,
          lead: m[1],
          core: m[2],
          trail: m[3],
        };
        tokens.push(word);
        words.push(word);
        if (SENTENCE_END.test(raw)) {
          sentence++;
          pos = 0;
        }
      }
    }
    if (pos > 0) {
      sentence++;
      pos = 0;
    }
    return tokens;
  });

  const random = mulberry32(seed);
  const scored = words
    .filter((w) => w.core !== "")
    .map((w) => ({ index: w.index, score: random() + (w.core.length <= 3 ? SHORT_WORD_PENALTY : 0) }))
    .sort((a, b) => a.score - b.score);
  const rank: number[] = new Array(words.length).fill(1);
  scored.forEach((s, i) => {
    rank[s.index] = i / scored.length;
  });

  return { paragraphs, rank };
}

export function isWordHidden(word: MemWord, level: MemLevel, model: MemModel): boolean {
  if (word.core === "") return false;
  if (level.gapFraction !== undefined) return model.rank[word.index] < level.gapFraction;
  if (level.openingWords !== undefined) return word.posInSentence >= level.openingWords;
  return false;
}

/** Key of the thing you tap to reveal: a single word, or the hidden rest of a sentence. */
export function unitKey(word: MemWord, level: MemLevel): string {
  return level.openingWords !== undefined ? `s${word.sentence}` : `w${word.index}`;
}

/** How many hidden units the level creates, and how many hidden words each sentence has. */
export function countUnits(model: MemModel, level: MemLevel) {
  const keys = new Set<string>();
  const hiddenPerSentence = new Map<number, number>();
  for (const para of model.paragraphs) {
    for (const tok of para) {
      if (tok.kind !== "word" || !isWordHidden(tok, level, model)) continue;
      keys.add(unitKey(tok, level));
      hiddenPerSentence.set(tok.sentence, (hiddenPerSentence.get(tok.sentence) ?? 0) + 1);
    }
  }
  return { total: keys.size, hiddenPerSentence };
}
