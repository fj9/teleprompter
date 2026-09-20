import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Deck } from "../types";
import { Toolbar } from "../components/Toolbar";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useWakeLock } from "../hooks/useWakeLock";
import { useSettings } from "../settingsContext";
import { MEM_LEVELS, buildMemModel, countUnits, isWordHidden, unitKey } from "../utils/memorize";

interface MemorizePracticeProps {
  deck: Deck;
  onExit: () => void;
  onRestart: () => void;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function MemorizePractice({ deck, onExit, onRestart }: MemorizePracticeProps) {
  const { fontSize } = useSettings();
  const [slideIndex, setSlideIndex] = useState(0);
  const [levelIndex, setLevelIndex] = useState(0);
  const [seed, setSeed] = useState(newSeed);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const slide = deck.slides[slideIndex];
  const level = MEM_LEVELS[levelIndex];
  const model = useMemo(() => buildMemModel(slide.bodyText, seed + slideIndex), [slide, seed, slideIndex]);
  const { total, hiddenPerSentence } = useMemo(() => countUnits(model, level), [model, level]);
  const blockLevel = level.openingWords !== undefined;

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [slideIndex]);

  function hideAgain() {
    setRevealed(new Set());
    setShowAll(false);
  }

  function changeLevel(delta: number) {
    setLevelIndex((i) => Math.min(MEM_LEVELS.length - 1, Math.max(0, i + delta)));
    hideAgain();
  }

  function changeSlide(delta: number) {
    const next = Math.min(deck.slides.length - 1, Math.max(0, slideIndex + delta));
    if (next === slideIndex) return;
    setSlideIndex(next);
    hideAgain();
  }

  function reveal(key: string) {
    setRevealed((prev) => new Set(prev).add(key));
  }

  useKeyboardShortcuts({
    onSeekBack: () => changeSlide(-1),
    onSeekForward: () => changeSlide(1),
    onRestart,
    onExit,
  });
  useWakeLock();

  const drawnBlocks = new Set<number>();
  const paragraphs = model.paragraphs.map((tokens, pi) => (
    <p key={pi}>
      {tokens.map((tok, ti) => {
        const space = ti > 0 ? " " : null;
        if (tok.kind === "stage") {
          return (
            <Fragment key={ti}>
              {space}
              <span className="stage-direction">{tok.text}</span>
            </Fragment>
          );
        }
        const text = `${tok.lead}${tok.core}${tok.trail}`;
        if (!isWordHidden(tok, level, model)) {
          return (
            <Fragment key={ti}>
              {space}
              {text}
            </Fragment>
          );
        }
        const key = unitKey(tok, level);
        if (showAll || revealed.has(key)) {
          return (
            <Fragment key={ti}>
              {space}
              <span className="word-revealed">{text}</span>
            </Fragment>
          );
        }
        if (blockLevel) {
          if (drawnBlocks.has(tok.sentence)) return null;
          drawnBlocks.add(tok.sentence);
          const width = Math.min(3 + (hiddenPerSentence.get(tok.sentence) ?? 1) * 1.2, 20);
          return (
            <Fragment key={ti}>
              {space}
              <button
                className="gap gap-block"
                style={{ width: `${width}em` }}
                onClick={() => reveal(key)}
                aria-label="Reveal the rest of this sentence"
              />
            </Fragment>
          );
        }
        return (
          <Fragment key={ti}>
            {space}
            {tok.lead}
            <button className="gap" onClick={() => reveal(key)} aria-label="Reveal hidden word" />
            {tok.trail}
          </Fragment>
        );
      })}
    </p>
  ));

  const anythingRevealed = showAll || revealed.size > 0;

  return (
    <div className="practice-screen">
      <Toolbar
        slideLabel={`Slide ${slideIndex + 1} of ${deck.slides.length}`}
        onRestart={onRestart}
        onExit={onExit}
        showMirror={false}
      >
        {total > 0 && (
          <button className="btn" onClick={anythingRevealed ? hideAgain : () => setShowAll(true)}>
            {anythingRevealed ? "Hide again" : "Show all"}
          </button>
        )}
        {level.gapFraction !== undefined && (
          <button
            className="btn"
            onClick={() => {
              setSeed(newSeed());
              hideAgain();
            }}
          >
            New gaps
          </button>
        )}
      </Toolbar>

      <div className="memorize-scroll" ref={scrollRef}>
        <div className="memorize-slide" style={{ fontSize: `${fontSize}px` }}>
          {slide.title && <div className="reader-slide-title">{slide.title}</div>}
          {paragraphs}
        </div>
      </div>

      <div className="stats-panel">
        <div className="stat-row">
          <span className="stat-label">
            Level {levelIndex + 1} of {MEM_LEVELS.length}
          </span>
          <span className="stat-value">{level.label}</span>
        </div>
        {total > 0 && (
          <div className="stat-row">
            <span className="stat-label">Checked</span>
            <span className="stat-value">
              {revealed.size} of {total}
            </span>
          </div>
        )}
        <div className="transport">
          <div className="transport-group">
            <button
              className="btn btn-large"
              onClick={() => changeSlide(-1)}
              disabled={slideIndex === 0}
              aria-label="Previous slide"
              title="Left arrow"
            >
              ◀ Slide
            </button>
            <button
              className="btn btn-large"
              onClick={() => changeSlide(1)}
              disabled={slideIndex === deck.slides.length - 1}
              aria-label="Next slide"
              title="Right arrow"
            >
              Slide ▶
            </button>
          </div>
          <div className="transport-group">
            <button
              className="btn btn-large"
              onClick={() => changeLevel(-1)}
              disabled={levelIndex === 0}
            >
              − Easier
            </button>
            <button
              className="btn btn-large btn-primary"
              onClick={() => changeLevel(1)}
              disabled={levelIndex === MEM_LEVELS.length - 1}
            >
              Harder +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
