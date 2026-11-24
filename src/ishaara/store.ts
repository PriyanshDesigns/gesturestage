import type { HandSide, Template } from "../isl/pose";

export interface Profile {
  name: string;
  dominant: HandSide;
  onboarded: boolean;
}

/** Leitner-style memory box per letter: 0 = new, 4 = solid. */
export interface LetterProgress {
  box: number;
  attempts: number;
  correct: number;
  assisted: number;
  totalMs: number; // time-to-correct summed over correct attempts
  lastSeen: number;
  due: number;
}

/** A reference set: the templates a fluent signer recorded, stored right-handed. */
export interface RefSet {
  version: 1;
  dominant: HandSide;
  signer?: string;
  credit?: Credit;
  templates: Template[];
  videos?: Record<string, string>;
}

/** Attribution for a set taken from published work (required by CC BY). */
export interface Credit {
  text: string;
  url?: string;
  license?: string;
}

export interface AppState {
  profile: Profile;
  progress: Record<string, LetterProgress>;
  localRefs: RefSet | null;
  sessions: number;
}

const KEY = "ishaara-v1";
const TEST_PAGE_KEY = "ishaara-two-hand-test-v1";

export const DEFAULT_STATE: AppState = {
  profile: { name: "", dominant: "Right", onboarded: false },
  progress: {},
  localRefs: null,
  sessions: 0,
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      profile: { ...DEFAULT_STATE.profile, ...parsed.profile },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked (private mode): progress lasts for this visit only.
  }
}

/** Templates recorded on the feasibility test page, if any. */
export function loadTestPageTemplates(): RefSet | null {
  try {
    const raw = localStorage.getItem(TEST_PAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { dominant?: HandSide; templates?: Template[] };
    if (!parsed.templates?.length) return null;
    return { version: 1, dominant: parsed.dominant ?? "Right", templates: parsed.templates };
  } catch {
    return null;
  }
}

// ---------- Spaced repetition ----------

const MINUTE = 60_000;
const INTERVALS = [0, 10 * MINUTE, 60 * MINUTE, 24 * 60 * MINUTE, 3 * 24 * 60 * MINUTE];
export const MASTERED_BOX = 3;

export function emptyProgress(): LetterProgress {
  return { box: 0, attempts: 0, correct: 0, assisted: 0, totalMs: 0, lastSeen: 0, due: 0 };
}

export interface Attempt {
  correct: boolean;
  assisted: boolean;
  ms: number;
}

/**
 * Unassisted, quick successes move a letter up a box; a skip or a slow,
 * assisted success moves it down, so it comes back sooner.
 */
export function recordAttempt(prev: LetterProgress | undefined, attempt: Attempt, now = Date.now()): LetterProgress {
  const p = prev ?? emptyProgress();
  let box = p.box;
  if (!attempt.correct) box = Math.max(0, box - 1);
  else if (!attempt.assisted && attempt.ms < 10_000) box = Math.min(INTERVALS.length - 1, box + 1);
  else if (box === 0) box = 1;
  return {
    box,
    attempts: p.attempts + 1,
    correct: p.correct + (attempt.correct ? 1 : 0),
    assisted: p.assisted + (attempt.assisted ? 1 : 0),
    totalMs: p.totalMs + (attempt.correct ? attempt.ms : 0),
    lastSeen: now,
    due: now + INTERVALS[box],
  };
}

/** Letters to practise: seen before, due first, weakest first. */
export function pickPractice(progress: Record<string, LetterProgress>, available: string[], count: number, now = Date.now()) {
  const seen = available.filter((l) => progress[l]?.attempts);
  const ranked = seen.sort((a, b) => {
    const pa = progress[a];
    const pb = progress[b];
    const dueA = pa.due <= now ? 0 : 1;
    const dueB = pb.due <= now ? 0 : 1;
    return dueA - dueB || pa.box - pb.box || pa.due - pb.due;
  });
  const picked = ranked.slice(0, count);
  // Short queues repeat the weakest letters so a session is never trivially short.
  let i = 0;
  while (picked.length < Math.min(count, seen.length * 2) && ranked.length) picked.push(ranked[i++ % ranked.length]);
  return picked;
}

export function dueCount(progress: Record<string, LetterProgress>, available: string[], now = Date.now()) {
  return available.filter((l) => progress[l]?.attempts && progress[l].due <= now).length;
}
