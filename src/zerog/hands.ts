import { classifyPose, pinchCenter, pinchDistance } from "../gesture/classifier";
import type { Landmark } from "../gesture/types";
import { STAGE_H, STAGE_W, WORLD } from "./layout";

export type HandPose = "open" | "pinch" | "fist" | "point" | "none";

export interface HandInput {
  id: number;
  source: "camera" | "mouse";
  pose: HandPose;
  // Control point in world units (palm centre, or pinch point while pinching).
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Index fingertip in stage units, for the UI cursor.
  cursorX: number;
  cursorY: number;
  // The hand's 21 landmarks mapped into world units, for drawing.
  skeleton?: { x: number; y: number }[];
}

export interface RawHand {
  side: "Left" | "Right";
  landmarks: Landmark[];
}

const WRIST = 0;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const PALM = [0, 5, 9, 13, 17];
const PINCH_ENTER = 0.34;
const PINCH_EXIT = 0.5;
const POSE_SETTLE_MS = 60;
const LOST_MS = 160;
const PREDICT_MAX_S = 0.05;

class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  private minCutoff: number;
  private beta: number;
  private dCutoff = 1;
  constructor(minCutoff: number, beta: number) {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }

  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, t: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = t;
      return value;
    }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    const rawDx = (value - this.x) / dt;
    this.dx += this.alpha(this.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += this.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }
}

function d(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

class HandState {
  pose: HandPose = "none";
  private candidate: HandPose = "none";
  private candidateSince = 0;
  private fx = new OneEuro(1.5, 0.004);
  private fy = new OneEuro(1.5, 0.004);
  private cx = new OneEuro(1.2, 0.006);
  private cy = new OneEuro(1.2, 0.006);
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  cursorX = 0;
  cursorY = 0;
  sampleT = 0;
  lastSeen = 0;
  skeleton: { x: number; y: number }[] = [];
  private hadSample = false;

  update(lm: Landmark[], map: (p: { x: number; y: number }) => { x: number; y: number }, cursorMap: (p: Landmark) => { x: number; y: number }, nowMs: number) {
    this.updatePose(lm, nowMs);

    const raw =
      this.pose === "pinch"
        ? pinchCenter(lm)
        : PALM.reduce((acc, i) => ({ x: acc.x + lm[i].x / PALM.length, y: acc.y + lm[i].y / PALM.length }), { x: 0, y: 0 });
    const target = map(raw);
    const t = nowMs / 1000;
    const nx = this.fx.filter(target.x, t);
    const ny = this.fy.filter(target.y, t);
    if (this.hadSample) {
      const dt = Math.max(1e-3, t - this.sampleT);
      const ivx = (nx - this.x) / dt;
      const ivy = (ny - this.y) / dt;
      this.vx += (ivx - this.vx) * 0.55;
      this.vy += (ivy - this.vy) * 0.55;
    }
    this.x = nx;
    this.y = ny;
    this.sampleT = t;
    this.hadSample = true;

    const c = cursorMap(lm[INDEX_TIP]);
    this.cursorX = this.cx.filter(c.x, t);
    this.cursorY = this.cy.filter(c.y, t);
    this.skeleton = lm.map(map);
    this.lastSeen = nowMs;
  }

  private updatePose(lm: Landmark[], nowMs: number) {
    const pd = pinchDistance(lm);
    // A curled fist can put the thumb on the index tip; a real pinch keeps the
    // index finger reaching out past its knuckle.
    const indexOut = d(lm[INDEX_TIP], lm[WRIST]) > d(lm[INDEX_MCP], lm[WRIST]) * 1.05;
    let raw: HandPose;
    if (indexOut && pd < (this.pose === "pinch" ? PINCH_EXIT : PINCH_ENTER)) {
      raw = "pinch";
    } else {
      const r = classifyPose(lm, 0);
      if (r.pose === "point") raw = "point";
      else if (r.extendedCount === 0) raw = "fist";
      else if (r.extendedCount >= 3) raw = "open";
      else raw = this.pose === "none" ? "open" : this.pose;
    }

    if (raw === this.pose) {
      this.candidate = raw;
      return;
    }
    if (raw !== this.candidate) {
      this.candidate = raw;
      this.candidateSince = nowMs;
    } else if (nowMs - this.candidateSince >= POSE_SETTLE_MS || this.pose === "none") {
      this.pose = raw;
    }
  }

  reset() {
    this.pose = "none";
    this.candidate = "none";
    this.fx.reset();
    this.fy.reset();
    this.cx.reset();
    this.cy.reset();
    this.hadSample = false;
    this.vx = 0;
    this.vy = 0;
  }
}

// Turns MediaPipe frames into stable, smoothed hand inputs.
export class HandTracker {
  // Fraction of the camera's height that spans the whole chamber. Smaller =
  // less arm movement needed.
  reach = 0.72;
  private states: Record<"Left" | "Right", HandState> = {
    Left: new HandState(),
    Right: new HandState(),
  };

  ingest(hands: RawHand[], aspect: number, nowMs: number) {
    const fh = this.reach;
    const fw = fh / aspect;
    const x0 = 0.5 - fw / 2;
    const y0 = 0.46 - fh / 2;
    // The camera image is not mirrored, so flip x to match what the player sees.
    const map = (p: { x: number; y: number }) => ({
      x: ((1 - p.x - x0) / fw) * WORLD,
      y: ((p.y - y0) / fh) * WORLD,
    });
    const cursorMap = (p: Landmark) => ({
      x: ((1 - p.x - 0.22) / 0.56) * STAGE_W,
      y: ((p.y - 0.1) / 0.78) * STAGE_H,
    });

    const seen = new Set<string>();
    for (const h of hands) {
      // Two hands sometimes get the same label; give the second one the free slot.
      const side = seen.has(h.side) ? (h.side === "Left" ? "Right" : "Left") : h.side;
      seen.add(side);
      this.states[side].update(h.landmarks, map, cursorMap, nowMs);
    }
  }

  inputs(nowMs: number): HandInput[] {
    const out: HandInput[] = [];
    (["Left", "Right"] as const).forEach((side, i) => {
      const s = this.states[side];
      if (s.pose === "none") return;
      if (nowMs - s.lastSeen > LOST_MS) {
        s.reset();
        return;
      }
      const ahead = Math.min(PREDICT_MAX_S, nowMs / 1000 - s.sampleT);
      out.push({
        id: i,
        source: "camera",
        pose: s.pose,
        x: s.x + s.vx * ahead,
        y: s.y + s.vy * ahead,
        vx: s.vx,
        vy: s.vy,
        cursorX: s.cursorX,
        cursorY: s.cursorY,
        skeleton: s.skeleton,
      });
    });
    return out;
  }
}
