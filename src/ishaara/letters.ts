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

/** Short, familiar words for the first real word; one is picked at random on every visit. */
export const FIRST_WORDS = [
  "ASHA", "RAVI", "MAYA", "NEHA", "ARJUN", "KABIR", "MEERA", "ROHAN", "TARA", "ZOYA",
  "CHAI", "MANGO", "DELHI", "GOA", "LASSI", "KITE", "TIGER", "LOTUS", "HELLO", "FRIEND",
  "MUMBAI", "PUNE", "DOSA", "QUIZ", "JAZZ", "VIBE", "WAVE", "YES", "BOX", "SKY",
];

export function randomWord(exclude?: string) {
  const pool = FIRST_WORDS.filter((w) => w !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
