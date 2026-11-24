import { useEffect, useRef, useState } from "react";
import {
  classify,
  fingerIssues,
  shapeDistance,
  toPose,
  DEFAULT_MATCH_SETTINGS,
  type HandSide,
  type Template,
  type TrackedHand,
} from "../isl/pose";
import { useTwoHandTracking } from "../isl/useTwoHandTracking";
import { drawStage, readPalette, type HandPalette } from "./draw";
import type { References } from "./references";

export const HOLD_MS = 500;
const HINT_SETTLE_MS = 350;

export interface CoachView {
  handsSeen: number;
  closeness: number; // 0–1, how near the live shape is to the target
  holding: number; // 0–1 progress of the hold
  hint: string;
  tone: "idle" | "work" | "close" | "good";
}

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
  onCorrect: (letter: string) => void;
}

/**
 * Runs two-hand tracking and coaches toward one target letter: draws the live
 * hands with a ghost of the target, says which finger to fix, and calls
 * `onCorrect` once the right letter has been held for half a second.
 */
export function useCoach({ refs, dominant, target, showGhost, attempt = 0, onCorrect }: Options) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<CoachView>(IDLE);
  const [aspect, setAspect] = useState(16 / 9);

  const optsRef = useRef({ refs, dominant, target, showGhost, onCorrect });
  useEffect(() => {
    optsRef.current = { refs, dominant, target, showGhost, onCorrect };
  });

  const holdRef = useRef<{ letter: string | null; since: number }>({ letter: null, since: 0 });
  const firedRef = useRef<string | null>(null);
  const hintRef = useRef<{ shown: string; candidate: string; since: number }>({ shown: IDLE.hint, candidate: IDLE.hint, since: 0 });
  const paletteRef = useRef<HandPalette | null>(null);

  // A new target (or a retry of the same one) starts a fresh attempt.
  useEffect(() => {
    firedRef.current = null;
    holdRef.current = { letter: null, since: 0 };
  }, [target, attempt]);

  function handleFrame(hands: TrackedHand[], frameAspect: number, now: number) {
    const { refs: r, dominant: dom, target: tgt, showGhost: ghostOn } = optsRef.current;
    paletteRef.current ??= readPalette(canvasRef.current);
    setAspect((prev) => (Math.abs(prev - frameAspect) > 0.01 ? frameAspect : prev));

    const ghost = tgt && ghostOn ? (r.display.get(tgt) ?? null) : null;
    drawStage(canvasRef.current, hands, frameAspect, dom, ghost, paletteRef.current);
    if (!tgt) return;

    const needed = r.display.get(tgt)?.sides.length ?? 1;
    const pose = toPose(hands, dom, frameAspect);
    const match = pose ? classify(pose, r.templates, DEFAULT_MATCH_SETTINGS) : null;

    if (!match?.accepted || match.accepted !== holdRef.current.letter) {
      holdRef.current = { letter: match?.accepted ?? null, since: now };
    }
    const onTarget = match?.accepted === tgt;
    const heldMs = onTarget ? now - holdRef.current.since : 0;

    let closest: Template | null = null;
    let distance = Infinity;
    if (pose) {
      for (const t of r.byLetter.get(tgt) ?? []) {
        if (t.points.length !== pose.points.length) continue;
        const d = shapeDistance(pose.points, t.points);
        if (d < distance) {
          distance = d;
          closest = t;
        }
      }
    }
    const closeness = Number.isFinite(distance) ? Math.max(0, Math.min(1, 1 - (distance - 0.15) / 0.6)) : 0;

    let hint: string;
    let tone: CoachView["tone"] = "work";
    const domWord = dom.toLowerCase();
    const otherWord = dom === "Right" ? "left" : "right";
    if (hands.length === 0) {
      hint = "Bring your hands into view";
      tone = "idle";
    } else if (needed === 2 && hands.length < 2) {
      hint = `${tgt} uses both hands — show your ${otherWord} hand too`;
    } else if (needed === 1 && hands.length > 1) {
      hint = `${tgt} uses one hand — lower your ${otherWord} hand`;
    } else if (onTarget) {
      hint = "That's it — hold it";
      tone = "good";
    } else if (match?.accepted && match.accepted !== tgt) {
      hint = `That reads as ${match.accepted}. Line up with the dotted shape`;
    } else if (closest && pose) {
      const top = fingerIssues(pose, closest)[0];
      const whose = top.side === dom ? `your ${domWord}` : `your ${otherWord}`;
      hint = distance < 0.4 ? `Close — ${whose} ${FINGER_NAMES[top.finger]}: ${top.advice}` : `${whose[0].toUpperCase()}${whose.slice(1)} ${FINGER_NAMES[top.finger]}: ${top.advice}`;
      if (distance < 0.4) tone = "close";
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

    setView({ handsSeen: hands.length, closeness, holding: Math.min(1, heldMs / HOLD_MS), hint: h.shown, tone: h.shown === hint ? tone : "work" });

    if (onTarget && heldMs >= HOLD_MS && firedRef.current !== tgt) {
      firedRef.current = tgt;
      optsRef.current.onCorrect(tgt);
    }
  }

  const { videoRef, status, error } = useTwoHandTracking(handleFrame);
  return { videoRef, canvasRef, status, error, aspect, view: target ? view : IDLE };
}
