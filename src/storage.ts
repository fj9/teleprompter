import type { Mode } from "./types";

const KEY = "pace-practice:v1";

export interface PersistedState {
  markdownText: string;
  filename: string;
  mode: Mode | null;
  fontSize: number;
  mirrored: boolean;
  /** Per-slide inferred-time overrides made in the upload/review screen, keyed by slide index. */
  timeOverrides: Record<number, number>;
}

const DEFAULTS: PersistedState = {
  markdownText: "",
  filename: "",
  mode: null,
  fontSize: 32,
  mirrored: false,
  timeOverrides: {},
};

export function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePersisted(state: Partial<PersistedState>): void {
  try {
    const current = loadPersisted();
    const next = { ...current, ...state };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Local storage unavailable (private mode, quota, etc). Session still works, just won't persist.
  }
}
