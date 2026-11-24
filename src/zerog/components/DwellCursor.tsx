import { useEffect, useRef, useState, type RefObject } from "react";
import type { HandTracker } from "../hands";
import { STAGE_H, STAGE_W } from "../layout";
import { playClick } from "../sfx";

const DWELL_MS = 800;
const COOLDOWN_MS = 700;

interface CursorState {
  x: number;
  y: number;
  pointing: boolean;
  progress: number;
}

// Point at a [data-dwell] element and hold still to press it.
export function DwellCursor({
  tracker,
  stageRef,
  showIdle,
}: {
  tracker: HandTracker;
  stageRef: RefObject<HTMLDivElement | null>;
  showIdle: boolean;
}) {
  const [cursor, setCursor] = useState<CursorState | null>(null);
  const target = useRef<HTMLElement | null>(null);
  const since = useRef(0);
  const cooldownUntil = useRef(0);
  const showIdleRef = useRef(showIdle);

  useEffect(() => {
    showIdleRef.current = showIdle;
  });

  useEffect(() => {
    let raf = 0;
    const setDwelling = (el: HTMLElement | null) => {
      if (target.current === el) return;
      target.current?.classList.remove("dwelling");
      el?.classList.add("dwelling");
      target.current = el;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const hands = tracker.inputs(now);
      const hand = hands.find((h) => h.pose === "point") ?? (showIdleRef.current ? hands[0] : undefined);
      const stage = stageRef.current;
      if (!hand || !stage) {
        setDwelling(null);
        setCursor(null);
        return;
      }
      const x = Math.max(0, Math.min(STAGE_W, hand.cursorX));
      const y = Math.max(0, Math.min(STAGE_H, hand.cursorY));
      const pointing = hand.pose === "point";
      let progress = 0;

      if (pointing && now > cooldownUntil.current) {
        const rect = stage.getBoundingClientRect();
        const cx = rect.left + (x / STAGE_W) * rect.width;
        const cy = rect.top + (y / STAGE_H) * rect.height;
        const hit = document.elementFromPoint(cx, cy) as HTMLElement | null;
        const el = hit?.closest<HTMLElement>("[data-dwell]") ?? null;
        const usable = el && !(el as HTMLButtonElement).disabled ? el : null;
        if (usable !== target.current) since.current = now;
        setDwelling(usable);
        if (usable) {
          progress = Math.min(1, (now - since.current) / DWELL_MS);
          if (progress >= 1) {
            playClick();
            usable.click();
            setDwelling(null);
            cooldownUntil.current = now + COOLDOWN_MS;
            progress = 0;
          }
        }
      } else {
        setDwelling(null);
      }

      setCursor((prev) =>
        prev && Math.abs(prev.x - x) < 0.3 && Math.abs(prev.y - y) < 0.3 && prev.pointing === pointing && Math.abs(prev.progress - progress) < 0.01
          ? prev
          : { x, y, pointing, progress }
      );
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      target.current?.classList.remove("dwelling");
    };
  }, [tracker, stageRef]);

  if (!cursor) return null;
  const circ = 2 * Math.PI * 19;
  return (
    <div className={`zg-cursor ${cursor.pointing ? "" : "idle"}`} style={{ left: cursor.x, top: cursor.y }}>
      <div className="dot" />
      {cursor.progress > 0 && (
        <svg viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(58,20,8,0.35)" strokeWidth="5" />
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="none"
            stroke="#ffd34d"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${circ * cursor.progress} ${circ}`}
            transform="rotate(-90 22 22)"
          />
        </svg>
      )}
    </div>
  );
}
