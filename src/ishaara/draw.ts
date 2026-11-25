import { handScale, orderHands, type HandSide, type Pt, type Template, type TrackedHand } from "../isl/pose";

export const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export interface HandPalette {
  dominant: string;
  other: string;
  joint: string;
  ghost: string;
}

export function readPalette(el: Element | null): HandPalette {
  const css = el ? getComputedStyle(el) : null;
  const get = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback;
  return {
    dominant: get("--hand-dominant", "#0f6e6a"),
    other: get("--hand-other", "#d9892b"),
    joint: get("--hand-joint", "#ffffff"),
    ghost: get("--hand-ghost", "rgba(255,255,255,0.85)"),
  };
}

const WRIST = 0;

function strokeHand(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  for (const [a, b] of CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  }
}

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

/**
 * Live hands, plus the target shape as a dashed "ghost" pinned to the
 * learner's own dominant wrist and scaled to their hand, so they can line up
 * with it. The canvas is mirrored by CSS together with the video.
 */
export function drawStage(
  canvas: HTMLCanvasElement | null,
  hands: TrackedHand[],
  aspect: number,
  dominant: HandSide,
  ghost: Template | null,
  palette: HandPalette
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = 960;
  const height = Math.round(width / aspect);
  sizeCanvas(canvas, width, height);
  ctx.clearRect(0, 0, width, height);

  if (ghost) {
    const ordered = orderHands(hands, dominant);
    const anchorHand = ordered.find((h) => h.side === dominant) ?? null;
    let ox: number;
    let oy: number;
    let scale: number;
    if (anchorHand) {
      const a = anchorHand.landmarks;
      ox = a[WRIST].x * aspect;
      oy = a[WRIST].y;
      scale = handScale(a.map((p) => ({ x: p.x * aspect, y: p.y, z: 0 })));
    } else {
      // No hand yet: show the shape where a hand would comfortably sit.
      ox = (dominant === "Right" ? 0.4 : 0.6) * aspect;
      oy = 0.72;
      scale = 0.13;
    }
    const toPx = (p: Pt) => ({ x: ((ox + p.x * scale) / aspect) * width, y: (oy + p.y * scale) * height });
    ctx.save();
    ctx.setLineDash([2, 9]);
    for (let h = 0; h < ghost.sides.length; h++) {
      const pts = ghost.points.slice(h * 21, h * 21 + 21).map(toPx);
      strokeHand(ctx, pts, palette.ghost, 5);
    }
    ctx.restore();
  }

  for (const hand of hands) {
    const pts = hand.landmarks.map((p) => ({ x: p.x * width, y: p.y * height }));
    strokeHand(ctx, pts, hand.side === dominant ? palette.dominant : palette.other, 4);
    ctx.fillStyle = palette.joint;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A reference shape on its own, fitted to the canvas. Mirrored by CSS like the stage. */
export function drawReference(canvas: HTMLCanvasElement | null, template: Template | null, dominant: HandSide, palette: HandPalette) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = 480;
  sizeCanvas(canvas, size, size);
  ctx.clearRect(0, 0, size, size);
  if (!template) return;

  const xs = template.points.map((p) => p.x);
  const ys = template.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = (size * 0.78) / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const toPx = (p: Pt) => ({ x: size / 2 + (p.x - cx) * scale, y: size / 2 + (p.y - cy) * scale });

  template.sides.forEach((side, h) => {
    const pts = template.points.slice(h * 21, h * 21 + 21).map(toPx);
    strokeHand(ctx, pts, side === dominant ? palette.dominant : palette.other, 7);
    ctx.fillStyle = side === dominant ? palette.dominant : palette.other;
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
