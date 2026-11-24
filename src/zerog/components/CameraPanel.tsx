import { useEffect, useState, type RefObject } from "react";
import type { HandPose, HandTracker } from "../hands";
import type { CameraStatus } from "../useCamera";

const POSE_LABEL: Record<HandPose, string> = {
  open: "✋ sweep",
  pinch: "🤏 grab",
  fist: "✊ freeze",
  point: "☝️ cursor",
  none: "",
};

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  tracker: HandTracker;
  status: CameraStatus;
  variant: "side" | "mini" | "hidden";
  aspect: number;
}

export function CameraPanel({ videoRef, tracker, status, variant, aspect }: Props) {
  const [poses, setPoses] = useState<string[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = tracker.inputs(performance.now()).map((h) => POSE_LABEL[h.pose]);
      setPoses((prev) => (prev.join() === next.join() ? prev : next));
    }, 120);
    return () => window.clearInterval(id);
  }, [tracker]);

  // The dashed box shows the part of the camera frame that maps onto the chamber.
  const fh = tracker.reach;
  const fw = fh / aspect;
  const reach = { left: `${(0.5 - fw / 2) * 100}%`, top: `${(0.46 - fh / 2) * 100}%`, width: `${fw * 100}%`, height: `${fh * 100}%` };

  return (
    <div className={`zg-cam ${variant === "side" ? "" : variant}`}>
      <video ref={videoRef} playsInline muted />
      {variant !== "hidden" && status === "ready" && <div className="reach" style={reach} />}
      {variant !== "hidden" && (
        <div className="tag">
          {status !== "ready" ? (
            <span>{status === "error" ? "Camera unavailable" : "Starting camera…"}</span>
          ) : poses.length ? (
            poses.map((p, i) => <span key={i}>{p}</span>)
          ) : (
            <span>Show your hand</span>
          )}
        </div>
      )}
    </div>
  );
}

export function GestureCheatSheet() {
  return (
    <div className="zg-cheat">
      <h4>Your hands</h4>
      <GestureRows />
    </div>
  );
}

export function GestureRows() {
  return (
    <>
      <div className="zg-gesture-row">
        <span className="icon">✋</span>
        <span>
          <b>Open palm</b>: sweep and shove candies
        </span>
      </div>
      <div className="zg-gesture-row">
        <span className="icon">🤏</span>
        <span>
          <b>Pinch</b>: pick up a candy; matching ones stick on
        </span>
      </div>
      <div className="zg-gesture-row">
        <span className="icon">✊</span>
        <span>
          <b>Fist</b>: freeze candies nearby
        </span>
      </div>
      <div className="zg-gesture-row">
        <span className="icon">☝️</span>
        <span>
          <b>Point + hold</b>: press buttons
        </span>
      </div>
    </>
  );
}
