import { rescaleTemplate, SCALE_VERSION, type HandSide, type RunStats, type Template } from "./pose";

export type Contact = "apart" | "touching" | "overlapping";

export interface RunResult {
  id: string;
  letter: string;
  contact: Contact;
  handCount: number;
  stats: RunStats;
  at: number;
}

export interface SavedState {
  dominant: HandSide;
  templates: Template[];
  results: RunResult[];
  scale?: number;
}

const KEY = "ishaara-two-hand-test-v1";

export function loadState(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as SavedState;
    if ((state.scale ?? 1) < SCALE_VERSION) return { ...state, scale: SCALE_VERSION, templates: state.templates.map(rescaleTemplate) };
    return state;
  } catch {
    return null;
  }
}

export function saveState(state: SavedState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, scale: SCALE_VERSION }));
  } catch {
    // Storage blocked (e.g. private mode): the session still works in memory.
  }
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function resultsToCsv(results: RunResult[]): string {
  const header = "letter,contact,hands,frames,fps,expected_hands_pct,mean_handedness_score,jitter_pct_of_hand,recognized_pct,wrong_pct,unknown_pct,tested_at";
  const rows = results.map((r) =>
    [
      r.letter,
      r.contact,
      r.handCount,
      r.stats.frames,
      r.stats.fps.toFixed(1),
      r.stats.expectedHandsPct.toFixed(1),
      r.stats.meanScore.toFixed(3),
      r.stats.jitterPct.toFixed(2),
      r.stats.recognizedPct.toFixed(1),
      r.stats.wrongPct.toFixed(1),
      r.stats.unknownPct.toFixed(1),
      new Date(r.at).toISOString(),
    ].join(",")
  );
  return [header, ...rows].join("\n");
}
