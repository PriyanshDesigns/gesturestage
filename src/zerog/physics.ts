import { WORLD } from "./layout";
import type { ColorId } from "./levels";

export type Kind = "candy" | "wild" | "soda" | "gob";

export interface Body {
  id: number;
  kind: Kind;
  color: ColorId | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  invMass: number;
  rot: number;
  spin: number;
  // Seconds spent in a group big enough to pop.
  fuse: number;
  fizz: number;
  hits: number;
  grabbedBy: number | null;
  age: number;
  dead: boolean;
}

// A hand acting as a solid, infinitely heavy paddle.
export interface Paddle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export const CANDY_R = 52;
const RESTITUTION = 0.55;
const PADDLE_RESTITUTION = 0.45;
const WALL_RESTITUTION = 0.7;
const MAX_SPEED = 2600;
const WALL_PAD = 6;

export function integrate(bodies: Body[], dt: number, damping: number) {
  const decay = Math.exp(-damping * dt);
  for (const b of bodies) {
    b.vx *= decay;
    b.vy *= decay;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > MAX_SPEED) {
      b.vx *= MAX_SPEED / speed;
      b.vy *= MAX_SPEED / speed;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin *= decay;
    b.rot += b.spin * dt;
    b.age += dt;
  }
}

export function collideBodies(bodies: Body[]) {
  const n = bodies.length;
  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d;
      const ny = dy / d;
      const total = a.invMass + b.invMass;
      const overlap = (min - d) * 0.8;
      a.x -= nx * overlap * (a.invMass / total);
      a.y -= ny * overlap * (a.invMass / total);
      b.x += nx * overlap * (b.invMass / total);
      b.y += ny * overlap * (b.invMass / total);

      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn >= 0) continue;
      const j2 = (-(1 + RESTITUTION) * vn) / total;
      a.vx -= j2 * a.invMass * nx;
      a.vy -= j2 * a.invMass * ny;
      b.vx += j2 * b.invMass * nx;
      b.vy += j2 * b.invMass * ny;
      // Glancing hits set candies spinning.
      const vt = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
      a.spin -= vt * 0.004 * a.invMass;
      b.spin += vt * 0.004 * b.invMass;
    }
  }
}

export function collidePaddle(bodies: Body[], p: Paddle) {
  for (const b of bodies) {
    if (b.grabbedBy !== null) continue;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const min = b.r + p.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2) || 0.0001;
    const nx = dx / d;
    const ny = dy / d;
    b.x = p.x + nx * min;
    b.y = p.y + ny * min;
    const vn = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny;
    if (vn < 0) {
      const k = (1 + PADDLE_RESTITUTION) * vn;
      // Heavy bodies take only part of the paddle's shove.
      const share = Math.min(1, b.invMass * 1.6);
      b.vx -= k * nx * share;
      b.vy -= k * ny * share;
    }
  }
}

export function collideWalls(bodies: Body[]) {
  const lo = WALL_PAD;
  const hi = WORLD - WALL_PAD;
  for (const b of bodies) {
    if (b.x - b.r < lo) {
      b.x = lo + b.r;
      if (b.vx < 0) b.vx = -b.vx * WALL_RESTITUTION;
    } else if (b.x + b.r > hi) {
      b.x = hi - b.r;
      if (b.vx > 0) b.vx = -b.vx * WALL_RESTITUTION;
    }
    if (b.y - b.r < lo) {
      b.y = lo + b.r;
      if (b.vy < 0) b.vy = -b.vy * WALL_RESTITUTION;
    } else if (b.y + b.r > hi) {
      b.y = hi - b.r;
      if (b.vy > 0) b.vy = -b.vy * WALL_RESTITUTION;
    }
  }
}
