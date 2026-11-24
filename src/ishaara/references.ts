import { shapeDistance, type HandSide, type Pt, type Template } from "../isl/pose";
import type { RefSet } from "./store";

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Lessons of 4–5 letters. Alphabetical until a Deaf ISL signer regroups them
 * by handshape (the case study's plan); the order is the only thing to change.
 */
export const LESSONS: { title: string; letters: string[] }[] = [
  { title: "First letters", letters: ["A", "B", "C", "D", "E"] },
  { title: "Building up", letters: ["F", "G", "H", "I", "J"] },
  { title: "Midway", letters: ["K", "L", "M", "N", "O"] },
  { title: "Getting fluent", letters: ["P", "Q", "R", "S", "T"] },
  { title: "Last stretch", letters: ["U", "V", "W", "X", "Y", "Z"] },
];

const flip = (side: HandSide): HandSide => (side === "Right" ? "Left" : "Right");

/** The same letter signed by the other hand: mirror left–right, swap hand labels. */
export function mirrorTemplate(t: Template): Template {
  return {
    ...t,
    sides: t.sides.map(flip),
    points: t.points.map((p: Pt) => ({ x: -p.x, y: p.y, z: p.z })),
  };
}

function isTemplate(t: unknown): t is Template {
  const v = t as Template;
  return (
    typeof v?.letter === "string" &&
    Array.isArray(v.sides) &&
    Array.isArray(v.points) &&
    v.sides.length >= 1 &&
    v.points.length === v.sides.length * 21
  );
}

/** Accepts this app's export, the test page's export, or a bare array. */
export function parseRefSet(raw: unknown): RefSet | null {
  const obj = (Array.isArray(raw) ? { templates: raw } : raw) as Partial<RefSet> | null;
  const templates = (obj?.templates ?? []).filter(isTemplate).map((t) => ({ ...t, letter: t.letter.toUpperCase() }));
  if (!templates.length) return null;
  return {
    version: 1,
    dominant: obj?.dominant === "Left" ? "Left" : "Right",
    signer: typeof obj?.signer === "string" ? obj.signer : undefined,
    templates,
    videos: obj?.videos && typeof obj.videos === "object" ? obj.videos : undefined,
  };
}

/** Store every set right-handed so sets recorded by different signers combine. */
export function toRightHanded(set: RefSet): RefSet {
  if (set.dominant === "Right") return set;
  return { ...set, dominant: "Right", templates: set.templates.map(mirrorTemplate) };
}

export async function fetchBundledRefs(): Promise<RefSet | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}ishaara/templates.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    return parseRefSet(await res.json());
  } catch {
    return null;
  }
}

export interface References {
  templates: Template[]; // in the learner's handedness
  byLetter: Map<string, Template[]>;
  display: Map<string, Template>; // the most typical sample per letter, for drawing
  letters: string[];
  videos: Record<string, string>;
  signers: string[];
  localLetters: Set<string>;
}

/** Local recordings replace bundled ones letter by letter. */
export function buildReferences(bundled: RefSet | null, local: RefSet | null, learner: HandSide): References {
  const b = bundled ? toRightHanded(bundled) : null;
  const l = local ? toRightHanded(local) : null;
  const localLetters = new Set(l?.templates.map((t) => t.letter) ?? []);
  const merged = [...(b?.templates.filter((t) => !localLetters.has(t.letter)) ?? []), ...(l?.templates ?? [])];
  const templates = learner === "Right" ? merged : merged.map(mirrorTemplate);

  const byLetter = new Map<string, Template[]>();
  for (const t of templates) byLetter.set(t.letter, [...(byLetter.get(t.letter) ?? []), t]);

  const display = new Map<string, Template>();
  for (const [letter, list] of byLetter) {
    let best = list[0];
    let bestSum = Infinity;
    for (const a of list) {
      const sum = list.reduce((s, b2) => s + (a === b2 ? 0 : shapeDistance(a.points, b2.points)), 0);
      if (sum < bestSum) {
        bestSum = sum;
        best = a;
      }
    }
    display.set(letter, best);
  }

  const signers = [b?.signer, l?.signer].filter((s): s is string => !!s);
  return {
    templates,
    byLetter,
    display,
    letters: ALPHABET.filter((a) => byLetter.has(a)),
    videos: { ...b?.videos, ...l?.videos },
    signers: [...new Set(signers)],
    localLetters,
  };
}

export function handsFor(refs: References, letter: string): number {
  return refs.display.get(letter)?.sides.length ?? 0;
}
