import type { References } from "./references";
import { MASTERED_BOX, type LetterProgress } from "./store";

export type LetterState = "missing" | "new" | "learning" | "mastered";

export function letterState(letter: string, refs: References, progress: Record<string, LetterProgress>): LetterState {
  if (!refs.byLetter.has(letter)) return "missing";
  const p = progress[letter];
  if (!p?.correct) return "new";
  return p.box >= MASTERED_BOX ? "mastered" : "learning";
}

export function nameLetters(name: string) {
  return name.replace(/[^a-zA-Z]/g, "").toUpperCase().split("");
}

/** Elapsed-time clock for attempts (kept out of components' render scope). */
export const clock = () => performance.now();
