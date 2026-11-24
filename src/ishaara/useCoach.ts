import { useEffect, useRef, useState } from "react";
import { fingerIssues, letterDistance, localPose, orderHands, swapHands, toPose, type HandSide, type Pt, type Template, type TrackedHand } from "../isl/pose";
import { downloadFile } from "../isl/storage";
import { useTwoHandTracking } from "../isl/useTwoHandTracking";
import { drawStage, readPalette, type HandPalette } from "./draw";
import type { References } from "./references";

const HINT_SETTLE_MS = 350;

export type Strictness = "easy" | "normal" | "strict";

/**
 * How close is close enough. Because the coach knows which letter the learner
 * is aiming for, it accepts a shape when it is within `threshold` of that
 * letter AND no other letter is clearly closer (`slack`). That second rule is
 * what keeps wrong shapes out, so the distance cutoff can stay generous.
 * `graceMs` forgives brief tracking blips during the hold.
 */
export const STRICTNESS: Record<Strictness, { label: string; threshold: number; slack: number; holdMs: number; graceMs: number }> = {
  // Calibrated for letterDistance (see tools/reference-extractor/README.md).
  easy: { label: "Easy", threshold: 0.5, slack: 0.03, holdMs: 300, graceMs: 250 },
  normal: { label: "Normal", threshold: 0.4, slack: 0, holdMs: 350, graceMs: 200 },
  strict: { label: "Strict", threshold: 0.3, slack: -0.04, holdMs: 500, graceMs: 0 },
};

export interface CoachView {
  handsSeen: number;
  closeness: number; // 0–1, how near the live shape is to the target
  holding: number; // 0–1 progress of the hold
  hint: string;
  tone: "idle" | "work" | "close" | "good";
  debug?: CoachDebug;
}

export interface CoachDebug {
  hands: { side: string; score: number }[];
  target: string;
  targetDistance: number;
  threshold: number;
  nearest: { letter: string; distance: number }[];
  matching: boolean;
}

const RECORD_MS = 5000;

const IDLE: CoachView = { handsSeen: 0, closeness: 0, holding: 0, hint: "Bring your hands into view", tone: "idle" };

const FINGER_NAMES: Record<string, string> = {
  thumb: "thumb",
  index: "index finger",
  middle: "middle finger",
  ring: "ring finger",
  little: "little finger",
};

interface Options {
  refs: References;
  dominant: HandSide;
  target: string | null;
  showGhost: boolean;
  attempt?: number; // bump to retry the same letter
  strictness?: Strictness;
  onCorrect: (letter: string) => void;
}

/**
 * Runs two-hand tracking and coaches toward one target letter: draws the live
 * hands with a ghost of the target, says which finger to fix, and calls
 * `onCorrect` once the right letter has been held briefly (see STRICTNESS).
 */
/**
 * When the finger shapes are right but the hands sit much closer or further
 * apart than the reference, say that instead of naming a finger.
 */
function spacingHint(live: Pt[], ref: Pt[]): string | null {
  if (live.length !== 42) return null;
  const shape = letterDistance(localPose(live).map((p, i) => (i >= 21 ? { ...p, x: p.x + ref[21].x, y: p.y + ref[21].y } : p)), ref);
  if (shape > 0.3) return null; // fingers still need work: that hint matters more
  const liveGap = Math.hypot(live[21].x, live[21].y);
  const refGap = Math.hypot(ref[21].x, ref[21].y);
  if (liveGap > refGap + 1.2) return "Shapes look right — bring your hands closer together";
  if (liveGap < refGap - 1.2) return "Shapes look right — move your hands a little further apart";
  return null;
}

export function useCoach({ refs, dominant, target, showGhost, attempt = 0, strictness = "normal", onCorrect }: Options) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<CoachView>(IDLE);
  const [aspect, setAspect] = useState(16 / 9);

  const optsRef = useRef({ refs, dominant, target, showGhost, strictness, onCorrect });
  useEffect(() => {
    optsRef.current = { refs, dominant, target, showGhost, strictness, onCorrect };
  });

  const holdRef = useRef({ since: 0, lastOn: 0 });
  const firedRef = useRef<string | null>(null);
  const hintRef = useRef<{ shown: string; candidate: string; since: number }>({ shown: IDLE.hint, candidate: IDLE.hint, since: 0 });
  const paletteRef = useRef<HandPalette | null>(null);
  const recordRef = useRef<{ until: number; started: number; frames: unknown[]; target: string } | null>(null);
  const [recording, setRecording] = useState(false);

  // A new target (or a retry of the same one) starts a fresh attempt.
  useEffect(() => {
    firedRef.current = null;
    holdRef.current = { since: 0, lastOn: 0 };
  }, [target, attempt]);

  function handleFrame(hands: TrackedHand[], frameAspect: number, now: number) {
    const { refs: r, dominant: dom, target: tgt, showGhost: ghostOn } = optsRef.current;
    paletteRef.current ??= readPalette(canvasRef.current);
    setAspect((prev) => (Math.abs(prev - frameAspect) > 0.01 ? frameAspect : prev));

    const ghost = tgt && ghostOn ? (r.display.get(tgt) ?? null) : null;
    drawStage(canvasRef.current, hands, frameAspect, dom, ghost, paletteRef.current);
    if (!tgt) return;

    const cfg = STRICTNESS[optsRef.current.strictness];
    const needed = r.display.get(tgt)?.sides.length ?? 1;
    // One-handed letter with both hands up: judge the dominant hand alone.
    const judged = needed === 1 && hands.length > 1 && optsRef.current.strictness !== "strict" ? orderHands(hands, dom).slice(0, 1) : hands;
    const pose = toPose(judged, dom, frameAspect);

    // Nearest sample of the target, and of every other letter.
    // Hand labels can flip when hands overlap, so two-hand poses are tried both ways round.
    let closest: Template | null = null;
    let closestLive: Pt[] | null = null;
    let distance = Infinity;
    let otherLetter: string | null = null;
    let otherDistance = Infinity;
    const perLetter = new Map<string, number>();
    if (pose) {
      const orders = pose.points.length === 42 ? [pose.points, swapHands(pose.points)] : [pose.points];
      for (const t of r.templates) {
        if (t.points.length !== pose.points.length) continue;
        for (const live of orders) {
          const d = letterDistance(live, t.points);
          if (d < (perLetter.get(t.letter) ?? Infinity)) perLetter.set(t.letter, d);
          if (t.letter === tgt) {
            if (d < distance) [distance, closest, closestLive] = [d, t, live];
          } else if (d < otherDistance) [otherDistance, otherLetter] = [d, t.letter];
        }
      }
    }

    const matchesNow = distance <= cfg.threshold && distance <= otherDistance + cfg.slack;
    const hold = holdRef.current;
    if (matchesNow) {
      if (!hold.since) hold.since = now;
      hold.lastOn = now;
    } else if (now - hold.lastOn > cfg.graceMs) {
      hold.since = 0;
    }
    const onTarget = hold.since > 0;
    const heldMs = onTarget ? now - hold.since : 0;
    const looksLikeOther = !matchesNow && otherLetter !== null && otherDistance <= cfg.threshold && otherDistance + 0.05 < distance;

    // Full meter at the cutoff, empty at 2.5× it.
    const closeness = Number.isFinite(distance) ? Math.max(0, Math.min(1, 1 - (distance - cfg.threshold) / (cfg.threshold * 1.5))) : 0;

    let hint: string;
    let tone: CoachView["tone"] = "work";
    const domWord = dom.toLowerCase();
    const otherWord = dom === "Right" ? "left" : "right";
    if (hands.length === 0) {
      hint = "Bring your hands into view";
      tone = "idle";
    } else if (needed === 2 && hands.length < 2) {
      hint = `${tgt} uses both hands — show your ${otherWord} hand too`;
    } else if (needed === 1 && judged.length > 1) {
      hint = `${tgt} uses one hand — lower your ${otherWord} hand`;
    } else if (onTarget) {
      hint = "That's it — hold it";
      tone = "good";
    } else if (looksLikeOther) {
      hint = `That reads as ${otherLetter}. Line up with the dotted shape`;
    } else if (closest && closestLive && pose && spacingHint(closestLive, closest.points)) {
      hint = spacingHint(closestLive, closest.points)!;
      if (distance < cfg.threshold * 1.35) tone = "close";
    } else if (closest && closestLive && pose) {
      const top = fingerIssues({ sides: pose.sides, points: localPose(closestLive) }, { ...closest, points: localPose(closest.points) })[0];
      const whose = top.side === dom ? `your ${domWord}` : `your ${otherWord}`;
      const near = distance < cfg.threshold * 1.35;
      hint = near ? `Close — ${whose} ${FINGER_NAMES[top.finger]}: ${top.advice}` : `${whose[0].toUpperCase()}${whose.slice(1)} ${FINGER_NAMES[top.finger]}: ${top.advice}`;
      if (near) tone = "close";
    } else {
      hint = "Bring your hands into view";
      tone = "idle";
    }

    // Hints change only after they've been stable for a moment, so they don't flicker.
    const h = hintRef.current;
    if (hint !== h.candidate) {
      h.candidate = hint;
      h.since = now;
    }
    if (h.candidate !== h.shown && (now - h.since >= HINT_SETTLE_MS || tone === "good")) h.shown = h.candidate;

    const debug: CoachDebug = {
      hands: hands.map((hd) => ({ side: hd.side, score: hd.score })),
      target: tgt,
      targetDistance: distance,
      threshold: cfg.threshold,
      nearest: [...perLetter].sort((a, b) => a[1] - b[1]).slice(0, 4).map(([letter, d]) => ({ letter, distance: d })),
      matching: matchesNow,
    };
    setView({ handsSeen: hands.length, closeness, holding: Math.min(1, heldMs / cfg.holdMs), hint: h.shown, tone: h.shown === hint ? tone : "work", debug });

    // A short recording of raw landmarks, to share when recognition misbehaves.
    const rec = recordRef.current;
    if (rec) {
      rec.frames.push({ t: Math.round(now - rec.started), aspect: frameAspect, hands, targetDistance: distance, nearest: debug.nearest });
      if (now >= rec.until) {
        recordRef.current = null;
        setRecording(false);
        const file = {
          app: "ishaara",
          version: 1,
          target: rec.target,
          dominant: dom,
          strictness: optsRef.current.strictness,
          userAgent: navigator.userAgent,
          frames: rec.frames,
        };
        downloadFile(`ishaara-recording-${rec.target}-${Date.now()}.json`, JSON.stringify(file), "application/json");
      }
    }

    if (onTarget && heldMs >= cfg.holdMs && firedRef.current !== tgt) {
      firedRef.current = tgt;
      optsRef.current.onCorrect(tgt);
    }
  }

  const { videoRef, status, error } = useTwoHandTracking(handleFrame);
  function record() {
    const tgt = optsRef.current.target;
    if (!tgt || recordRef.current) return;
    const now = performance.now();
    recordRef.current = { until: now + RECORD_MS, started: now, frames: [], target: tgt };
    setRecording(true);
  }
  return { videoRef, canvasRef, status, error, aspect, view: target ? view : IDLE, record, recording };
}
