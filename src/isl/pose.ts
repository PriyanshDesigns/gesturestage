export interface Pt {
  x: number;
  y: number;
  z: number;
}

export type HandSide = "Left" | "Right";

export interface TrackedHand {
  side: HandSide;
  score: number;
  landmarks: Pt[]; // 21 MediaPipe landmarks, normalized image coordinates
}

export interface Pose {
  sides: HandSide[]; // hand order inside `points`: dominant hand first
  points: Pt[]; // 21 points per hand, in units of the dominant hand's size
}

export interface Template {
  id: string;
  letter: string;
  sides: HandSide[];
  points: Pt[];
}

export interface MatchSettings {
  threshold: number; // max mean point distance to accept, in hand-size units
  minMargin: number; // how much closer the best letter must be than the runner-up
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = { threshold: 0.3, minMargin: 0.05 };

export interface Match {
  accepted: string | null;
  best: { letter: string; distance: number; template: Template } | null;
  runnerUp: { letter: string; distance: number } | null;
}

const WRIST = 0;
const MIDDLE_MCP = 9;
// MediaPipe's z is noisier than x/y, so it counts for less.
const Z_WEIGHT = 0.5;

const FINGERS: [string, number[]][] = [
  ["thumb", [1, 2, 3, 4]],
  ["index", [5, 6, 7, 8]],
  ["middle", [9, 10, 11, 12]],
  ["ring", [13, 14, 15, 16]],
  ["little", [17, 18, 19, 20]],
];

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function orderHands(hands: TrackedHand[], dominant: HandSide): TrackedHand[] {
  if (hands.length < 2) return hands.slice(0, 1);
  const [a, b] = hands;
  if (a.side !== b.side) return a.side === dominant ? [a, b] : [b, a];
  // Tracker gave both hands the same label: fall back to position. In the raw
  // (unmirrored) frame the signer's right hand is on the image's left.
  const leftInImage = a.landmarks[WRIST].x < b.landmarks[WRIST].x ? a : b;
  const rightInImage = leftInImage === a ? b : a;
  const ordered = dominant === "Right" ? [leftInImage, rightInImage] : [rightInImage, leftInImage];
  return [
    { ...ordered[0], side: dominant },
    { ...ordered[1], side: dominant === "Right" ? "Left" : "Right" },
  ];
}

/**
 * Express both hands relative to the dominant hand's wrist and size, so the
 * same letter matches regardless of where the signer stands or how far away.
 * `aspect` (video width / height) makes x and y the same unit.
 */
export function toPose(hands: TrackedHand[], dominant: HandSide, aspect: number): Pose | null {
  if (hands.length === 0) return null;
  const ordered = orderHands(hands, dominant);
  const anchor = ordered[0].landmarks;
  const ox = anchor[WRIST].x * aspect;
  const oy = anchor[WRIST].y;
  const scale =
    Math.hypot((anchor[MIDDLE_MCP].x - anchor[WRIST].x) * aspect, anchor[MIDDLE_MCP].y - anchor[WRIST].y) || 1e-4;

  const points: Pt[] = [];
  for (const hand of ordered) {
    const wz = hand.landmarks[WRIST].z;
    for (const p of hand.landmarks) {
      points.push({
        x: (p.x * aspect - ox) / scale,
        y: (p.y - oy) / scale,
        z: (((p.z - wz) * aspect) / scale) * Z_WEIGHT,
      });
    }
  }
  return { sides: ordered.map((h) => h.side), points };
}

export function poseDistance(a: Pt[], b: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += dist(a[i], b[i]);
  return sum / a.length;
}

const REGIONS: number[][] = [[0, 1, 5, 9, 13, 17], ...FINGERS.map(([, idx]) => idx)];

/**
 * Letters often differ by a single finger, which a plain average over all
 * points washes out. Blend the average region error with the worst region.
 */
export function shapeDistance(a: Pt[], b: Pt[]): number {
  const hands = a.length / 21;
  let sum = 0;
  let worst = 0;
  let count = 0;
  for (let h = 0; h < hands; h++) {
    for (const region of REGIONS) {
      let e = 0;
      for (const i of region) e += dist(a[h * 21 + i], b[h * 21 + i]);
      e /= region.length;
      sum += e;
      worst = Math.max(worst, e);
      count++;
    }
  }
  return (sum / count + worst) / 2;
}

// ---------- Tolerant letter distance (used by the Ishaara tutor) ----------

const TILTS = [-0.35, -0.17, 0, 0.17, 0.35].map((a) => ({ c: Math.cos(a), s: Math.sin(a) })); // about ±20°
const PLACEMENT_FREE = 0.8; // hand-size units of spacing difference that cost nothing
const PLACEMENT_WEIGHT = 0.15;
const Z_SOFTEN = 0.5;

/** One hand's 21 points, moved so its own wrist is the origin. */
export function handLocal(points: Pt[], h: number): Pt[] {
  const w = points[h * 21];
  const out: Pt[] = [];
  for (let i = 0; i < 21; i++) {
    const p = points[h * 21 + i];
    out.push({ x: p.x - w.x, y: p.y - w.y, z: (p.z - w.z) * Z_SOFTEN });
  }
  return out;
}

function regionScore(a: Pt[], b: Pt[]) {
  let sum = 0;
  let worst = 0;
  for (const region of REGIONS) {
    let e = 0;
    for (const i of region) e += dist(a[i], b[i]);
    e /= region.length;
    sum += e;
    worst = Math.max(worst, e);
  }
  return { sum, worst, count: REGIONS.length };
}

/**
 * Like shapeDistance, but forgiving of the things that vary between people
 * and cameras rather than between letters: each hand's shape is compared
 * around its own wrist (so how far apart the hands are matters only a
 * little), a small wrist tilt is allowed, and depth counts for less.
 */
export function letterDistance(live: Pt[], ref: Pt[]): number {
  const hands = live.length / 21;
  let sum = 0;
  let worst = 0;
  let count = 0;
  for (let h = 0; h < hands; h++) {
    const a = handLocal(live, h);
    const b = handLocal(ref, h);
    let best: { sum: number; worst: number; count: number } | null = null;
    for (const { c, s } of TILTS) {
      const turned = a.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }));
      const r = regionScore(turned, b);
      if (!best || r.sum + r.count * r.worst < best.sum + best.count * best.worst) best = r;
    }
    sum += best!.sum;
    worst = Math.max(worst, best!.worst);
    count += best!.count;
  }
  let placement = 0;
  if (hands === 2) {
    const dx = live[21].x - ref[21].x;
    const dy = live[21].y - ref[21].y;
    placement = Math.max(0, Math.hypot(dx, dy) - PLACEMENT_FREE) * PLACEMENT_WEIGHT;
  }
  return (sum / count + worst) / 2 + placement;
}

/** Both hands' points, each around its own wrist: for finger hints that ignore spacing. */
export function localPose(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let h = 0; h < points.length / 21; h++) out.push(...handLocal(points, h));
  return out;
}

/** Live points with the two hands' order swapped, re-anchored on the other wrist. */
export function swapHands(points: Pt[]): Pt[] {
  if (points.length !== 42) return points;
  const w = points[21];
  return [...points.slice(21), ...points.slice(0, 21)].map((p) => ({ x: p.x - w.x, y: p.y - w.y, z: p.z }));
}

export function classify(pose: Pose, templates: Template[], settings: MatchSettings): Match {
  const bestPerLetter = new Map<string, { distance: number; template: Template }>();
  for (const t of templates) {
    if (t.points.length !== pose.points.length) continue;
    const d = shapeDistance(pose.points, t.points);
    const current = bestPerLetter.get(t.letter);
    if (!current || d < current.distance) bestPerLetter.set(t.letter, { distance: d, template: t });
  }

  const ranked = [...bestPerLetter.entries()]
    .map(([letter, v]) => ({ letter, ...v }))
    .sort((a, b) => a.distance - b.distance);
  const best = ranked[0] ?? null;
  const runnerUp = ranked[1] ? { letter: ranked[1].letter, distance: ranked[1].distance } : null;

  const clearWinner = !runnerUp || (best !== null && runnerUp.distance - best.distance >= settings.minMargin);
  const accepted = best && best.distance <= settings.threshold && clearWinner ? best.letter : null;
  return { accepted, best, runnerUp };
}

export interface FingerIssue {
  side: HandSide;
  finger: string;
  error: number;
  advice: string;
}

/** Fingers ranked by how far they are from the closest template, worst first. */
export function fingerIssues(pose: Pose, template: Template): FingerIssue[] {
  if (pose.points.length !== template.points.length) return [];
  const issues: FingerIssue[] = [];
  pose.sides.forEach((side, h) => {
    const off = h * 21;
    for (const [finger, idx] of FINGERS) {
      let error = 0;
      for (const i of idx) error += dist(pose.points[off + i], template.points[off + i]);
      error /= idx.length;

      const base = off + idx[0];
      const tip = off + idx[3];
      const liveReach = dist(pose.points[tip], pose.points[base]);
      const targetReach = dist(template.points[tip], template.points[base]);
      const advice =
        liveReach > targetReach + 0.15 ? "bend it more" : liveReach < targetReach - 0.15 ? "straighten it" : "move it into place";
      issues.push({ side, finger, error, advice });
    }
  });
  return issues.sort((a, b) => b.error - a.error);
}

// ---------- Measurement runs ----------

export interface FrameRecord {
  handsDetected: number;
  meanScore: number;
  predicted: string | null;
  points: Pt[] | null;
}

export interface RunStats {
  frames: number;
  fps: number;
  expectedHandsPct: number;
  meanScore: number;
  jitterPct: number;
  recognizedPct: number;
  wrongPct: number;
  unknownPct: number;
}

export const PASS_BAR = { expectedHandsPct: 95, recognizedPct: 90, wrongPctMax: 5 };

export function summarizeRun(frames: FrameRecord[], target: string, expectedHands: number, durationMs: number): RunStats {
  const n = frames.length || 1;
  const withHands = frames.filter((f) => f.handsDetected > 0);

  let jitterSum = 0;
  let jitterCount = 0;
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1].points;
    const cur = frames[i].points;
    if (prev && cur && prev.length === cur.length) {
      jitterSum += poseDistance(prev, cur);
      jitterCount++;
    }
  }

  const pct = (count: number) => (count / n) * 100;
  return {
    frames: frames.length,
    fps: durationMs > 0 ? (frames.length / durationMs) * 1000 : 0,
    expectedHandsPct: pct(frames.filter((f) => f.handsDetected === expectedHands).length),
    meanScore: withHands.length ? withHands.reduce((s, f) => s + f.meanScore, 0) / withHands.length : 0,
    jitterPct: jitterCount ? (jitterSum / jitterCount) * 100 : 0,
    recognizedPct: pct(frames.filter((f) => f.predicted === target).length),
    wrongPct: pct(frames.filter((f) => f.predicted !== null && f.predicted !== target).length),
    unknownPct: pct(frames.filter((f) => f.predicted === null).length),
  };
}

export function passes(stats: RunStats): boolean {
  return (
    stats.expectedHandsPct >= PASS_BAR.expectedHandsPct &&
    stats.recognizedPct >= PASS_BAR.recognizedPct &&
    stats.wrongPct < PASS_BAR.wrongPctMax
  );
}
