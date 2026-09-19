import { useSettings } from "../settingsContext";

export function ThemeToggle({ floating }: { floating?: boolean }) {
  const { theme, toggleTheme } = useSettings();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      className={"btn" + (floating ? " theme-toggle-floating" : "")}
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
    >
      {theme === "dark" ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
