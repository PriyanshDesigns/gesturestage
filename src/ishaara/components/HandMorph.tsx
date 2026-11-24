import { useEffect, useRef } from "react";
import type { HandSide, Pt, Template } from "../../isl/pose";
import { CONNECTIONS, readPalette } from "../draw";

const HOLD_MS = 1500;
const MORPH_MS = 650;

interface Frame {
  letter: string;
  template: Template;
}

interface Props {
  frames: Frame[];
  dominant: HandSide;
  onLetter?: (index: number) => void;
  label?: string;
}

/** Fit a template's points into a square canvas, per hand. */
function fit(t: Template, size: number) {
  const xs = t.points.map((p) => p.x);
  const ys = t.points.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = (size * 0.66) / span;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return t.points.map((p: Pt) => ({ x: size / 2 + (p.x - cx) * scale, y: size / 2 + (p.y - cy) * scale }));
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Real reference shapes from the shipped set, morphing from one letter to the
 * next. One-to-two-hand changes cross-fade instead of morphing.
 */
export function HandMorph({ frames, dominant, onLetter, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onLetterRef = useRef(onLetter);
  useEffect(() => {
    onLetterRef.current = onLetter;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || frames.length === 0) return;
    const size = 640;
    canvas.width = size;
    canvas.height = size;
    const palette = readPalette(canvas);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fitted = frames.map((f) => ({ sides: f.template.sides, pts: fit(f.template, size) }));
    const cycle = HOLD_MS + MORPH_MS;
    const start = performance.now();
    let raf = 0;
    let lastIndex = -1;

    const drawHands = (sides: HandSide[], pts: { x: number; y: number }[], alpha: number) => {
      ctx.globalAlpha = alpha;
      sides.forEach((side, h) => {
        const color = side === dominant ? palette.dominant : palette.other;
        const hp = pts.slice(h * 21, h * 21 + 21);
        ctx.strokeStyle = color;
        ctx.lineWidth = 9;
        ctx.lineCap = "round";
        for (const [a, b] of CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo(hp[a].x, hp[a].y);
          ctx.lineTo(hp[b].x, hp[b].y);
          ctx.stroke();
        }
        for (const p of hp) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = palette.joint;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      const elapsed = now - start;
      const index = Math.floor(elapsed / cycle) % frames.length;
      const phase = elapsed % cycle;
      const a = fitted[index];
      const b = fitted[(index + 1) % frames.length];
      const t = reduce || phase < HOLD_MS || frames.length === 1 ? 0 : ease((phase - HOLD_MS) / MORPH_MS);
      const shownIndex = t > 0.5 ? (index + 1) % frames.length : index;
      if (shownIndex !== lastIndex) {
        lastIndex = shownIndex;
        onLetterRef.current?.(shownIndex);
      }

      ctx.clearRect(0, 0, size, size);
      if (t === 0) drawHands(a.sides, a.pts, 1);
      else if (a.pts.length === b.pts.length) {
        drawHands(b.sides, a.pts.map((p, i) => ({ x: p.x + (b.pts[i].x - p.x) * t, y: p.y + (b.pts[i].y - p.y) * t })), 1);
      } else {
        drawHands(a.sides, a.pts, 1 - t);
        drawHands(b.sides, b.pts, t);
      }
      raf = requestAnimationFrame(tick);
    };
    // Paint the first shape now, so it shows even where animation frames are paused.
    tick(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [frames, dominant]);

  return <canvas ref={canvasRef} className="ish-morph" role="img" aria-label={label ?? "Reference hand shapes"} />;
}
