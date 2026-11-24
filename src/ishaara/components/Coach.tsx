import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import type { HandSide, Template } from "../../isl/pose";
import { drawReference, readPalette } from "../draw";
import type { CoachView } from "../useCoach";

interface StageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  status: "starting" | "ready" | "error";
  error: string | null;
  aspect: number;
  view: CoachView;
  celebrate?: string | null;
  children?: ReactNode;
}

/** Mirrored camera with live hands, the ghost target, the hint and the hold ring. */
export function CameraStage({ videoRef, canvasRef, status, error, aspect, view, celebrate, children }: StageProps) {
  return (
    <div className={`ish-stage tone-${celebrate ? "good" : view.tone}`} style={{ aspectRatio: String(aspect) }}>
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} />
      {status === "starting" && <div className="ish-stage-msg">Starting your camera…</div>}
      {status === "error" && (
        <div className="ish-stage-msg is-error">
          <strong>The camera didn't start.</strong>
          <span>{error}</span>
          <span>Allow camera access in your browser's address bar, then reload. Video stays on this device.</span>
        </div>
      )}
      {status === "ready" && !celebrate && (
        <div className="ish-hint" role="status" aria-live="polite">
          <span className="ish-hint-ring" style={{ ["--p" as string]: view.holding }} aria-hidden />
          {view.hint}
        </div>
      )}
      {celebrate && (
        <div className="ish-celebrate" role="status" aria-live="assertive">
          <span className="ish-celebrate-letter">{celebrate}</span>
          <span>Correct</span>
        </div>
      )}
      {status === "ready" && (
        <div className="ish-meter" aria-hidden>
          <div style={{ width: `${Math.round((celebrate ? 1 : view.closeness) * 100)}%` }} />
        </div>
      )}
      {children}
    </div>
  );
}

interface RefProps {
  letter: string;
  template: Template | null;
  dominant: HandSide;
  video?: string;
  hidden?: boolean;
  onReveal?: () => void;
  caption?: string;
}

/** The reference: a signer's video when the set has one, else the recorded shape. */
export function ReferenceCard({ letter, template, dominant, video, hidden, onReveal, caption }: RefProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!hidden && !video) drawReference(canvasRef.current, template, dominant, readPalette(canvasRef.current));
  }, [template, dominant, hidden, video]);

  return (
    <figure className="ish-ref">
      <div className="ish-ref-frame">
        {hidden ? (
          <button className="ish-ref-reveal" onClick={onReveal}>
            <span className="ish-ref-letter">{letter}</span>
            <span>Show me how</span>
          </button>
        ) : video ? (
          <video src={video} autoPlay loop muted playsInline />
        ) : (
          <>
            <canvas ref={canvasRef} aria-label={`Reference hand shape for ${letter}`} />
            <span className="ish-ref-tag">{letter}</span>
          </>
        )}
      </div>
      <figcaption>{caption ?? (hidden ? "Try it from memory first" : "How it looks in your mirror")}</figcaption>
    </figure>
  );
}
