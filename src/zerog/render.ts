import { spriteFor } from "./assets";
import { FREEZE_R, FUSE, GRAB_R, PADDLE_R, SWEEP_R, type Game } from "./game";
import type { HandInput } from "./hands";
import { CHAMBER, STACK_ICON, WORLD, WORLD_SCALE, stackSlot } from "./layout";
import type { Body } from "./physics";

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const OUTLINE = "#3a1408";

function easeOutBack(t: number) {
  const c = 1.70158;
  const x = t - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

function drawSprite(ctx: CanvasRenderingContext2D, b: Body, size: number) {
  const s = spriteFor(b.kind, b.color);
  if (!s) return;
  const aspect = s.sw / s.sh;
  const w = aspect >= 1 ? size : size * aspect;
  const h = aspect >= 1 ? size / aspect : size;
  ctx.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, -w / 2, -h / 2, w, h);
}

function drawBody(ctx: CanvasRenderingContext2D, b: Body, now: number) {
  const grow = b.age < 0.3 ? easeOutBack(b.age / 0.3) : 1;
  const fuseT = Math.min(1, b.fuse / FUSE);
  const throb = fuseT > 0 ? 1 + Math.sin(now * 40) * 0.04 * fuseT + fuseT * 0.08 : 1;
  const r = b.r * grow * throb;

  ctx.save();
  ctx.translate(b.x, b.y);

  if (fuseT > 0) {
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.6);
    g.addColorStop(0, `rgba(255,255,255,${0.55 * fuseT})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (b.kind === "wild") {
    const pulse = 0.5 + Math.sin(now * 5) * 0.2;
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.5);
    g.addColorStop(0, `rgba(255,216,74,${pulse})`);
    g.addColorStop(1, "rgba(255,216,74,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft drop shadow gives the floating candies some depth.
  ctx.fillStyle = "rgba(20,6,2,0.28)";
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 0.22, r * 0.92, r * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(b.rot);
  drawSprite(ctx, b, r * (b.kind === "candy" ? 2.15 : 2.3));
  ctx.restore();

  if (b.kind === "soda" && b.fizz > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = b.fizz > 0.75 ? "#ff5d73" : "#7fdcff";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, -Math.PI / 2, -Math.PI / 2 + b.fizz * Math.PI * 2);
    ctx.stroke();
    const bubbles = Math.floor(b.fizz * 7);
    ctx.fillStyle = "rgba(220,245,255,0.85)";
    for (let i = 0; i < bubbles; i++) {
      const a = now * 3 + i * 2.1;
      const rr = r * (0.9 + ((now * 1.7 + i * 0.37) % 1) * 0.8);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 5 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (b.kind === "gob" && b.hits > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let i = 0; i < b.hits; i++) {
      const a = i * 2.2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
      ctx.lineTo(Math.cos(a + 0.3) * r * 0.5, Math.sin(a + 0.3) * r * 0.5);
      ctx.lineTo(Math.cos(a - 0.1) * r * 0.85, Math.sin(a - 0.1) * r * 0.85);
      ctx.stroke();
    }
  }

  if (fuseT > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.08, -Math.PI / 2, -Math.PI / 2 + fuseT * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHandField(ctx: CanvasRenderingContext2D, h: HandInput, now: number) {
  if (h.pose === "open") {
    const g = ctx.createRadialGradient(h.x, h.y, PADDLE_R, h.x, h.y, SWEEP_R);
    g.addColorStop(0, "rgba(140,230,255,0.28)");
    g.addColorStop(1, "rgba(140,230,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(h.x, h.y, SWEEP_R, 0, Math.PI * 2);
    ctx.fill();
  } else if (h.pose === "fist") {
    const g = ctx.createRadialGradient(h.x, h.y, 20, h.x, h.y, FREEZE_R);
    g.addColorStop(0, "rgba(200,240,255,0.5)");
    g.addColorStop(1, "rgba(160,220,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(h.x, h.y, FREEZE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(now * 0.6);
    ctx.strokeStyle = "rgba(235,250,255,0.85)";
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 16]);
    ctx.beginPath();
    ctx.arc(0, 0, FREEZE_R * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (h.pose === "pinch") {
    ctx.save();
    ctx.strokeStyle = "rgba(255,140,190,0.7)";
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -now * 40;
    ctx.beginPath();
    ctx.arc(h.x, h.y, GRAB_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHandMarker(ctx: CanvasRenderingContext2D, h: HandInput) {
  if (h.skeleton) {
    ctx.save();
    ctx.globalAlpha = h.pose === "point" ? 0.25 : 0.55;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const [a, b] of BONES) {
      ctx.moveTo(h.skeleton[a].x, h.skeleton[a].y);
      ctx.lineTo(h.skeleton[b].x, h.skeleton[b].y);
    }
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (const p of h.skeleton) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (h.pose === "point") return;
  const color = h.pose === "pinch" ? "#ff7ab8" : h.pose === "fist" ? "#bfeaff" : "#ffffff";
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = h.pose === "open" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.pose === "open" ? PADDLE_R : 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTaffy(ctx: CanvasRenderingContext2D, game: Game, h: HandInput) {
  const rt = game.hands.get(h.id);
  if (!rt || h.pose !== "pinch") return;
  for (const b of rt.grabbed) {
    const mx = (h.x + b.x) / 2;
    const my = (h.y + b.y) / 2 + 30;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ff7ab8";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.quadraticCurveTo(mx, my, b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.setLineDash([12, 14]);
    ctx.stroke();
    ctx.restore();
  }
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = `${size}px "Cherry Bomb One", "Chunky Playful", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = OUTLINE;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawStackIcon(ctx: CanvasRenderingContext2D, color: Body["color"], x: number, y: number, size: number) {
  const s = spriteFor("candy", color);
  if (!s) return;
  ctx.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, x - size / 2, y - size / 2, size, size);
}

// Draws one frame in stage units; the caller sets the stage -> pixel transform.
export function drawGame(ctx: CanvasRenderingContext2D, game: Game, inputs: HandInput[], now: number) {
  // --- world (clipped to the chamber) ---
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(CHAMBER.x, CHAMBER.y, CHAMBER.w, CHAMBER.h, 18);
  ctx.clip();
  ctx.translate(CHAMBER.x, CHAMBER.y);
  ctx.scale(WORLD_SCALE, WORLD_SCALE);

  if (game.t < game.swirlUntil) {
    ctx.save();
    ctx.translate(WORLD / 2, WORLD / 2);
    ctx.rotate(now * 3);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 30;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 160 + i * 140, i, i + 2.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (game.t < game.sweetUntil) {
    ctx.fillStyle = `rgba(255,120,180,${0.08 + Math.sin(now * 6) * 0.04})`;
    ctx.fillRect(0, 0, WORLD, WORLD);
  }

  for (const h of inputs) drawHandField(ctx, h, now);
  const ordered = [...game.bodies].sort((a, b) => (a.kind === "gob" ? -1 : 0) - (b.kind === "gob" ? -1 : 0));
  for (const b of ordered) drawBody(ctx, b, now);
  for (const h of inputs) drawTaffy(ctx, game, h);
  for (const h of inputs) drawHandMarker(ctx, h);

  for (const p of game.particles) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === "ring") {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 10 * a + 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - a * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8, p.size * 0.4);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- floating text (world coords, unclipped) ---
  ctx.save();
  ctx.translate(CHAMBER.x, CHAMBER.y);
  ctx.scale(WORLD_SCALE, WORLD_SCALE);
  for (const f of game.floaters) {
    const age = f.max - f.life;
    const grow = age < 0.18 ? easeOutBack(age / 0.18) : 1;
    ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.35));
    drawText(ctx, f.text, f.x, f.y, f.size * grow, f.color);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- basket stacks and candies flying into them (stage coords) ---
  const perCol = new Array(5).fill(0);
  for (const l of game.landed) {
    const slot = stackSlot(l.col, perCol[l.col]++, game.stackStep);
    drawStackIcon(ctx, l.color, slot.x, slot.y, STACK_ICON);
  }
  for (const fl of game.flyers) {
    const t = fl.t;
    const e = t * t * (3 - 2 * t);
    const x = fl.fromX + (fl.toX - fl.fromX) * e;
    const y = fl.fromY + (fl.toY - fl.fromY) * e - Math.sin(t * Math.PI) * 60;
    const size = 38 + (STACK_ICON - 38) * e;
    drawStackIcon(ctx, fl.color, x, y, size);
  }
}
