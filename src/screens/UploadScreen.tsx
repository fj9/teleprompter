import { useCallback, useMemo, useRef, useState } from "react";
import { parseDeck, formatDuration } from "../parser";
import type { Deck, ParseWarning } from "../types";
import { savePersisted } from "../storage";

const SAMPLE_MD = `Title: Product Launch Update

---
Time: 0:45
# Welcome

Good morning, everyone. Thanks for coming out on a Tuesday. I know a lot of you had to shuffle
things around to be here, so I'll try to make it worth your while.

---
Time: 1:30
# The problem

Three years ago we noticed something strange in the data. Usage was climbing every month, but
satisfaction scores were flat — and in a couple of segments, quietly sliding. That gap is what
today is about.

---
# What we shipped

We rebuilt the onboarding flow from scratch, cut the time-to-first-value from eleven minutes to
under two, and rewired the notification system so it earns your attention instead of demanding it.

---
Time: 45s
# Close

So — that's where we are, and where we're going next. Thanks for listening, and let's get into
questions.
`;

interface UploadScreenProps {
  initialText: string;
  onDeckReady: (deck: Deck) => void;
}

export function UploadScreen({ initialText, onDeckReady }: UploadScreenProps) {
  const [text, setText] = useState(initialText);
  const [filename, setFilename] = useState("speech.md");
  const [dragOver, setDragOver] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, number>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parseResult = useMemo(() => {
    if (text.trim() === "") return null;
    return parseDeck(text, filename);
  }, [text, filename]);

  const deck: Deck | null = useMemo(() => {
    if (!parseResult) return null;
    if (Object.keys(overrides).length === 0) return parseResult.deck;
    const slides = parseResult.deck.slides.map((s) =>
      overrides[s.index] !== undefined
        ? { ...s, targetSeconds: overrides[s.index], targetIsInferred: false }
        : s
    );
    const totalTargetSeconds = slides.reduce((sum, s) => sum + s.targetSeconds, 0);
    return { ...parseResult.deck, slides, totalTargetSeconds };
  }, [parseResult, overrides]);

  const loadText = useCallback((newText: string, newFilename: string) => {
    setText(newText);
    setFilename(newFilename);
    setOverrides({});
    savePersisted({ markdownText: newText, filename: newFilename });
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        loadText(String(reader.result ?? ""), file.name);
      };
      reader.readAsText(file);
    },
    [loadText]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const dropped: ParseWarning[] = parseResult?.warnings.filter((w) => w.type === "blank-slide-dropped") ?? [];
  const flagged: ParseWarning[] = parseResult?.warnings.filter((w) => w.type !== "blank-slide-dropped") ?? [];

  return (
    <div className="screen upload-screen">
      <h1>Pace Practice</h1>
      <p className="subtitle">Upload the Markdown for your talk to start rehearsing.</p>

      <div
        className={"dropzone" + (dragOver ? " dropzone-active" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown,text/plain"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <p>Drop a .md file here, or click to browse</p>
      </div>

      <div className="upload-alt-actions">
        <button className="btn-link" onClick={() => loadText(SAMPLE_MD, "sample-speech.md")}>
          Try a sample speech
        </button>
      </div>

      <details className="paste-fallback">
        <summary>Or paste Markdown directly</summary>
        <textarea
          value={text}
          onChange={(e) => loadText(e.target.value, filename)}
          rows={10}
          placeholder={"---\nTime: 0:45\n# Welcome\n\nYour opening lines...\n"}
        />
      </details>

      {deck && (
        <div className="deck-review">
          <h2>{deck.title}</h2>
          <p className="deck-total">
            {deck.slides.length} slide{deck.slides.length === 1 ? "" : "s"} · total run time{" "}
            {formatDuration(deck.totalTargetSeconds)}
          </p>

          {dropped.length > 0 && (
            <div className="warning-box warning-box-dropped">
              {dropped.map((w, i) => (
                <p key={i}>⚠ {w.message}</p>
              ))}
            </div>
          )}

          {flagged.length > 0 && (
            <div className="warning-box warning-box-flagged">
              <p className="warning-box-title">
                {flagged.length} slide{flagged.length === 1 ? "" : "s"} had no usable time — estimated from word count. Fix below, or edit your source file.
              </p>
            </div>
          )}

          <table className="slide-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Words</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {deck.slides.map((s) => (
                <tr key={s.index} className={s.targetIsInferred ? "row-inferred" : ""}>
                  <td>{s.index + 1}</td>
                  <td>{s.title ?? <em>untitled</em>}</td>
                  <td>{s.wordCount}</td>
                  <td>
                    {s.targetIsInferred ? (
                      <span className="inferred-edit">
                        <input
                          type="text"
                          defaultValue={formatDuration(s.targetSeconds)}
                          aria-label={`Corrected time for slide ${s.index + 1}`}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            const m = val.match(/^(\d+):([0-5]?\d)$/);
                            const secsMatch = val.match(/^(\d+(?:\.\d+)?)\s*s$/i);
                            let secs: number | null = null;
                            if (m) secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
                            else if (secsMatch) secs = Math.round(parseFloat(secsMatch[1]));
                            if (secs !== null) {
                              setOverrides((prev) => ({ ...prev, [s.index]: secs as number }));
                            }
                          }}
                        />
                        <span className="inferred-tag" title={s.invalidTimeRaw ? `Couldn't parse "${s.invalidTimeRaw}"` : "No time given"}>
                          estimated
                        </span>
                      </span>
                    ) : (
                      formatDuration(s.targetSeconds)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="btn btn-primary" onClick={() => onDeckReady(deck)} disabled={deck.slides.length === 0}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
