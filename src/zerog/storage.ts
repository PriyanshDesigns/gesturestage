export interface Settings {
  sound: boolean;
  showCamera: boolean;
  reach: number;
}

const DEFAULT_SETTINGS: Settings = { sound: true, showCamera: true, reach: 0.72 };
const SETTINGS_KEY = "zerog.settings";
const STARS_KEY = "zerog.stars";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); progress just won't persist.
  }
}

export const loadSettings = () => read(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

export const loadStars = () => read<Record<number, number>>(STARS_KEY, {});
export function saveStars(level: number, stars: number) {
  const all = loadStars();
  if ((all[level] ?? 0) >= stars) return all;
  const next = { ...all, [level]: stars };
  write(STARS_KEY, next);
  return next;
}
export function resetStars() {
  write(STARS_KEY, {});
}
