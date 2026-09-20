import { useState } from "react";
import type { Deck, Mode, SlideActual } from "./types";
import { UploadScreen } from "./screens/UploadScreen";
import { ModeSelect } from "./screens/ModeSelect";
import { FreestylePractice } from "./screens/FreestylePractice";
import { TimedPractice } from "./screens/TimedPractice";
import { MemorizePractice } from "./screens/MemorizePractice";
import { Summary } from "./screens/Summary";
import { SettingsProvider } from "./settingsContext";
import { ThemeToggle } from "./components/ThemeToggle";
import { loadPersisted, savePersisted } from "./storage";

type Screen = "upload" | "mode-select" | "practice" | "summary";

export default function App() {
  const persisted = useState(() => loadPersisted())[0];
  const [screen, setScreen] = useState<Screen>("upload");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [mode, setMode] = useState<Mode | null>(persisted.mode);
  const [actuals, setActuals] = useState<SlideActual[]>([]);
  const [practiceKey, setPracticeKey] = useState(0);

  function handleDeckReady(d: Deck) {
    setDeck(d);
    setScreen("mode-select");
  }

  function handleModeChosen(m: Mode) {
    setMode(m);
    savePersisted({ mode: m });
    setPracticeKey((k) => k + 1);
    setScreen("practice");
  }

  function handleComplete(result: SlideActual[]) {
    setActuals(result);
    setScreen("summary");
  }

  function handleRestart() {
    setPracticeKey((k) => k + 1);
    setScreen("practice");
  }

  function handleExitToModeSelect() {
    setScreen("mode-select");
  }

  return (
    <SettingsProvider
      initialFontSize={persisted.fontSize}
      initialMirrored={persisted.mirrored}
      initialTheme={persisted.theme}
    >
      {screen !== "practice" && <ThemeToggle floating />}
      {screen === "upload" && (
        <UploadScreen initialText={persisted.markdownText} onDeckReady={handleDeckReady} />
      )}

      {screen === "mode-select" && deck && (
        <ModeSelect deck={deck} onChoose={handleModeChosen} onBack={() => setScreen("upload")} />
      )}

      {screen === "practice" && deck && mode === "freestyle" && (
        <FreestylePractice
          key={practiceKey}
          deck={deck}
          onComplete={handleComplete}
          onExit={handleExitToModeSelect}
          onRestart={handleRestart}
        />
      )}

      {screen === "practice" && deck && mode === "timed" && (
        <TimedPractice
          key={practiceKey}
          deck={deck}
          onComplete={handleComplete}
          onExit={handleExitToModeSelect}
          onRestart={handleRestart}
        />
      )}

      {screen === "practice" && deck && mode === "memorize" && (
        <MemorizePractice
          key={practiceKey}
          deck={deck}
          onExit={handleExitToModeSelect}
          onRestart={handleRestart}
        />
      )}

      {screen === "summary" && deck && (
        <Summary
          deck={deck}
          actuals={actuals}
          onRestart={handleRestart}
          onChooseMode={() => setScreen("mode-select")}
          onNewFile={() => setScreen("upload")}
        />
      )}
    </SettingsProvider>
  );
}
