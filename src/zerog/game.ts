import type { HandInput, HandPose } from "./hands";
import { BASKET_COLS, WORLD, stackSlot, worldToStage } from "./layout";
import { COLOR_HEX, type ColorId, type LevelDef } from "./levels";
import { findGroups } from "./match";
import {
  CANDY_R,
  collideBodies,
  collidePaddle,
  collideWalls,
  integrate,
  type Body,
  type Kind,
  type Paddle,
} from "./physics";

export type GameStatus = "ready" | "playing" | "paused" | "won" | "lost";
export type Sfx = "pop" | "grab" | "fizz" | "burst" | "ticket" | "crack" | "power" | "win" | "lose";
export type PowerId = "swirl" | "surprise" | "sweet";
export const POWERS: PowerId[] = ["swirl", "surprise", "sweet"];

export interface Particle {
  kind: "sprinkle" | "ring";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

export interface Flyer {
  color: ColorId;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  col: number;
  t: number;
}

export interface HandRuntime {
  id: number;
  pose: HandPose;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  grabbed: Body[];
  // True from the start of a pinch until it picks something up, so a bunch
  // that pops mid-carry doesn't make the hand grab the next candy it passes.
  armed: boolean;
}

export interface Hud {
  status: GameStatus;
  score: number;
  timeLeft: number;
  combo: number;
  goals: { color: ColorId; left: number; total: number; col: number }[];
  powers: Record<PowerId, number>;
  ticket: boolean;
  hint: number;
  stars: number;
  timeBonus: number;
  bestCombo: number;
}

const STEP = 1 / 120;
export const FUSE = 0.3;
const COMBO_WINDOW = 2;
const SPAWN_INTERVAL = 0.32;
export const SWEEP_R = 230;
export const PADDLE_R = 78;
export const GRAB_R = 170;
const GRAB_MAX = 3;
const GRAB_K = 110;
const GRAB_C = 21;
export const FREEZE_R = 230;
const MAX_HAND_SPEED = 4200;
const FLY_TIME = 0.6;
const HINT_TIMEOUT = 15;

export const HINT_COUNT = 4;

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

export class Game {
  readonly level: LevelDef;
  bodies: Body[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  flyers: Flyer[] = [];
  hands = new Map<number, HandRuntime>();
  reserved: number[] = new Array(BASKET_COLS).fill(0);
  landed: { color: ColorId; col: number }[] = [];
  goalCol = new Map<ColorId, number>();
  goalsLeft = new Map<ColorId, number>();
  stackStep: number;

  status: GameStatus = "ready";
  score = 0;
  timeLeft: number;
  t = 0;
  combo = 0;
  bestCombo = 0;
  stars = 0;
  timeBonus = 0;
  powers: Record<PowerId, number> = { swirl: 2, surprise: 2, sweet: 2 };
  swirlUntil = -1;
  sweetUntil = -1;
  ticketUntil = -1;
  hint: number;

  private lastPopT = -10;
  private wonAt = -1;
  private nextId = 1;
  private spawnTimer = 0;
  private acc = 0;
  private hintT = 0;
  private hintProgress = 0;
  private poppedAny = false;
  private grabbedAny = false;
  private fizzSfxT = 0;
  private onSfx: (s: Sfx, v?: number) => void;

  constructor(level: LevelDef, onSfx: (s: Sfx, v?: number) => void) {
    this.level = level;
    this.onSfx = onSfx;
    this.timeLeft = level.time;
    this.hint = level.hints ? 0 : -1;
    this.stackStep = Math.min(22, 150 / level.goal);
    const cols = level.colors.length === 3 ? [1, 2, 3] : [0, 1, 2, 3, 4];
    level.colors.forEach((c, i) => {
      this.goalCol.set(c, cols[i]);
      this.goalsLeft.set(c, level.goal);
    });
    this.fill();
  }

  // --- setup / spawning ---

  private make(kind: Kind, color: ColorId | null, x: number, y: number): Body {
    const r = kind === "gob" ? CANDY_R * 1.25 : kind === "soda" ? CANDY_R * 1.05 : CANDY_R;
    return {
      id: this.nextId++,
      kind,
      color,
      x,
      y,
      vx: rand(-40, 40),
      vy: rand(-40, 40),
      r,
      invMass: kind === "gob" ? 1 / 6 : 1,
      rot: rand(-0.4, 0.4),
      spin: rand(-0.6, 0.6),
      fuse: 0,
      fizz: 0,
      hits: 0,
      grabbedBy: null,
      age: 0,
      dead: false,
    };
  }

  private fill() {
    const want = this.level.population;
    const colors = this.level.colors;
    const place = (kind: Kind, color: ColorId | null) => {
      const r = kind === "gob" ? CANDY_R * 1.25 : CANDY_R;
      for (let tries = 0; tries < 300; tries++) {
        const x = rand(r + 20, WORLD - r - 20);
        const y = rand(r + 20, WORLD - r - 20);
        const clear = this.bodies.every((b) => Math.hypot(b.x - x, b.y - y) > b.r + r + 16);
        if (clear) {
          const b = this.make(kind, color, x, y);
          b.age = 1;
          this.bodies.push(b);
          return;
        }
      }
    };
    for (let i = 0; i < this.level.gobstoppers; i++) place("gob", null);
    for (let i = 0; i < want; i++) place("candy", colors[i % colors.length]);
  }

  private pickColor(): ColorId {
    const weights = this.level.colors.map((c) => 1 + (this.goalsLeft.get(c) ?? 0) * 0.15);
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return this.level.colors[i];
    }
    return this.level.colors[0];
  }

  private spawn(kind: Kind, color: ColorId | null) {
    let best = { x: 500, score: -1 };
    for (let i = 0; i < 6; i++) {
      const x = rand(140, WORLD - 140);
      const score = Math.min(...this.bodies.map((b) => Math.hypot(b.x - x, b.y - CANDY_R)), 9999);
      if (score > best.score) best = { x, score };
    }
    const b = this.make(kind, color, best.x, CANDY_R + 10);
    b.vy = rand(320, 520);
    this.bodies.push(b);
  }

  private spawnTick(dt: number) {
    const live = this.bodies.filter((b) => b.kind !== "gob").length;
    if (live >= this.level.population) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = SPAWN_INTERVAL;
    const sodas = this.bodies.filter((b) => b.kind === "soda").length;
    const roll = Math.random();
    if (roll < this.level.wildChance) this.spawn("wild", null);
    else if (roll < this.level.wildChance + this.level.sodaChance && sodas < 2) this.spawn("soda", null);
    else this.spawn("candy", this.pickColor());
  }

  // --- controls ---

  start() {
    if (this.status === "ready") this.status = "playing";
  }

  pause(paused: boolean) {
    if (paused && this.status === "playing") this.status = "paused";
    else if (!paused && this.status === "paused") this.status = "playing";
  }

  usePower(id: PowerId): boolean {
    if (this.status !== "playing" || this.powers[id] <= 0) return false;
    this.powers[id] -= 1;
    const label = { swirl: "SWIRL!", surprise: "SURPRISE!", sweet: "SWEET TOOTH!" }[id];
    this.floaters.push({ x: 500, y: 470, text: label, color: "#ffd84a", size: 64, life: 1.2, max: 1.2 });
    if (id === "swirl") this.swirlUntil = this.t + 3;
    if (id === "sweet") this.sweetUntil = this.t + 5;
    if (id === "surprise") {
      this.spawn("wild", null);
      this.spawn("soda", null);
      this.spawn("soda", null);
    }
    this.onSfx("power");
    return true;
  }

  // --- main update ---

  update(dt: number, inputs: HandInput[]) {
    if (this.status === "paused") return;
    dt = Math.min(dt, 0.05);
    this.t += dt;

    this.updateHands(inputs);
    this.acc += dt;
    const steps = Math.min(8, Math.floor(this.acc / STEP));
    this.acc -= steps * STEP;
    for (let k = 0; k < steps; k++) this.substep(STEP, (k + 1) / steps);

    this.updateFx(dt);
    if (this.status === "won" || this.status === "lost") return;

    this.spawnTick(dt);
    if (this.status !== "playing") return;

    this.updateSodas(dt);
    this.updateGroups(dt);
    this.updateHints(dt);
    this.bodies = this.bodies.filter((b) => !b.dead);

    if (this.wonAt < 0 && [...this.goalsLeft.values()].every((v) => v === 0)) {
      this.wonAt = this.t;
    }
    if (this.wonAt >= 0) {
      if (this.t - this.wonAt > 0.9 && this.flyers.length === 0) this.finish(true);
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish(false);
    }
  }

  private finish(won: boolean) {
    for (const h of this.hands.values()) this.release(h);
    if (won) {
      this.timeBonus = Math.ceil(this.timeLeft) * 40;
      this.score += this.timeBonus;
      const [two, three] = this.level.stars;
      this.stars = 1 + (this.score >= two ? 1 : 0) + (this.score >= three ? 1 : 0);
      this.status = "won";
      this.onSfx("win");
    } else {
      this.status = "lost";
      this.onSfx("lose");
    }
  }

  private updateHands(inputs: HandInput[]) {
    const seen = new Set<number>();
    for (const inp of inputs) {
      seen.add(inp.id);
      let h = this.hands.get(inp.id);
      if (!h) {
        h = { id: inp.id, pose: "none", x: inp.x, y: inp.y, prevX: inp.x, prevY: inp.y, vx: 0, vy: 0, grabbed: [], armed: false };
        this.hands.set(inp.id, h);
      }
      h.prevX = h.x;
      h.prevY = h.y;
      h.x = inp.x;
      h.y = inp.y;
      const speed = Math.hypot(inp.vx, inp.vy);
      const k = speed > MAX_HAND_SPEED ? MAX_HAND_SPEED / speed : 1;
      h.vx = inp.vx * k;
      h.vy = inp.vy * k;
      const prev = h.pose;
      h.pose = inp.pose;
      if (h.pose === "pinch" && prev !== "pinch") {
        h.armed = true;
        this.grab(h);
      }
      if (h.pose !== "pinch" && prev === "pinch") this.release(h);
    }
    for (const [id, h] of this.hands) {
      if (!seen.has(id)) {
        this.release(h);
        this.hands.delete(id);
      }
    }
  }

  private inside(x: number, y: number) {
    return x > -120 && x < WORLD + 120 && y > -120 && y < WORLD + 120;
  }

  // Pinch picks up the one candy nearest the fingers.
  private grab(h: HandRuntime) {
    if (!this.inside(h.x, h.y)) return;
    let best: Body | null = null;
    let bestD = Infinity;
    for (const b of this.bodies) {
      if (b.dead || b.grabbedBy !== null) continue;
      const d = Math.hypot(b.x - h.x, b.y - h.y) - b.r;
      if (d < GRAB_R - CANDY_R && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    if (!best) return;
    best.grabbedBy = h.id;
    h.grabbed.push(best);
    h.armed = false;
    this.grabbedAny = true;
    this.onSfx("grab");
  }

  // While carrying, same-colour candies (and Wonka Bars) that touch the held
  // bunch stick to it, so a pinch works like a colour magnet.
  private scoop(h: HandRuntime) {
    const lead = h.grabbed.find((b) => b.kind === "candy");
    const color = lead?.color ?? null;
    if (!color || h.grabbed.some((b) => b.kind === "gob" || b.kind === "soda")) return;
    for (const b of this.bodies) {
      if (h.grabbed.length >= GRAB_MAX) return;
      if (b.dead || b.grabbedBy !== null) continue;
      if (!(b.kind === "wild" || (b.kind === "candy" && b.color === color))) continue;
      const touching = h.grabbed.some((g) => Math.hypot(g.x - b.x, g.y - b.y) < (g.r + b.r) * 1.15);
      if (!touching) continue;
      b.grabbedBy = h.id;
      h.grabbed.push(b);
      this.onSfx("grab");
    }
  }

  private release(h: HandRuntime) {
    for (const b of h.grabbed) {
      b.grabbedBy = null;
      b.vx += h.vx * 0.15;
      b.vy += h.vy * 0.15;
    }
    h.grabbed = [];
  }

  private substep(dt: number, f: number) {
    const paddles: Paddle[] = [];
    for (const h of this.hands.values()) {
      const px = h.prevX + (h.x - h.prevX) * f;
      const py = h.prevY + (h.y - h.prevY) * f;
      if (!this.inside(px, py)) continue;
      h.grabbed = h.grabbed.filter((b) => !b.dead);
      if (h.pose === "open") this.sweep(h, px, py, dt, paddles);
      else if (h.pose === "pinch") this.hold(h, px, py, dt);
      else if (h.pose === "fist") this.freeze(px, py, dt);
    }

    if (this.t < this.swirlUntil) this.swirl(dt);
    if (this.t < this.sweetUntil) this.sweetTooth(dt);
    this.drift(dt);

    integrate(this.bodies, dt, this.level.damping);
    collideBodies(this.bodies);
    for (const p of paddles) collidePaddle(this.bodies, p);
    collideWalls(this.bodies);
  }

  private sweep(h: HandRuntime, px: number, py: number, dt: number, paddles: Paddle[]) {
    const speed = Math.hypot(h.vx, h.vy);
    const s = Math.min(1, speed / 300);
    if (s > 0.01) {
      for (const b of this.bodies) {
        if (b.grabbedBy !== null) continue;
        const dist = Math.hypot(b.x - px, b.y - py);
        if (dist >= SWEEP_R) continue;
        const w = (1 - dist / SWEEP_R) ** 2 * s * Math.min(1, b.invMass * 2);
        b.vx += (h.vx - b.vx) * 6 * w * dt;
        b.vy += (h.vy - b.vy) * 6 * w * dt;
      }
    }
    paddles.push({ x: px, y: py, vx: h.vx, vy: h.vy, r: PADDLE_R });
  }

  private hold(h: HandRuntime, px: number, py: number, dt: number) {
    if (h.grabbed.length === 0) {
      if (h.armed) this.grab(h);
    } else if (h.grabbed.length < GRAB_MAX) this.scoop(h);
    const n = h.grabbed.length;
    h.grabbed.forEach((b, i) => {
      let tx = px;
      let ty = py;
      if (n > 1) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        tx += Math.cos(a) * CANDY_R * (n === 2 ? 1 : 1.16);
        ty += Math.sin(a) * CANDY_R * (n === 2 ? 1 : 1.16);
      }
      const k = b.kind === "gob" ? 0.4 : 1;
      b.vx += ((tx - b.x) * GRAB_K - (b.vx - h.vx) * GRAB_C) * dt * k;
      b.vy += ((ty - b.y) * GRAB_K - (b.vy - h.vy) * GRAB_C) * dt * k;
    });
    // Drop anything that got stuck far behind the hand.
    for (const b of h.grabbed) {
      if (Math.hypot(b.x - px, b.y - py) > 420) b.grabbedBy = null;
    }
    h.grabbed = h.grabbed.filter((b) => b.grabbedBy === h.id);
  }

  private freeze(px: number, py: number, dt: number) {
    for (const b of this.bodies) {
      const dist = Math.hypot(b.x - px, b.y - py);
      if (dist >= FREEZE_R) continue;
      const decay = Math.exp(-9 * (1 - dist / FREEZE_R) * dt);
      b.vx *= decay;
      b.vy *= decay;
      b.spin *= decay;
    }
  }

  private swirl(dt: number) {
    for (const b of this.bodies) {
      const dx = b.x - WORLD / 2;
      const dy = b.y - WORLD / 2;
      const d = Math.hypot(dx, dy) || 1;
      const tan = 1100 * Math.min(1, d / 500);
      const share = Math.min(1, b.invMass * 2);
      b.vx += ((-dy / d) * tan - (dx / d) * 220) * dt * share;
      b.vy += ((dx / d) * tan - (dy / d) * 220) * dt * share;
    }
  }

  private sweetTooth(dt: number) {
    const R = 420;
    const list = this.bodies.filter((b) => b.kind === "candy");
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.color !== b.color) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > R) continue;
        const f = 340 * (1 - d / R) * dt;
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
    }
  }

  // Tiny random currents so the chamber never looks frozen.
  private drift(dt: number) {
    for (const b of this.bodies) {
      b.vx += rand(-24, 24) * dt;
      b.vy += rand(-24, 24) * dt;
    }
  }

  // --- specials ---

  private updateSodas(dt: number) {
    this.fizzSfxT -= dt;
    for (const s of this.bodies) {
      if (s.kind !== "soda" || s.dead) continue;
      const speed = Math.hypot(s.vx, s.vy);
      if (speed > 650) {
        s.fizz += dt * (speed / 1300) * 1.4;
        if (this.fizzSfxT <= 0) {
          this.onSfx("fizz", s.fizz);
          this.fizzSfxT = 0.25;
        }
      } else {
        s.fizz = Math.max(0, s.fizz - dt * 0.2);
      }
      if (s.fizz >= 1) this.burst(s);
    }
  }

  private burst(s: Body) {
    const R = 300;
    const victims = this.bodies.filter(
      (b) => !b.dead && b !== s && (b.kind === "candy" || b.kind === "wild") && Math.hypot(b.x - s.x, b.y - s.y) < R
    );
    this.particles.push({ kind: "ring", x: s.x, y: s.y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: R, color: "#9fe3ff", rot: 0, vr: 0 });
    this.onSfx("burst");
    this.pop([s, ...victims], 2.2);
  }

  private damageGobs(members: Body[]) {
    for (const g of this.bodies) {
      if (g.kind !== "gob" || g.dead) continue;
      const near = members.some((m) => Math.hypot(m.x - g.x, m.y - g.y) < g.r + m.r + 40);
      if (!near) continue;
      g.hits += 1;
      g.spin += rand(-6, 6);
      if (g.hits >= 3) {
        g.dead = true;
        const pts = 500 * (this.t < this.ticketUntil ? 2 : 1);
        this.score += pts;
        this.floaters.push({ x: g.x, y: g.y, text: `+${pts} CRACKED!`, color: "#ffb347", size: 44, life: 1.2, max: 1.2 });
        for (const c of ["#3b4fe0", "#e0b020", "#c0392b", "#7a2fd0", "#f07a28"]) {
          for (let i = 0; i < 4; i++) this.sprinkle(g.x, g.y, c, 1.3);
        }
        this.onSfx("crack");
      }
    }
  }

  // --- matching / popping ---

  private updateGroups(dt: number) {
    const groups = findGroups(this.bodies, this.level.colors);
    const inGroup = new Set<Body>();
    for (const g of groups) for (const m of g.members) inGroup.add(m);
    for (const b of this.bodies) b.fuse = inGroup.has(b) ? b.fuse + dt : 0;
    for (const g of groups) {
      if (g.members.some((m) => m.dead)) continue;
      if (Math.max(...g.members.map((m) => m.fuse)) >= FUSE) this.pop(g.members, 1);
    }
  }

  private pop(members: Body[], power: number) {
    const n = members.length;
    this.combo = this.t - this.lastPopT < COMBO_WINDOW ? this.combo + 1 : 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.lastPopT = this.t;
    this.poppedAny = true;
    const base = 60 * n * (1 + 0.5 * Math.max(0, n - 3));
    const mult = this.combo * (this.t < this.ticketUntil ? 2 : 1);
    const pts = Math.round((base * mult) / 10) * 10;
    this.score += pts;

    let cx = 0;
    let cy = 0;
    for (const m of members) {
      m.dead = true;
      cx += m.x / n;
      cy += m.y / n;
      const hex = m.kind === "candy" && m.color ? COLOR_HEX[m.color] : m.kind === "wild" ? "#ffd84a" : "#9fe3ff";
      for (let i = 0; i < 7; i++) this.sprinkle(m.x, m.y, i % 3 === 0 ? "#ffffff" : hex, 1);
      this.particles.push({ kind: "ring", x: m.x, y: m.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: m.r * 1.6, color: "#ffffff", rot: 0, vr: 0 });
      if (m.kind === "candy" && m.color) this.collect(m);
      if (m.kind === "wild") {
        this.timeLeft += 8;
        this.ticketUntil = this.t + 6;
        this.floaters.push({ x: m.x, y: m.y - 60, text: "GOLDEN TICKET! +8s", color: "#ffd84a", size: 46, life: 1.6, max: 1.6 });
        this.onSfx("ticket");
      }
    }

    this.floaters.push({ x: cx, y: cy, text: `+${pts}`, color: "#ffffff", size: 40 + Math.min(30, n * 4), life: 1, max: 1 });
    if (this.combo > 1) {
      this.floaters.push({ x: cx, y: cy + 56, text: `COMBO ×${this.combo}`, color: "#ff7ab8", size: 34, life: 1, max: 1 });
    }

    const R = (240 + 18 * n) * (power > 1 ? 1.7 : 1);
    const kick = (320 + 70 * n) * power;
    for (const b of this.bodies) {
      if (b.dead) continue;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      if (d > R) continue;
      const k = kick * (1 - d / R) * Math.min(1, b.invMass * 2);
      b.vx += (dx / d) * k;
      b.vy += (dy / d) * k;
    }
    this.damageGobs(members);
    this.onSfx("pop", this.combo);
  }

  private collect(m: Body) {
    const color = m.color as ColorId;
    const left = this.goalsLeft.get(color);
    if (!left) return;
    this.goalsLeft.set(color, left - 1);
    const col = this.goalCol.get(color) as number;
    const index = this.reserved[col]++;
    const from = worldToStage(m.x, m.y);
    const to = stackSlot(col, index, this.stackStep);
    this.flyers.push({ color, fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, col, t: 0 });
  }

  private sprinkle(x: number, y: number, color: string, force: number) {
    const a = Math.random() * Math.PI * 2;
    const s = rand(250, 700) * force;
    this.particles.push({
      kind: "sprinkle",
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(0.5, 0.9),
      max: 0.9,
      size: rand(7, 13),
      color,
      rot: Math.random() * Math.PI,
      vr: rand(-12, 12),
    });
  }

  private updateFx(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const decay = Math.exp(-3.2 * dt);
      p.vx *= decay;
      p.vy *= decay;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 70 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const fl of this.flyers) {
      fl.t += dt / FLY_TIME;
      if (fl.t >= 1) this.landed.push({ color: fl.color, col: fl.col });
    }
    this.flyers = this.flyers.filter((fl) => fl.t < 1);
  }

  // --- level 1 tutorial ---

  private updateHints(dt: number) {
    if (this.hint < 0) return;
    this.hintT += dt;
    const hands = [...this.hands.values()].filter((h) => this.inside(h.x, h.y));
    let done = false;
    if (this.hint === 0) {
      if (hands.some((h) => h.pose === "open" && Math.hypot(h.vx, h.vy) > 300)) this.hintProgress += dt;
      done = this.hintProgress > 1.2;
    } else if (this.hint === 1) {
      done = this.grabbedAny;
    } else if (this.hint === 2) {
      if (hands.some((h) => h.pose === "fist")) this.hintProgress += dt;
      done = this.hintProgress > 0.6;
    } else if (this.hint === 3) {
      done = this.poppedAny;
    }
    if (done || this.hintT > HINT_TIMEOUT) {
      this.hint = this.hint + 1 >= HINT_COUNT ? -1 : this.hint + 1;
      this.hintT = 0;
      this.hintProgress = 0;
      if (this.hint === 1) this.grabbedAny = false;
      if (this.hint === 3) this.poppedAny = false;
    }
  }

  hud(): Hud {
    return {
      status: this.status,
      score: this.score,
      timeLeft: Math.ceil(this.timeLeft),
      combo: this.t - this.lastPopT < COMBO_WINDOW ? this.combo : 0,
      goals: this.level.colors.map((c) => ({
        color: c,
        left: this.goalsLeft.get(c) ?? 0,
        total: this.level.goal,
        col: this.goalCol.get(c) ?? 0,
      })),
      powers: { ...this.powers },
      ticket: this.t < this.ticketUntil,
      hint: this.hint,
      stars: this.stars,
      timeBonus: this.timeBonus,
      bestCombo: this.bestCombo,
    };
  }
}
